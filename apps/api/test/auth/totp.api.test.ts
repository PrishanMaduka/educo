import { TotpSetupResult } from '@quad/contracts';
import { createFieldCipher } from '@quad/db';
import { generateSecret } from 'otplib';
import { beforeEach, describe, expect, it } from 'vitest';

import { localEnv } from '../env';
import { RecordingDelivery } from '../fakes/delivery';
import { Browser, setCookie } from '../helpers/browser';
import { useDatabaseApp } from '../helpers/database-app';
import { insertMember, insertSchool } from '../helpers/identity';
import {
  anyText,
  auditRows,
  insertPasswordAccount,
  setSignInRules,
  totpCode,
} from '../helpers/sign-in';

import type { PasswordAccount } from '../helpers/sign-in';

const STEP = 30_000;
const T0 = Date.UTC(2026, 9, 8, 3, 30, 1);
let clock = T0;
const delivery = new RecordingDelivery();
const cipher = createFieldCipher(localEnv().FIELD_ENCRYPTION_KEY ?? '');

const { db, app } = useDatabaseApp({}, { overrides: { now: () => clock, delivery } });

beforeEach(() => {
  clock = T0;
});

/** A staff member with an authenticator, signed in with the password: the session is at two_step. */
async function atTwoStep(
  options: { readonly recoveryCodes?: readonly string[]; readonly schools?: number } = {},
): Promise<{ account: PasswordAccount; browser: Browser }> {
  const account = await insertPasswordAccount(db(), {
    totp: true,
    ...(options.recoveryCodes === undefined ? {} : { recoveryCodes: options.recoveryCodes }),
  });
  for (let count = 0; count < (options.schools ?? 1); count += 1) {
    const school = await insertSchool(db());
    await insertMember(db(), school.id, account.id);
  }
  const browser = new Browser(app);
  const response = await browser.post('/auth/password', {
    email: account.email,
    password: account.password,
  });
  expect(response.json()).toEqual({ next: 'two_step' });
  return { account, browser };
}

const secretOf = (account: PasswordAccount): string => {
  if (account.totpSecret === null) throw new Error('The account has no authenticator.');
  return account.totpSecret;
};

describe('POST /auth/totp/verify (spec 05 step 4)', () => {
  it('accepts the current code and opens the only school', async () => {
    const { account, browser } = await atTwoStep();
    const before = browser.cookies.get('quad_sid');
    const response = await browser.post('/auth/totp/verify', {
      code: await totpCode(secretOf(account), clock),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ next: 'done' });
    // The session moves on with a new token (it rotates at every step).
    expect(browser.cookies.get('quad_sid')).not.toBe(before);
    expect((await browser.get('/me')).statusCode).toBe(200);
  });

  it('asks for a school next when there are several', async () => {
    const { account, browser } = await atTwoStep({ schools: 2 });
    const response = await browser.post('/auth/totp/verify', {
      code: await totpCode(secretOf(account), clock),
    });
    expect(response.json()).toEqual({ next: 'choose_school' });
    expect((await browser.get('/auth/memberships')).statusCode).toBe(200);
  });

  it('accepts the code of the step before or after (±1 step), but not two steps away', async () => {
    const { account, browser } = await atTwoStep();
    const secret = secretOf(account);
    const twoStepsAgo = await totpCode(secret, clock - 2 * STEP);
    expect((await browser.post('/auth/totp/verify', { code: twoStepsAgo })).json()).toMatchObject({
      code: 'invalid_code',
    });
    const oneStepAgo = await totpCode(secret, clock - STEP);
    expect((await browser.post('/auth/totp/verify', { code: oneStepAgo })).statusCode).toBe(200);

    const next = await atTwoStep();
    const oneStepAhead = await totpCode(secretOf(next.account), clock + STEP);
    expect((await next.browser.post('/auth/totp/verify', { code: oneStepAhead })).statusCode).toBe(
      200,
    );
  });

  it('refuses a wrong code with 400 invalid_code, and counts it toward the lockout', async () => {
    const { account, browser } = await atTwoStep();
    const right = await totpCode(secretOf(account), clock);
    const wrong = right === '000000' ? '111111' : '000000';
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await browser.post('/auth/totp/verify', { code: wrong });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: 'invalid_code' });
    }
    const sixth = await browser.post('/auth/totp/verify', { code: right });
    expect(sixth.statusCode).toBe(403);
    expect(sixth.json()).toMatchObject({ code: 'account_locked' });
  });

  it('refuses the local fixed code when DEV_FIXED_OTP is not set', async () => {
    const { browser } = await atTwoStep();
    // The authenticator's real code is almost never 000000; a one-in-a-million clash is fine.
    const response = await browser.post('/auth/totp/verify', { code: '000000' });
    expect(response.statusCode).toBe(400);
  });

  it('accepts a recovery code once, and refuses it the second time', async () => {
    const { account, browser } = await atTwoStep({ recoveryCodes: ['abcde-fghjk', 'mnpqr-stvwx'] });
    const first = await browser.post('/auth/totp/verify', { recoveryCode: 'ABCDE FGHJK' });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual({ next: 'done' });

    const again = new Browser(app);
    await again.post('/auth/password', { email: account.email, password: account.password });
    const reused = await again.post('/auth/totp/verify', { recoveryCode: 'abcde-fghjk' });
    expect(reused.statusCode).toBe(400);
    expect(reused.json()).toMatchObject({ code: 'invalid_code' });
    expect(
      (await again.post('/auth/totp/verify', { recoveryCode: 'mnpqr-stvwx' })).statusCode,
    ).toBe(200);
  });

  it('trusts the device for 30 days when asked, so the next sign-in skips the code', async () => {
    const { account, browser } = await atTwoStep();
    const response = await browser.post('/auth/totp/verify', {
      code: await totpCode(secretOf(account), clock),
      trustDevice: true,
    });
    const trusted = setCookie(response, 'quad_trusted');
    expect(trusted).toMatchObject({ httpOnly: true, maxAge: 30 * 24 * 60 * 60 });
    const { rows } = await db().platform.query<{ count: string }>(
      'select count(*) from trusted_devices where account_id = $1',
      [account.id],
    );
    expect(rows[0]?.count).toBe('1');

    // Signed out, then back in on the same device: no code this time.
    const sameDevice = new Browser(app);
    sameDevice.cookies.set('quad_trusted', browser.cookies.get('quad_trusted') ?? '');
    const again = await sameDevice.post('/auth/password', {
      email: account.email,
      password: account.password,
    });
    expect(again.json()).toEqual({ next: 'done' });
    // Another device still needs the code.
    const otherDevice = await new Browser(app).post('/auth/password', {
      email: account.email,
      password: account.password,
    });
    expect(otherDevice.json()).toEqual({ next: 'two_step' });
  });

  it("never lets another account's trusted-device cookie skip the code", async () => {
    const first = await atTwoStep();
    await first.browser.post('/auth/totp/verify', {
      code: await totpCode(secretOf(first.account), clock),
      trustDevice: true,
    });
    const other = await insertPasswordAccount(db(), { totp: true });
    const school = await insertSchool(db());
    await insertMember(db(), school.id, other.id);
    const browser = new Browser(app);
    browser.cookies.set('quad_trusted', first.browser.cookies.get('quad_trusted') ?? '');
    const response = await browser.post('/auth/password', {
      email: other.email,
      password: other.password,
    });
    expect(response.json()).toEqual({ next: 'two_step' });
  });

  it('refuses a code that was already accepted (RFC 6238 §5.2), even on a new sign-in', async () => {
    const { account, browser } = await atTwoStep();
    const code = await totpCode(secretOf(account), clock);
    expect((await browser.post('/auth/totp/verify', { code })).statusCode).toBe(200);

    const again = new Browser(app);
    await again.post('/auth/password', { email: account.email, password: account.password });
    const replayed = await again.post('/auth/totp/verify', { code });
    expect(replayed.statusCode).toBe(400);
    expect(replayed.json()).toMatchObject({ code: 'invalid_code' });
    // The next step's code is new, so it works.
    clock += STEP;
    const later = await again.post('/auth/totp/verify', {
      code: await totpCode(secretOf(account), clock),
    });
    expect(later.statusCode).toBe(200);
  });

  it('refuses the sign-in session 15 minutes after its last step (401)', async () => {
    const { account, browser } = await atTwoStep();
    clock += 15 * 60_000 - 1000;
    expect(
      (
        await browser.clone().post('/auth/totp/verify', {
          code: await totpCode(secretOf(account), clock),
        })
      ).statusCode,
    ).not.toBe(401);
    const late = await atTwoStep();
    clock += 15 * 60_000;
    const response = await late.browser.post('/auth/totp/verify', {
      code: await totpCode(secretOf(late.account), clock),
    });
    expect(response.statusCode).toBe(401);
  });

  it('answers 401 without a sign-in session, and at another stage', async () => {
    const none = await new Browser(app).post('/auth/totp/verify', { code: '123456' });
    expect(none.statusCode).toBe(401);

    const schoolA = await insertSchool(db());
    const schoolB = await insertSchool(db());
    const account = await insertPasswordAccount(db());
    await insertMember(db(), schoolA.id, account.id);
    await insertMember(db(), schoolB.id, account.id);
    const browser = new Browser(app);
    await browser.post('/auth/password', { email: account.email, password: account.password });
    expect((await browser.post('/auth/totp/verify', { code: '123456' })).statusCode).toBe(401);
  });

  it('answers 403 without the CSRF header (a sign-in step is a write too)', async () => {
    const { account, browser } = await atTwoStep();
    const response = await browser.post(
      '/auth/totp/verify',
      { code: await totpCode(secretOf(account), clock) },
      { csrf: false },
    );
    expect(response.statusCode).toBe(403);
  });

  it.each([{}, { code: '12345' }, { code: '123456', recoveryCode: 'abcde-fghjk' }])(
    'answers 400 validation for %j',
    async (body) => {
      const { browser } = await atTwoStep();
      const response = await browser.post('/auth/totp/verify', body);
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: 'validation' });
    },
  );

  it("never accepts account A's code on account B's session", async () => {
    const a = await atTwoStep();
    const b = await atTwoStep();
    const response = await b.browser.post('/auth/totp/verify', {
      code: await totpCode(secretOf(a.account), clock),
    });
    expect(response.statusCode).toBe(400);
  });
});

describe('POST /me/totp (set up an authenticator)', () => {
  async function atSetup(schools = 1): Promise<{ account: PasswordAccount; browser: Browser }> {
    const account = await insertPasswordAccount(db());
    for (let count = 0; count < schools; count += 1) {
      const school = await insertSchool(db());
      await setSignInRules(db(), school.id, { twoStep: 'staff' });
      await insertMember(db(), school.id, account.id);
    }
    const browser = new Browser(app);
    const response = await browser.post('/auth/password', {
      email: account.email,
      password: account.password,
    });
    expect(response.json()).toEqual({ next: 'two_step_setup' });
    return { account, browser };
  }

  const secretFrom = (otpauthUri: string): string => {
    const secret = new URL(otpauthUri).searchParams.get('secret');
    if (secret === null) throw new Error('The URI has no secret.');
    return secret;
  };

  it('starts with an otpauth URI, then confirms with a code and gives 10 recovery codes', async () => {
    const { account, browser } = await atSetup();
    const start = await browser.post('/me/totp', {});
    expect(start.statusCode).toBe(200);
    const started = TotpSetupResult.parse(start.json());
    expect(started.otpauthUri).toMatch(/^otpauth:\/\/totp\//);
    expect(started.recoveryCodes).toBeNull();
    const secret = secretFrom(started.otpauthUri ?? '');

    // The secret is stored encrypted with the field cipher, never as is.
    const { rows } = await db().platform.query<{ totp_secret_enc: string; totp_enabled: boolean }>(
      'select totp_secret_enc, totp_enabled from credentials where account_id = $1',
      [account.id],
    );
    expect(rows[0]?.totp_enabled).toBe(false);
    expect(rows[0]?.totp_secret_enc).not.toContain(secret);
    expect(await cipher.decrypt(rows[0]?.totp_secret_enc ?? '')).toBe(secret);

    const confirm = await browser.post('/me/totp', { code: await totpCode(secret, clock) });
    expect(confirm.statusCode).toBe(200);
    const confirmed = TotpSetupResult.parse(confirm.json());
    expect(confirmed.recoveryCodes).toHaveLength(10);
    expect(new Set(confirmed.recoveryCodes).size).toBe(10);
    expect(confirmed.next).toBe('done');
    expect((await browser.get('/me')).statusCode).toBe(200);

    const after = await db().platform.query<{ totp_enabled: boolean; n: number }>(
      'select totp_enabled, cardinality(recovery_codes_hash) as n from credentials where account_id = $1',
      [account.id],
    );
    expect(after.rows[0]).toEqual({ totp_enabled: true, n: 10 });
    const audits = (await auditRows(db(), 'auth.two_step_enabled')).filter(
      (row) => row.target_id === account.id,
    );
    expect(audits).toHaveLength(1);
  });

  it('never accepts the confirming code again at the code step (replay)', async () => {
    const { account, browser } = await atSetup(2);
    const started = TotpSetupResult.parse((await browser.post('/me/totp', {})).json());
    const code = await totpCode(secretFrom(started.otpauthUri ?? ''), clock);
    expect((await browser.post('/me/totp', { code })).statusCode).toBe(200);
    const again = new Browser(app);
    await again.post('/auth/password', { email: account.email, password: account.password });
    expect((await again.post('/auth/totp/verify', { code })).statusCode).toBe(400);
  });

  it('refuses a code from another secret with 400 invalid_code', async () => {
    const { browser } = await atSetup();
    await browser.post('/me/totp', {});
    const response = await browser.post('/me/totp', {
      code: await totpCode(generateSecret(), clock),
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'invalid_code' });
  });

  it('refuses a confirm before a start', async () => {
    const { browser } = await atSetup();
    const response = await browser.post('/me/totp', { code: '123456' });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'invalid_code' });
  });

  it('is refused (401) at stage choose_school', async () => {
    const schoolA = await insertSchool(db());
    const schoolB = await insertSchool(db());
    const account = await insertPasswordAccount(db());
    await insertMember(db(), schoolA.id, account.id);
    await insertMember(db(), schoolB.id, account.id);
    const browser = new Browser(app);
    await browser.post('/auth/password', { email: account.email, password: account.password });
    expect((await browser.post('/me/totp', {})).statusCode).toBe(401);
  });

  it('lets a signed-in person add an authenticator, and refuses replacing one with 409', async () => {
    const school = await insertSchool(db());
    const account = await insertPasswordAccount(db());
    await insertMember(db(), school.id, account.id);
    const browser = new Browser(app);
    await browser.post('/auth/password', { email: account.email, password: account.password });
    const started = TotpSetupResult.parse((await browser.post('/me/totp', {})).json());
    const secret = secretFrom(started.otpauthUri ?? '');
    const confirmed = TotpSetupResult.parse(
      (await browser.post('/me/totp', { code: await totpCode(secret, clock) })).json(),
    );
    expect(confirmed.next).toBeNull();
    const again = await browser.post('/me/totp', {});
    expect(again.statusCode).toBe(409);
  });

  it('answers 400 validation for a malformed code', async () => {
    const { browser } = await atSetup();
    const response = await browser.post('/me/totp', { code: '12' });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: 'validation',
      fields: { code: anyText() },
    });
  });

  it("never confirms with another account's pending secret", async () => {
    const a = await atSetup();
    const b = await atSetup();
    const startedA = TotpSetupResult.parse((await a.browser.post('/me/totp', {})).json());
    await b.browser.post('/me/totp', {});
    const response = await b.browser.post('/me/totp', {
      code: await totpCode(secretFrom(startedA.otpauthUri ?? ''), clock),
    });
    expect(response.statusCode).toBe(400);
  });
});

describe('DEV_FIXED_OTP (local and staging only)', () => {
  const fixed = useDatabaseApp({ DEV_FIXED_OTP: '000000' }, { overrides: { now: () => clock } });

  it('accepts the fixed code when it is set', async () => {
    const account = await insertPasswordAccount(fixed.db(), { totp: true });
    const school = await insertSchool(fixed.db());
    await insertMember(fixed.db(), school.id, account.id);
    const browser = new Browser(fixed.app);
    await browser.post('/auth/password', { email: account.email, password: account.password });
    const response = await browser.post('/auth/totp/verify', { code: '000000' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ next: 'done' });
  });
});
