import { InviteDetails, SignInResult, StaffInviteResult } from '@quad/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SignedLinks } from '../../src/common/crypto/signed-links';
import { AuthRepository } from '../../src/modules/auth/auth.repository';
import { localEnv } from '../env';
import { RecordingDelivery } from '../fakes/delivery';
import { RecordingOtpSends } from '../fakes/otp-sends';
import { auditEntries, insertCustomRole, setPreview } from '../helpers/access';
import { Browser } from '../helpers/browser';
import { useDatabaseApp } from '../helpers/database-app';
import { insertMember } from '../helpers/identity';
import {
  GOOD_PASSWORD,
  freshEmail,
  insertPasswordAccount,
  setSignInRules,
  totpCode,
} from '../helpers/sign-in';
import { asStaff, linkTokenOf, schoolWithRoles, staffHolding } from '../helpers/users';

import type { RolesSchool, StaffSeed } from '../helpers/users';

const NOW = Date.UTC(2026, 9, 8, 3, 30, 1);
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
let clock = NOW;
const delivery = new RecordingDelivery();
const otpSends = new RecordingOtpSends(delivery);
const { db, app } = useDatabaseApp({}, { overrides: { now: () => clock, delivery, otpSends } });

beforeEach(() => {
  clock = NOW;
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Waits until a backend is blocked by `holder` (`pg_blocking_pids`). */
async function waitForBlocked(holder: number): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const { rows } = await db().platform.query<{ waiting: string }>(
      'select count(*)::text as waiting from pg_stat_activity where $1 = any(pg_blocking_pids(pid))',
      [holder],
    );
    if (rows[0]?.waiting !== '0') return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('No request waited for the lock.');
}

/** Runs `arrange` in a held transaction, then `act` while it is held, then commits. */
async function whileHeld<T>(
  arrangeIn: (client: {
    query: (text: string, values?: unknown[]) => Promise<unknown>;
  }) => Promise<void>,
  act: () => Promise<T>,
): Promise<T> {
  const other = await db().platform.connect();
  let committed = false;
  try {
    await other.query('begin');
    await arrangeIn(other);
    const { rows } = await other.query<{ pid: number }>('select pg_backend_pid() as pid');
    const pending = act();
    await waitForBlocked(rows[0]?.pid ?? 0);
    await other.query('commit');
    committed = true;
    return await pending;
  } finally {
    if (!committed) await other.query('rollback');
    other.release();
  }
}

/** Signs links the way the API does, with the test secret; nonces are never recorded here. */
const links = new SignedLinks(localEnv().LINK_SIGNING_SECRET ?? '', () => Promise.resolve(true));

const as = (member: Pick<StaffSeed, 'session'>) => asStaff(app, member.session);

async function arrange() {
  const school = await schoolWithRoles(db());
  const admin = await staffHolding(db(), school, school.roles.admin, { name: 'Prishan Maduka' });
  const teacher = await staffHolding(db(), school, school.roles.teacher);
  return { school, admin, teacher };
}

async function invite(admin: StaffSeed, school: RolesSchool, emails: readonly string[]) {
  const response = await as(admin)('POST', '/users/invite', {
    emails,
    roleId: school.roles.teacher,
  });
  expect(response.statusCode).toBe(201);
  return StaffInviteResult.parse(response.json());
}

const details = (token: string) => new Browser(app).get(`/auth/invites/${token}`);
const accept = (token: string, body: unknown = {}, browser = new Browser(app)) =>
  browser.post(`/auth/invites/${token}/accept`, body);

async function membership(tenantId: string, email: string) {
  const { rows } = await db().platform.query<{
    id: string;
    account_id: string;
    status: string;
    name: string;
    invite_sent_at: Date | null;
  }>(
    `select u.id, u.account_id, u.status, u.name, u.invite_sent_at
     from users u join accounts a on a.id = u.account_id
     where u.tenant_id = $1 and a.email = $2`,
    [tenantId, email],
  );
  return rows;
}

/** An account with an email and no password (a parent's, say). */
async function insertAccountWithEmail(email: string) {
  const { rows } = await db().platform.query<{ id: string }>(
    `insert into accounts (email, status) values ($1, 'active') returning id`,
    [email],
  );
  return { id: rows[0]?.id ?? '', email };
}

async function accountsWith(email: string): Promise<number> {
  const { rows } = await db().platform.query<{ n: string }>(
    'select count(*)::text as n from accounts where email = $1',
    [email],
  );
  return Number(rows[0]?.n);
}

const auditIn = async (action: string, tenantId: string) =>
  (await auditEntries(db(), action)).filter((row) => row.tenant_id === tenantId);

describe('POST /users/invite', () => {
  it('invites new and existing accounts as one membership each, and queues the links (201)', async () => {
    const { school, admin } = await arrange();
    const elsewhere = await schoolWithRoles(db());
    const existing = await insertPasswordAccount(db());
    await insertMember(db(), elsewhere.id, existing.id);
    const fresh = freshEmail('colombo-intl.example');

    const result = await invite(admin, school, [fresh, existing.email.toUpperCase()]);

    expect(result.items.map((item) => [item.email, item.status, item.role?.id])).toEqual([
      [fresh, 'invited', school.roles.teacher],
      [existing.email, 'invited', school.roles.teacher],
    ]);
    expect(result.items[0]?.inviteSentAt).toBe(new Date(NOW).toISOString());
    expect(await accountsWith(existing.email)).toBe(1);
    expect(await accountsWith(fresh)).toBe(1);
    const [row] = await membership(school.id, existing.email);
    expect(row).toMatchObject({ account_id: existing.id, status: 'invited' });
    for (const email of [fresh, existing.email]) {
      const sent = delivery.emails.filter(
        (job) => job.job.to === email && job.job.template === 'staff_invite',
      );
      expect(sent).toHaveLength(1);
      expect(sent[0]?.job).toMatchObject({
        tenantId: school.id,
        school: { name: school.name },
        params: { inviter: 'Prishan Maduka', days: 7 },
      });
      expect(String(sent[0]?.job.params['link'])).toMatch(
        /^http:\/\/localhost:3000\/sign-in\/invite\/[\w-]+\.[\w-]+$/,
      );
    }
    expect(await auditIn('user.invited', school.id)).toHaveLength(2);
  });

  it('refuses the whole batch with already_member for an address already in the school (422)', async () => {
    const { school, admin, teacher } = await arrange();
    const fresh = freshEmail();

    const response = await as(admin)('POST', '/users/invite', {
      emails: [fresh, teacher.email],
      roleId: school.roles.teacher,
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      code: 'already_member',
      fields: { 'emails.1': expect.any(String) as unknown },
    });
    expect(await membership(school.id, fresh)).toEqual([]);
    expect(await accountsWith(fresh)).toBe(0);
  });

  it.each([
    [{ emails: [], roleId: '0192a6f4-1b2c-7d3e-8f40-123456789abd' }],
    [{ emails: ['nope'], roleId: '0192a6f4-1b2c-7d3e-8f40-123456789abd' }],
    [{ emails: ['a@b.example'] }],
  ])('answers 400 validation for %j', async (body) => {
    const { admin } = await arrange();
    const response = await as(admin)('POST', '/users/invite', body);
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'validation' });
  });

  it('answers 403 to a teacher, while previewing, and for a role with keys the admin lacks', async () => {
    const { school, admin, teacher } = await arrange();
    const fresh = freshEmail();
    const body = { emails: [fresh], roleId: school.roles.teacher };
    expect((await as(teacher)('POST', '/users/invite', body)).json()).toMatchObject({
      code: 'forbidden',
    });
    const managerRole = await insertCustomRole(db(), school.id, { matrix: { settings: '11111' } });
    const manager = await staffHolding(db(), school, managerRole);
    const counsellor = await as(manager)('POST', '/users/invite', {
      emails: [fresh],
      roleId: school.roles.counsellor,
    });
    expect(counsellor.statusCode).toBe(403);
    await setPreview(db(), admin.session.id, school.roles.finance);
    expect((await as(admin)('POST', '/users/invite', body)).json()).toMatchObject({
      code: 'preview_read_only',
    });
    expect(await accountsWith(fresh)).toBe(0);
  });

  it("answers 404 for another school's role", async () => {
    const a = await arrange();
    const b = await arrange();
    const fresh = freshEmail();
    const response = await as(a.admin)('POST', '/users/invite', {
      emails: [fresh],
      roleId: b.school.roles.teacher,
    });
    expect(response.statusCode).toBe(404);
    expect(await accountsWith(fresh)).toBe(0);
  });
});

describe('POST /users/invite races and re-invites (fix round 1, M5)', () => {
  it('answers 422 already_member when the same address is invited at the same moment', async () => {
    const { school, admin } = await arrange();
    const existing = await insertPasswordAccount(db());
    const response = await whileHeld(
      (client) =>
        client
          .query(
            `insert into users (tenant_id, account_id, kind, name, status) values ($1, $2, 'staff', 'Held', 'invited')`,
            [school.id, existing.id],
          )
          .then(() => undefined),
      () =>
        as(admin)('POST', '/users/invite', {
          emails: [existing.email],
          roleId: school.roles.teacher,
        }),
    );
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ code: 'already_member' });
  });

  it('answers 404 when the role is deleted while the invite waits for it', async () => {
    const { school, admin } = await arrange();
    const doomed = await insertCustomRole(db(), school.id);
    const fresh = freshEmail();
    const response = await whileHeld(
      (client) => client.query('delete from roles where id = $1', [doomed]).then(() => undefined),
      () => as(admin)('POST', '/users/invite', { emails: [fresh], roleId: doomed }),
    );
    expect(response.statusCode).toBe(404);
    expect(await accountsWith(fresh)).toBe(0);
  });

  it('invites a removed (soft-deleted) member again, as the same membership', async () => {
    const { school, admin } = await arrange();
    const existing = await insertPasswordAccount(db());
    const removed = await insertMember(db(), school.id, existing.id);
    await db().platform.query('update users set deleted_at = now() where id = $1', [removed]);

    const result = await invite(admin, school, [existing.email]);

    expect(result.items[0]).toMatchObject({ id: removed, status: 'invited' });
    const { rows } = await db().platform.query<{ deleted: boolean }>(
      'select deleted_at is not null as deleted from users where id = $1',
      [removed],
    );
    expect(rows[0]?.deleted).toBe(false);
  });
});

describe('POST /users/:id/resend-invite', () => {
  it('sends a new link and retires the old one (202)', async () => {
    const { school, admin } = await arrange();
    const fresh = freshEmail();
    const [member] = (await invite(admin, school, [fresh])).items;
    const oldToken = linkTokenOf(delivery, fresh, 'staff_invite');
    clock = NOW + 2 * MINUTE;

    const response = await as(admin)('POST', `/users/${member?.id ?? ''}/resend-invite`);

    expect(response.statusCode).toBe(202);
    const newToken = linkTokenOf(delivery, fresh, 'staff_invite');
    expect(newToken).not.toBe(oldToken);
    expect((await details(oldToken)).json()).toMatchObject({ code: 'invalid_link' });
    expect((await details(newToken)).statusCode).toBe(200);
    expect((await membership(school.id, fresh))[0]?.invite_sent_at?.getTime()).toBe(clock);
    expect(await auditIn('user.invited', school.id)).toHaveLength(2);
  });

  it('retires the old link even when the resend comes in the same second (M1)', async () => {
    const { school, admin } = await arrange();
    const fresh = freshEmail();
    const [member] = (await invite(admin, school, [fresh])).items;
    const oldToken = linkTokenOf(delivery, fresh, 'staff_invite');
    expect((await as(admin)('POST', `/users/${member?.id ?? ''}/resend-invite`)).statusCode).toBe(
      202,
    );
    const newToken = linkTokenOf(delivery, fresh, 'staff_invite');
    expect((await details(oldToken)).json()).toMatchObject({ code: 'invalid_link' });
    expect((await details(newToken)).statusCode).toBe(200);
  });

  it('answers 422 for a member who is not invited', async () => {
    const { admin, teacher } = await arrange();
    const response = await as(admin)('POST', `/users/${teacher.userId}/resend-invite`);
    expect(response.statusCode).toBe(422);
  });

  it('answers 400 for a bad id, 403 to a teacher and while previewing, 404 across schools', async () => {
    const a = await arrange();
    const b = await arrange();
    const [invited] = (await invite(b.admin, b.school, [freshEmail()])).items;
    const url = `/users/${invited?.id ?? ''}/resend-invite`;
    expect((await as(b.admin)('POST', '/users/42/resend-invite')).statusCode).toBe(400);
    expect((await as(b.teacher)('POST', url)).json()).toMatchObject({ code: 'forbidden' });
    expect((await as(a.admin)('POST', url)).statusCode).toBe(404);
    // A fresh admin, previewing before the session's first request (the session cache).
    const previewing = await staffHolding(db(), b.school, b.school.roles.admin);
    await setPreview(db(), previewing.session.id, b.school.roles.finance);
    expect((await as(previewing)('POST', url)).json()).toMatchObject({ code: 'preview_read_only' });
  });
});

describe('GET /auth/invites/:token', () => {
  it('shows the school, the name, the masked address and that a new account needs a password', async () => {
    const { school, admin } = await arrange();
    const domain = freshEmail().split('@')[0] ?? 'x';
    const fresh = `amaya.perera@${domain}.example`;
    await invite(admin, school, [fresh]);

    const response = await details(linkTokenOf(delivery, fresh, 'staff_invite'));

    expect(response.statusCode).toBe(200);
    // The name was made from the address, so it is left out (it would spell out the mask, M7).
    expect(InviteDetails.parse(response.json())).toEqual({
      school: school.name,
      emailMasked: `a•••@${domain}.example`,
      needsPassword: true,
    });
    const [row] = await membership(school.id, fresh);
    await db().platform.query(`update users set name = 'Amaya Perera-Silva' where id = $1`, [
      row?.id,
    ]);
    const named = await details(linkTokenOf(delivery, fresh, 'staff_invite'));
    expect(InviteDetails.parse(named.json()).name).toBe('Amaya Perera-Silva');
  });

  it('says an existing account needs no password (it signs in instead)', async () => {
    const { school, admin } = await arrange();
    const existing = await insertPasswordAccount(db());
    await invite(admin, school, [existing.email]);
    const response = await details(linkTokenOf(delivery, existing.email, 'staff_invite'));
    expect(InviteDetails.parse(response.json()).needsPassword).toBe(false);
  });

  it('answers 400 validation for a token longer than any link', async () => {
    const response = await details('a'.repeat(2049));
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'validation' });
  });

  it('refuses a tampered, expired, wrong-purpose or cancelled invite with invalid_link and no school name', async () => {
    const { school, admin } = await arrange();
    const fresh = freshEmail();
    const [member] = (await invite(admin, school, [fresh])).items;
    const token = linkTokenOf(delivery, fresh, 'staff_invite');
    const memberId = member?.id ?? '';
    const [segment, signature] = token.split('.');
    const tampered = `${segment ?? ''}.${(signature ?? '').slice(0, -2)}AA`;
    const wrongPurpose = links.signLink(
      { purpose: 'password_reset', tid: school.id, sub: memberId },
      new Date(NOW),
    );
    for (const bad of [tampered, wrongPurpose]) {
      const response = await details(bad);
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: 'invalid_link' });
      expect(response.body).not.toContain(school.name);
    }
    clock = NOW + 8 * DAY;
    expect((await details(token)).json()).toMatchObject({ code: 'invalid_link' });
    clock = NOW;
    await as(admin)('PATCH', `/users/${memberId}`, { status: 'deactivated' });
    expect((await details(token)).json()).toMatchObject({ code: 'invalid_link' });
  });

  it("never reaches another school's member: a signed token for A naming B's member is refused", async () => {
    const a = await arrange();
    const b = await arrange();
    const fresh = freshEmail();
    const [inB] = (await invite(b.admin, b.school, [fresh])).items;
    const crossed = links.signLink(
      { purpose: 'staff_invite', tid: a.school.id, sub: inB?.id ?? '' },
      new Date(NOW),
    );
    const response = await details(crossed);
    expect(response.json()).toMatchObject({ code: 'invalid_link' });
    expect(response.body).not.toContain(b.school.name);
    expect(response.body).not.toContain(a.school.name);
  });
});

describe('POST /auth/invites/:token/accept', () => {
  it('lets a new account choose its password and opens the school (OQ9), once', async () => {
    const { school, admin } = await arrange();
    const fresh = freshEmail();
    await invite(admin, school, [fresh]);
    const token = linkTokenOf(delivery, fresh, 'staff_invite');
    const browser = new Browser(app);

    const response = await accept(token, { password: GOOD_PASSWORD }, browser);

    expect(response.statusCode).toBe(200);
    expect(SignInResult.parse(response.json())).toEqual({ next: 'done' });
    const me = await browser.get('/me');
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({ school: { name: school.name } });
    expect((await membership(school.id, fresh))[0]?.status).toBe('active');
    const again = await accept(token, { password: GOOD_PASSWORD });
    expect(again.json()).toMatchObject({ code: 'invalid_link' });
    // The new password signs in.
    const signIn = await new Browser(app).post('/auth/password', {
      email: fresh,
      password: GOOD_PASSWORD,
    });
    expect(signIn.json()).toEqual({ next: 'done' });
  });

  it('sends a new account to set up two-step when the school requires it', async () => {
    const { school, admin } = await arrange();
    await setSignInRules(db(), school.id, { twoStep: 'staff' });
    const fresh = freshEmail();
    await invite(admin, school, [fresh]);
    const response = await accept(linkTokenOf(delivery, fresh, 'staff_invite'), {
      password: GOOD_PASSWORD,
    });
    expect(response.json()).toEqual({ next: 'two_step_setup' });
  });

  it('answers 400 for a weak, breached or missing password, and keeps the link usable', async () => {
    const { school, admin } = await arrange();
    const fresh = freshEmail();
    await invite(admin, school, [fresh]);
    const token = linkTokenOf(delivery, fresh, 'staff_invite');
    for (const body of [{ password: 'short' }, { password: 'password1234' }, {}]) {
      const response = await accept(token, body);
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        code: 'validation',
        fields: { password: expect.any(String) as unknown },
      });
    }
    expect((await accept(token, { password: GOOD_PASSWORD })).statusCode).toBe(200);
  });

  it('needs a signed-in session of the same account for an existing account', async () => {
    const { school, admin } = await arrange();
    const elsewhere = await schoolWithRoles(db());
    const existing = await insertPasswordAccount(db());
    await insertMember(db(), elsewhere.id, existing.id);
    await invite(admin, school, [existing.email]);
    const token = linkTokenOf(delivery, existing.email, 'staff_invite');

    const signedOut = await accept(token);
    expect(signedOut.statusCode).toBe(401);

    const someoneElse = new Browser(app);
    const other = await insertPasswordAccount(db());
    await insertMember(db(), elsewhere.id, other.id);
    await someoneElse.post('/auth/password', { email: other.email, password: other.password });
    const wrong = await accept(token, {}, someoneElse);
    expect(wrong.statusCode).toBe(403);
    expect(wrong.json()).toMatchObject({ code: 'forbidden' });

    const owner = new Browser(app);
    await owner.post('/auth/password', { email: existing.email, password: existing.password });
    const withoutCsrf = await owner.post(`/auth/invites/${token}/accept`, {}, { csrf: false });
    expect(withoutCsrf.statusCode).toBe(403);
    expect((await membership(school.id, existing.email))[0]?.status).toBe('invited');

    const accepted = await accept(token, {}, owner);
    expect(accepted.statusCode).toBe(200);
    // The session is active in its own school, and stays there (M8).
    expect(accepted.json()).toEqual({ next: 'done' });
    expect((await membership(school.id, existing.email))[0]?.status).toBe('active');
    const schools = (await owner.get('/auth/memberships')).json<{
      items: { tenantId: string }[];
    }>();
    expect(schools.items.map((item) => item.tenantId).sort()).toEqual(
      [school.id, elsewhere.id].sort(),
    );
    // Still in the school it was in: accepting never switches school by itself.
    expect((await owner.get('/me')).json()).toMatchObject({ school: { name: elsewhere.name } });
  });

  it('treats an existing account without a password as existing: no password is set from the link (I3)', async () => {
    const { school, admin } = await arrange();
    const elsewhere = await schoolWithRoles(db());
    const accountId = await insertAccountWithEmail(freshEmail());
    await insertMember(db(), elsewhere.id, accountId.id, { kind: 'guardian' });
    await invite(admin, school, [accountId.email]);
    const token = linkTokenOf(delivery, accountId.email, 'staff_invite');

    expect(InviteDetails.parse((await details(token)).json()).needsPassword).toBe(false);
    const refused = await accept(token, { password: GOOD_PASSWORD });
    expect(refused.statusCode).toBe(401);
    const { rows } = await db().platform.query<{ hash: string | null }>(
      'select password_hash as hash from credentials where account_id = $1',
      [accountId.id],
    );
    expect(rows[0]?.hash ?? null).toBeNull();
    expect((await membership(school.id, accountId.email))[0]?.status).toBe('invited');
  });

  it('never replaces a password that appeared after the link was checked (I3, password_hash IS NULL)', async () => {
    const { school, admin } = await arrange();
    const fresh = freshEmail();
    await invite(admin, school, [fresh]);
    const token = linkTokenOf(delivery, fresh, 'staff_invite');
    const [row] = await membership(school.id, fresh);
    // A password set meanwhile (a reset), which this accept read too early to see.
    await db().platform.query(
      `insert into credentials (account_id, password_hash) values ($1, 'kept-hash')`,
      [row?.account_id],
    );
    const repository = app().get(AuthRepository);
    const real = repository.credentials.bind(repository);
    vi.spyOn(repository, 'credentials').mockImplementation(async (accountId) => ({
      ...(await real(accountId)),
      passwordHash: null,
    }));

    const response = await accept(token, { password: GOOD_PASSWORD });

    expect(response.json()).toMatchObject({ code: 'invalid_link' });
    const { rows } = await db().platform.query<{ hash: string }>(
      'select password_hash as hash from credentials where account_id = $1',
      [row?.account_id],
    );
    expect(rows[0]?.hash).toBe('kept-hash');
  });

  it('audits user.invite_accepted on both paths (M4)', async () => {
    const { school, admin } = await arrange();
    const fresh = freshEmail();
    await invite(admin, school, [fresh]);
    await accept(linkTokenOf(delivery, fresh, 'staff_invite'), { password: GOOD_PASSWORD });
    const elsewhere = await schoolWithRoles(db());
    const existing = await insertPasswordAccount(db());
    await insertMember(db(), elsewhere.id, existing.id);
    await invite(admin, school, [existing.email]);
    const owner = new Browser(app);
    await owner.post('/auth/password', { email: existing.email, password: existing.password });
    await accept(linkTokenOf(delivery, existing.email, 'staff_invite'), {}, owner);

    const rows = await auditIn('user.invite_accepted', school.id);
    const ids = [
      (await membership(school.id, fresh))[0]?.id,
      (await membership(school.id, existing.email))[0]?.id,
    ];
    expect(rows.map((entry) => entry.target_id).sort()).toEqual([...ids].sort());
    expect(rows.every((entry) => entry.actor_user_id === entry.target_id)).toBe(true);
  });

  it("answers the session's real next step for an existing account: choose_school or done (M8)", async () => {
    const { school, admin } = await arrange();
    const a = await schoolWithRoles(db());
    const b = await schoolWithRoles(db());
    const existing = await insertPasswordAccount(db());
    await insertMember(db(), a.id, existing.id);
    await insertMember(db(), b.id, existing.id);
    await invite(admin, school, [existing.email]);
    const choosing = new Browser(app);
    expect(
      (
        await choosing.post('/auth/password', {
          email: existing.email,
          password: existing.password,
        })
      ).json(),
    ).toEqual({ next: 'choose_school' });
    expect(
      (await accept(linkTokenOf(delivery, existing.email, 'staff_invite'), {}, choosing)).json(),
    ).toEqual({ next: 'choose_school' });

    const other = await insertPasswordAccount(db());
    await insertMember(db(), a.id, other.id);
    await invite(admin, school, [other.email]);
    const active = new Browser(app);
    expect(
      (
        await active.post('/auth/password', { email: other.email, password: other.password })
      ).json(),
    ).toEqual({ next: 'done' });
    expect(
      (await accept(linkTokenOf(delivery, other.email, 'staff_invite'), {}, active)).json(),
    ).toEqual({ next: 'done' });
  });

  it("never activates anything in another school: a token for A naming B's member is refused", async () => {
    const a = await arrange();
    const b = await arrange();
    const fresh = freshEmail();
    const [inB] = (await invite(b.admin, b.school, [fresh])).items;
    const crossed = links.signLink(
      { purpose: 'staff_invite', tid: a.school.id, sub: inB?.id ?? '' },
      new Date(NOW),
    );
    const response = await accept(crossed, { password: GOOD_PASSWORD });
    expect(response.json()).toMatchObject({ code: 'invalid_link' });
    expect((await membership(b.school.id, fresh))[0]?.status).toBe('invited');
    expect(await membership(a.school.id, fresh)).toEqual([]);
  });
});

describe('signing in from the invite page (Task 13 fix round 1, I4: the token is only a hint)', () => {
  /** An account with a password and no school yet, invited to `school`. */
  async function invitedWithoutSchool(options: { readonly totp?: boolean } = {}) {
    const { school, admin } = await arrange();
    const account = await insertPasswordAccount(db(), options);
    await invite(admin, school, [account.email]);
    return { school, account, token: linkTokenOf(delivery, account.email, 'staff_invite') };
  }

  const signIn = (
    browser: Browser,
    account: { email: string; password: string },
    inviteToken?: string,
  ) =>
    browser.post('/auth/password', {
      email: account.email,
      password: account.password,
      ...(inviteToken === undefined ? {} : { inviteToken }),
    });

  it('reaches Choose a school instead of no school, then accepts and opens the school', async () => {
    const { school, account, token } = await invitedWithoutSchool();
    expect((await signIn(new Browser(app), account)).json()).toEqual({ next: 'no_school' });

    const browser = new Browser(app);
    expect((await signIn(browser, account, token)).json()).toEqual({ next: 'choose_school' });
    // The hint used nothing up: the link still works for the accept.
    expect((await accept(token, {}, browser)).json()).toEqual({ next: 'choose_school' });
    expect((await browser.post('/auth/select-school', { tenantId: school.id })).statusCode).toBe(
      204,
    );
    expect((await browser.get('/me')).json()).toMatchObject({ school: { name: school.name } });
  });

  it('carries the hint through the two-step code', async () => {
    const { account, token } = await invitedWithoutSchool({ totp: true });
    const browser = new Browser(app);
    expect((await signIn(browser, account, token)).json()).toEqual({ next: 'two_step' });
    const verify = await browser.post('/auth/totp/verify', {
      code: await totpCode(account.totpSecret ?? '', clock),
      inviteToken: token,
    });
    expect(verify.json()).toEqual({ next: 'choose_school' });
  });

  it("counts the invited school's two-step rule, and carries the hint through set-up", async () => {
    const { school, account, token } = await invitedWithoutSchool();
    await setSignInRules(db(), school.id, { twoStep: 'staff' });
    const browser = new Browser(app);
    expect((await signIn(browser, account, token)).json()).toEqual({ next: 'two_step_setup' });
    const started = await browser.post('/me/totp', {});
    const secret =
      new URL(started.json<{ otpauthUri: string }>().otpauthUri).searchParams.get('secret') ?? '';
    const confirmed = await browser.post('/me/totp', {
      code: await totpCode(secret, clock),
      inviteToken: token,
    });
    expect(confirmed.json()).toMatchObject({ next: 'choose_school' });
  });

  it('ignores a hint that is tampered with, or is another account’s invitation', async () => {
    const { account, token } = await invitedWithoutSchool();
    const other = await invitedWithoutSchool();
    const [segment, signature] = token.split('.');
    const tampered = `${segment ?? ''}.${(signature ?? '').slice(0, -2)}AA`;
    for (const hint of [tampered, other.token]) {
      expect((await signIn(new Browser(app), account, hint)).json()).toEqual({ next: 'no_school' });
    }
  });

  it('answers a wrong password with a hint exactly as without one (no enumeration)', async () => {
    const { account, token } = await invitedWithoutSchool();
    const wrong = { email: account.email, password: 'not the password at all' };
    const withHint = await signIn(new Browser(app), wrong, token);
    const without = await signIn(new Browser(app), wrong);
    expect(withHint.statusCode).toBe(401);
    expect(withHint.body).toBe(without.body);
  });
});

describe('switching to a school accepted mid-session re-checks two-step (fix round 1, I2)', () => {
  it('lands on two_step_setup when the accepted school requires two-step', async () => {
    const { school, admin } = await arrange();
    await setSignInRules(db(), school.id, { twoStep: 'staff' });
    const b = await schoolWithRoles(db());
    const account = await insertPasswordAccount(db());
    await insertMember(db(), b.id, account.id);
    await invite(admin, school, [account.email]);
    const browser = new Browser(app);
    expect(
      (
        await browser.post('/auth/password', { email: account.email, password: account.password })
      ).json(),
    ).toEqual({ next: 'done' });
    expect(
      (await accept(linkTokenOf(delivery, account.email, 'staff_invite'), {}, browser)).statusCode,
    ).toBe(200);

    const switched = await browser.post('/auth/select-school', { tenantId: school.id });

    expect(switched.statusCode).toBe(403);
    expect(switched.json()).toMatchObject({ code: 'two_step_required' });
    expect((await browser.get('/me')).statusCode).toBe(401);
    expect((await browser.post('/me/totp', {})).statusCode).toBe(200);
  });
});
