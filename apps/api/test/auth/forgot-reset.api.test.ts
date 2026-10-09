import { createHmac } from 'node:crypto';

import { SignedLinkPayloadSchema } from '@quad/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SignedLinks } from '../../src/common/crypto/signed-links';
import { TENANT_DB } from '../../src/tokens';
import { localEnv } from '../env';
import { RecordingDelivery } from '../fakes/delivery';
import { RecordingPasswordResets } from '../fakes/password-resets';
import { Browser } from '../helpers/browser';
import { useDatabaseApp } from '../helpers/database-app';
import { insertMember, insertSchool, insertWebSession } from '../helpers/identity';
import {
  anyText,
  auditRows,
  emailsTo,
  freshEmail,
  GOOD_PASSWORD,
  insertPasswordAccount,
  setSignInRules,
} from '../helpers/sign-in';

import type { PasswordAccount } from '../helpers/sign-in';
import type { QuadTenantDb } from '@quad/db';

const NOW = Date.UTC(2026, 9, 8, 3, 30, 1);
const MINUTE = 60_000;
let clock = NOW;
const delivery = new RecordingDelivery();
const passwordResets = new RecordingPasswordResets(() => clock);
const { db, app } = useDatabaseApp(
  {},
  { overrides: { now: () => clock, delivery, passwordResets } },
);

beforeEach(() => {
  clock = NOW;
});

/** Signs links the way the API does, with the test secret; nonces are never recorded here. */
const links = new SignedLinks(localEnv().LINK_SIGNING_SECRET ?? '', () => Promise.resolve(true));
const NEW_PASSWORD = 'a brand new passphrase';

const forgot = (email: unknown) => new Browser(app).post('/auth/password/forgot', { email });
/** Forgot password, then the worker's job, as it runs after the response. */
async function forgotAndProcess(email: string) {
  const response = await forgot(email);
  await passwordResets.process(app(), delivery);
  return response;
}
const reset = (token: string, password: string) =>
  new Browser(app).post('/auth/password/reset', { token, password });

async function staffAccount(): Promise<PasswordAccount> {
  const school = await insertSchool(db(), { name: 'Colombo International School' });
  const account = await insertPasswordAccount(db());
  await insertMember(db(), school.id, account.id);
  return account;
}

/** The token in the latest reset email queued for `email`. */
function queuedToken(email: string): string {
  const queued = emailsTo(delivery, email, 'password_reset').at(-1);
  const link = queued?.job.params.link;
  if (typeof link !== 'string') throw new Error('No reset email was queued.');
  const match = /\/sign-in\/reset\/([^/?#]+)$/.exec(link);
  if (match?.[1] === undefined) throw new Error('The link has no token.');
  return match[1];
}

const payloadOf = (token: string) =>
  SignedLinkPayloadSchema.parse(
    JSON.parse(Buffer.from(token.split('.')[0] ?? '', 'base64url').toString('utf8')),
  );

const signIn = (account: PasswordAccount, password: string) =>
  new Browser(app).post('/auth/password', { email: account.email, password });

describe('POST /auth/password/forgot (spec 05 step 6)', () => {
  it('answers 202, and the job emails a single-use reset link with no school in it (OQ8)', async () => {
    const account = await staffAccount();
    const response = await forgotAndProcess(account.email.toUpperCase());
    expect(response.statusCode).toBe(202);
    const [queued] = emailsTo(delivery, account.email, 'password_reset');
    expect(queued?.job).toMatchObject({ tenantId: null, school: null, params: { minutes: 30 } });
    expect(String(queued?.job.params.link)).toMatch(
      /^http:\/\/localhost:3000\/sign-in\/reset\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
    );
    const payload = payloadOf(queuedToken(account.email));
    expect(payload).toMatchObject({ purpose: 'password_reset', tid: null, sub: account.id });
    expect(queued?.jobId).not.toContain(queuedToken(account.email));
  });

  it('answers 202 with the identical body for an unknown email, and the job sends nothing', async () => {
    const account = await staffAccount();
    const known = await forgotAndProcess(account.email);
    const unknownEmail = freshEmail();
    const unknown = await forgotAndProcess(unknownEmail);
    expect(unknown.statusCode).toBe(202);
    expect(unknown.body).toBe(known.body);
    expect(delivery.emails.filter(({ job }) => job.to === unknownEmail)).toEqual([]);
  });

  it('does the same work for a known and an unknown email: one job keyed by the HMAC of the email, no lookup', async () => {
    const account = await staffAccount();
    const definers = app().get<QuadTenantDb>(TENANT_DB).definers;
    const lookup = vi.spyOn(definers, 'accountByIdentifier');
    try {
      await forgot(account.email);
      const unknownEmail = freshEmail();
      await forgot(unknownEmail);
      expect(lookup).not.toHaveBeenCalled();
      const [forKnown, forUnknown, ...rest] = passwordResets.requests.splice(0);
      expect(rest).toEqual([]);
      expect(forKnown?.email).toBe(account.email);
      expect(forUnknown?.email).toBe(unknownEmail);
      expect(forKnown?.jobId).toMatch(/^password-reset-request\.[A-Za-z0-9_-]{43}$/);
      expect(forKnown?.jobId).not.toContain(account.email.split('@')[0] ?? '');
      expect(forUnknown?.jobId).not.toBe(forKnown?.jobId);
      // The same address (any spelling) always gives the same job id.
      await forgot(account.email.toUpperCase());
      expect(passwordResets.requests.splice(0)[0]?.jobId).toBe(forKnown?.jobId);
    } finally {
      lookup.mockRestore();
    }
  });

  it('answers 400 validation for a malformed email', async () => {
    const response = await forgot('nope');
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: 'validation',
      fields: { email: anyText() },
    });
  });

  it('is rate-limited per email: the 4th request in 15 minutes is 429', async () => {
    const email = freshEmail();
    for (let call = 1; call <= 3; call += 1) expect((await forgot(email)).statusCode).toBe(202);
    expect((await forgot(email)).statusCode).toBe(429);
  });
});

describe('POST /auth/password/reset (signed link)', () => {
  it('sets the new password, and revokes every session and trusted device', async () => {
    const account = await staffAccount();
    const signedIn = new Browser(app);
    await signedIn.post('/auth/password', { email: account.email, password: account.password });
    expect((await signedIn.get('/me')).statusCode).toBe(200); // now cached
    const other = await insertWebSession(db(), account.id);
    await db().platform.query(
      `insert into trusted_devices (account_id, token_hash, expires_at) values ($1, $2, $3)`,
      [account.id, Buffer.from('a-trusted-device'), new Date(NOW + 30 * 24 * 60 * MINUTE)],
    );
    await forgotAndProcess(account.email);
    const before = await auditRows(db(), 'auth.password_reset');

    const response = await reset(queuedToken(account.email), NEW_PASSWORD);

    expect(response.statusCode).toBe(204);
    expect((await signedIn.get('/me')).statusCode).toBe(401);
    const { rows: live } = await db().platform.query(
      'select id from sessions where account_id = $1 and revoked_at is null',
      [account.id],
    );
    expect(live).toEqual([]);
    expect(other.id).toBeDefined();
    const { rows: devices } = await db().platform.query(
      'select id from trusted_devices where account_id = $1 and revoked_at is null',
      [account.id],
    );
    expect(devices).toEqual([]);
    expect((await signIn(account, account.password)).statusCode).toBe(401);
    expect((await signIn(account, NEW_PASSWORD)).statusCode).toBe(200);
    expect((await auditRows(db(), 'auth.password_reset')).length).toBe(before.length + 1);
  });

  it('refuses a weak password with 400 and fields.password, and does not use up the link', async () => {
    const account = await staffAccount();
    await forgotAndProcess(account.email);
    const token = queuedToken(account.email);

    const short = await reset(token, 'too short');
    expect(short.statusCode).toBe(400);
    expect(short.json()).toMatchObject({
      code: 'validation',
      fields: { password: anyText() },
    });
    const breached = await reset(token, 'password1234');
    expect(breached.statusCode).toBe(400);
    expect(breached.json()).toMatchObject({ fields: { password: anyText() } });

    expect((await reset(token, NEW_PASSWORD)).statusCode).toBe(204);
  });

  it("applies the strictest school's minimum length", async () => {
    const school = await insertSchool(db());
    await setSignInRules(db(), school.id, { passwordMinLength: 16 });
    const account = await insertPasswordAccount(db());
    await insertMember(db(), school.id, account.id);
    await forgotAndProcess(account.email);
    const token = queuedToken(account.email);
    expect((await reset(token, 'fifteen chars!!')).statusCode).toBe(400);
    expect((await reset(token, 'sixteen chars!!!')).statusCode).toBe(204);
  });

  it('refuses a second use with 400 invalid_link (the nonce is recorded in the database)', async () => {
    const account = await staffAccount();
    await forgotAndProcess(account.email);
    const token = queuedToken(account.email);
    expect((await reset(token, NEW_PASSWORD)).statusCode).toBe(204);
    const again = await reset(token, 'yet another passphrase');
    expect(again.statusCode).toBe(400);
    expect(again.json()).toMatchObject({ code: 'invalid_link' });
    expect((await signIn(account, NEW_PASSWORD)).statusCode).toBe(200);
  });

  describe('refuses a bad link with 400 invalid_link and no school name (journey 43)', () => {
    const school = 'Colombo International School';

    async function expectInvalid(token: string): Promise<void> {
      const response = await reset(token, NEW_PASSWORD);
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: 'invalid_link' });
      expect(response.body).not.toContain(school);
      expect(response.body).not.toContain('Colombo');
    }

    it('expired', async () => {
      const account = await staffAccount();
      const token = links.signLink(
        { purpose: 'password_reset', tid: null, sub: account.id },
        new Date(NOW - 31 * MINUTE),
      );
      await expectInvalid(token);
    });

    it('tampered', async () => {
      const account = await staffAccount();
      const other = await staffAccount();
      const token = links.signLink(
        { purpose: 'password_reset', tid: null, sub: account.id },
        new Date(NOW),
      );
      const [segment, signature] = token.split('.');
      const payload = JSON.parse(
        Buffer.from(segment ?? '', 'base64url').toString('utf8'),
      ) as object;
      const forged = Buffer.from(JSON.stringify({ ...payload, sub: other.id })).toString(
        'base64url',
      );
      await expectInvalid(`${forged}.${signature ?? ''}`);
      expect((await signIn(other, other.password)).statusCode).toBe(200);
    });

    it('re-signed with another key', async () => {
      const account = await staffAccount();
      const token = links.signLink(
        { purpose: 'password_reset', tid: null, sub: account.id },
        new Date(NOW),
      );
      const segment = token.split('.')[0] ?? '';
      const resigned = createHmac('sha256', 'another-key-another-key-another-key')
        .update(segment, 'ascii')
        .digest('base64url');
      await expectInvalid(`${segment}.${resigned}`);
    });

    it('wrong purpose (a staff invite of a named school)', async () => {
      const named = await insertSchool(db(), { name: school });
      const account = await insertPasswordAccount(db());
      await insertMember(db(), named.id, account.id);
      const token = links.signLink(
        { purpose: 'staff_invite', tid: named.id, sub: account.id },
        new Date(NOW),
      );
      await expectInvalid(token);
    });

    it('not a token at all', async () => {
      await expectInvalid('not-a-token');
    });
  });

  it('refuses a link issued before the password last changed with invalid_link', async () => {
    const account = await staffAccount();
    await forgotAndProcess(account.email);
    const older = queuedToken(account.email);
    clock = NOW + MINUTE;
    await forgotAndProcess(account.email);
    const newer = queuedToken(account.email);
    clock = NOW + 2 * MINUTE;
    expect((await reset(newer, NEW_PASSWORD)).statusCode).toBe(204);
    clock = NOW + 3 * MINUTE;
    const stale = await reset(older, 'yet another passphrase');
    expect(stale.statusCode).toBe(400);
    expect(stale.json()).toMatchObject({ code: 'invalid_link' });
    expect((await signIn(account, NEW_PASSWORD)).statusCode).toBe(200);
  });

  it('answers 400 validation without a token', async () => {
    const response = await new Browser(app).post('/auth/password/reset', {
      password: GOOD_PASSWORD,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: 'validation',
      fields: { token: anyText() },
    });
  });

  it("changes only the link's own account: account A's link never touches account B", async () => {
    const a = await staffAccount();
    const b = await staffAccount();
    await forgotAndProcess(a.email);
    expect((await reset(queuedToken(a.email), NEW_PASSWORD)).statusCode).toBe(204);
    expect((await signIn(b, b.password)).statusCode).toBe(200);
    expect((await signIn(b, NEW_PASSWORD)).statusCode).toBe(401);
  });
});
