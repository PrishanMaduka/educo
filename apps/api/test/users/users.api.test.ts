import { StaffList, StaffMember } from '@quad/contracts';
import { describe, expect, it } from 'vitest';

import { RecordingDelivery } from '../fakes/delivery';
import { RecordingOtpSends } from '../fakes/otp-sends';
import { auditEntries, insertCustomRole, setPreview } from '../helpers/access';
import { Browser } from '../helpers/browser';
import { useDatabaseApp } from '../helpers/database-app';
import {
  insertAccount,
  insertMember,
  insertPlatformUser,
  insertSupportVisit,
  insertWebSession,
  sessionHeaders,
} from '../helpers/identity';
import { insertParentMember, insertPhoneAccount } from '../helpers/parent';
import { GOOD_PASSWORD } from '../helpers/sign-in';
import {
  asStaff,
  linkTokenOf,
  schoolWithRoles,
  staffHolding,
  turnOnTwoStep,
} from '../helpers/users';

import type { RolesSchool, StaffSeed } from '../helpers/users';

const delivery = new RecordingDelivery();
const otpSends = new RecordingOtpSends(delivery);
const { db, app } = useDatabaseApp({}, { overrides: { delivery, otpSends } });

const as = (member: Pick<StaffSeed, 'session'>) => asStaff(app, member.session);

/** A school with an admin and a teacher (who has signed in before). */
async function arrange() {
  const school = await schoolWithRoles(db());
  const admin = await staffHolding(db(), school, school.roles.admin, { name: 'Prishan Maduka' });
  const teacher = await staffHolding(db(), school, school.roles.teacher, {
    name: 'Nadeesha Jayasinghe',
  });
  await db().platform.query(
    `update users set last_sign_in_at = '2026-10-08T08:05:00Z' where id = $1`,
    [teacher.userId],
  );
  return { school, admin, teacher };
}

async function memberRow(userId: string) {
  const { rows } = await db().platform.query<{ status: string; role_ids: string[] }>(
    `select u.status,
            coalesce(array_agg(ur.role_id) filter (where ur.role_id is not null), '{}') as role_ids
     from users u left join user_roles ur on ur.user_id = u.id where u.id = $1 group by u.status`,
    [userId],
  );
  return rows[0];
}

async function revoked(sessionId: string): Promise<boolean> {
  const { rows } = await db().platform.query<{ revoked: boolean }>(
    'select revoked_at is not null as revoked from sessions where id = $1',
    [sessionId],
  );
  return rows[0]?.revoked === true;
}

async function insertMobileFamily(accountId: string, tenantId: string, userId: string) {
  const { rows } = await db().platform.query<{ id: string }>(
    `insert into sessions (account_id, active_tenant_id, active_user_id, kind, stage, refresh_hash,
                           expires_at)
     values ($1, $2, $3, 'mobile', 'active', '\\x01', now() + interval '1 day') returning id`,
    [accountId, tenantId, userId],
  );
  const id = rows[0]?.id;
  if (id === undefined) throw new Error('No family row.');
  return id;
}

/** A member who manages users (settings.edit) but holds no sensitive key. */
async function keylessManager(school: RolesSchool) {
  const role = await insertCustomRole(db(), school.id, { matrix: { settings: '11111' } });
  return staffHolding(db(), school, role);
}

const auditIn = async (action: string, tenantId: string) =>
  (await auditEntries(db(), action)).filter((row) => row.tenant_id === tenantId);

describe('GET /users', () => {
  it('lists the staff with role, status, two-step and last sign-in, and the story summary', async () => {
    const { school, admin, teacher } = await arrange();
    await turnOnTwoStep(db(), admin.accountId);
    const invitedId = await insertMember(db(), school.id, await insertAccount(db()), {
      status: 'invited',
      name: 'Amaya Perera',
    });
    const parent = await insertPhoneAccount(db());
    await insertParentMember(db(), school.id, parent.id, 'guardian');

    const response = await as(admin)('GET', '/users');

    expect(response.statusCode).toBe(200);
    const list = StaffList.parse(response.json());
    expect(list.items.map((item) => item.name)).toEqual([
      'Amaya Perera',
      'Nadeesha Jayasinghe',
      'Prishan Maduka',
    ]);
    expect(list.items.find((item) => item.id === teacher.userId)).toEqual({
      id: teacher.userId,
      name: 'Nadeesha Jayasinghe',
      email: teacher.email,
      status: 'active',
      role: { id: school.roles.teacher, name: 'Teacher' },
      twoStepOn: false,
      lastSignInAt: '2026-10-08T08:05:00.000Z',
      inviteSentAt: null,
      you: false,
    });
    expect(list.items.find((item) => item.id === admin.userId)).toMatchObject({
      twoStepOn: true,
      you: true,
    });
    expect(list.items.find((item) => item.id === invitedId)).toMatchObject({
      status: 'invited',
      role: null,
    });
    // Two active and one invited; the teacher is the active one without two-step.
    expect(list.summary).toEqual({ staff: 3, withoutTwoStep: 1 });
    expect(list.nextCursor).toBeNull();
  });

  it('filters by status, role and search, and pages with a cursor', async () => {
    const { school, admin, teacher } = await arrange();
    const deactivated = await staffHolding(db(), school, school.roles.teacher, {
      name: 'Kamal Silva',
    });
    await db().platform.query(`update users set status = 'deactivated' where id = $1`, [
      deactivated.userId,
    ]);
    const ids = async (url: string) =>
      StaffList.parse((await as(admin)('GET', url)).json()).items.map((item) => item.id);

    expect(await ids('/users?status=deactivated')).toEqual([deactivated.userId]);
    expect(await ids(`/users?roleId=${school.roles.teacher}&status=active`)).toEqual([
      teacher.userId,
    ]);
    expect(await ids('/users?q=nadee')).toEqual([teacher.userId]);
    expect(await ids(`/users?q=${encodeURIComponent(teacher.email.slice(0, 12))}`)).toEqual([
      teacher.userId,
    ]);
    // A wildcard in the search is matched literally.
    expect(await ids('/users?q=%25')).toEqual([]);

    const first = StaffList.parse((await as(admin)('GET', '/users?limit=2')).json());
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();
    const rest = StaffList.parse(
      (await as(admin)('GET', `/users?limit=2&cursor=${first.nextCursor ?? ''}`)).json(),
    );
    expect(rest.items.map((item) => item.name)).toEqual(['Prishan Maduka']);
    expect(rest.nextCursor).toBeNull();
  });

  it.each([['?status=gone'], ['?limit=500'], ['?roleId=x'], ['?cursor=not-a-cursor']])(
    'answers 400 validation for %s',
    async (query) => {
      const { admin } = await arrange();
      const response = await as(admin)('GET', `/users${query}`);
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: 'validation' });
    },
  );

  it('answers 403 forbidden to a teacher, and to an admin previewing the teacher role', async () => {
    const { school, admin, teacher } = await arrange();
    expect((await as(teacher)('GET', '/users')).json()).toMatchObject({ code: 'forbidden' });
    await setPreview(db(), admin.session.id, school.roles.teacher, teacher.userId);
    const previewing = await as(admin)('GET', '/users');
    expect(previewing.statusCode).toBe(403);
    expect(previewing.json()).toMatchObject({ code: 'forbidden' });
  });

  it("never lists another school's staff", async () => {
    const a = await arrange();
    const b = await arrange();
    const ids = StaffList.parse((await as(b.admin)('GET', '/users')).json()).items.map(
      (item) => item.id,
    );
    expect(ids.sort()).toEqual([b.admin.userId, b.teacher.userId].sort());
    expect(ids).not.toContain(a.teacher.userId);
  });
});

describe('PATCH /users/:id', () => {
  it("changes a member's role: audited, seen on their next request, and their preview ends", async () => {
    const { school, admin } = await arrange();
    const other = await staffHolding(db(), school, school.roles.admin);
    await setPreview(db(), other.session.id, school.roles.finance);
    expect((await as(other)('GET', '/me/permissions')).json()).toMatchObject({
      preview: { roleId: school.roles.finance },
    });

    const response = await as(admin)('PATCH', `/users/${other.userId}`, {
      roleId: school.roles.teacher,
    });

    expect(response.statusCode).toBe(200);
    expect(StaffMember.parse(response.json())).toMatchObject({
      id: other.userId,
      role: { id: school.roles.teacher, name: 'Teacher' },
    });
    expect((await memberRow(other.userId))?.role_ids).toEqual([school.roles.teacher]);
    const permissions = (await as(other)('GET', '/me/permissions')).json<{
      keys: string[];
      preview: unknown;
    }>();
    expect(permissions.preview).toBeNull();
    expect(permissions.keys).not.toContain('users.manage');
    expect(await auditIn('user.role_changed', school.id)).toEqual([
      expect.objectContaining({
        actor_user_id: admin.userId,
        target_type: 'user',
        target_id: other.userId,
        meta: { from: [school.roles.admin], to: school.roles.teacher },
      }),
    ]);
  });

  it("deactivates a member: this school's sessions and refresh families end, another school's stay", async () => {
    const { school, admin, teacher } = await arrange();
    const elsewhere = await schoolWithRoles(db());
    const inElsewhere = await staffHolding(db(), elsewhere, elsewhere.roles.teacher, {
      accountId: teacher.accountId,
    });
    const family = await insertMobileFamily(teacher.accountId, school.id, teacher.userId);
    expect((await as(teacher)('GET', '/me')).statusCode).toBe(200);

    const response = await as(admin)('PATCH', `/users/${teacher.userId}`, {
      status: 'deactivated',
    });

    expect(response.statusCode).toBe(200);
    expect(StaffMember.parse(response.json()).status).toBe('deactivated');
    expect((await as(teacher)('GET', '/me')).statusCode).toBe(401);
    expect(await revoked(teacher.session.id)).toBe(true);
    expect(await revoked(family)).toBe(true);
    expect(await revoked(inElsewhere.session.id)).toBe(false);
    expect((await as(inElsewhere)('GET', '/me')).statusCode).toBe(200);
    expect(await auditIn('user.deactivated', school.id)).toEqual([
      expect.objectContaining({ actor_user_id: admin.userId, target_id: teacher.userId }),
    ]);
  });

  it('reactivates a deactivated member, audited', async () => {
    const { school, admin, teacher } = await arrange();
    await db().platform.query(`update users set status = 'deactivated' where id = $1`, [
      teacher.userId,
    ]);
    const response = await as(admin)('PATCH', `/users/${teacher.userId}`, { status: 'active' });
    expect(response.statusCode).toBe(200);
    expect((await memberRow(teacher.userId))?.status).toBe('active');
    expect(await auditIn('user.reactivated', school.id)).toHaveLength(1);
  });

  it.each([[{}], [{ status: 'invited' }], [{ roleId: 'x' }], [{ name: 'Someone' }]])(
    'answers 400 validation for %j',
    async (body) => {
      const { admin, teacher } = await arrange();
      const response = await as(admin)('PATCH', `/users/${teacher.userId}`, body);
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: 'validation' });
    },
  );

  it('answers 400 validation for an id that is not a uuid', async () => {
    const { admin } = await arrange();
    const response = await as(admin)('PATCH', '/users/42', { status: 'deactivated' });
    expect(response.statusCode).toBe(400);
  });

  it('answers 403 forbidden to a teacher and preview_read_only to a previewing admin', async () => {
    const { school, admin, teacher } = await arrange();
    const other = await staffHolding(db(), school, school.roles.frontdesk);
    const body = { status: 'deactivated' };
    expect((await as(teacher)('PATCH', `/users/${other.userId}`, body)).json()).toMatchObject({
      code: 'forbidden',
    });
    await setPreview(db(), admin.session.id, school.roles.finance);
    expect((await as(admin)('PATCH', `/users/${other.userId}`, body)).json()).toMatchObject({
      code: 'preview_read_only',
    });
    expect((await memberRow(other.userId))?.status).toBe('active');
  });

  it("answers 404 for another school's member, and for another school's role", async () => {
    const a = await arrange();
    const b = await arrange();
    const theirs = await as(b.admin)('PATCH', `/users/${a.teacher.userId}`, {
      status: 'deactivated',
    });
    expect(theirs.statusCode).toBe(404);
    expect((await memberRow(a.teacher.userId))?.status).toBe('active');
    const theirRole = await as(a.admin)('PATCH', `/users/${a.teacher.userId}`, {
      roleId: b.school.roles.admin,
    });
    expect(theirRole.statusCode).toBe(404);
    expect((await memberRow(a.teacher.userId))?.role_ids).toEqual([a.school.roles.teacher]);
  });

  it('refuses changing your own role or deactivating yourself (422)', async () => {
    const { school, admin } = await arrange();
    await staffHolding(db(), school, school.roles.admin);
    for (const body of [{ roleId: school.roles.teacher }, { status: 'deactivated' }]) {
      const response = await as(admin)('PATCH', `/users/${admin.userId}`, body);
      expect(response.statusCode).toBe(422);
      expect(response.json()).toMatchObject({ code: 'business_rule' });
    }
    expect((await memberRow(admin.userId))?.role_ids).toEqual([school.roles.admin]);
  });

  it('refuses making an invited member active: they accept the invitation (422)', async () => {
    const { school, admin } = await arrange();
    const invited = await insertMember(db(), school.id, await insertAccount(db()), {
      status: 'invited',
    });
    const response = await as(admin)('PATCH', `/users/${invited}`, { status: 'active' });
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ code: 'business_rule' });
  });

  it('refuses demoting or deactivating the last active admin (422 last_admin), from a support visit', async () => {
    const { school, admin } = await arrange();
    const visit = await insertSupportVisit(
      db(),
      await insertPlatformUser(db(), 'Quad Support'),
      school.id,
    );
    for (const body of [{ roleId: school.roles.teacher }, { status: 'deactivated' }]) {
      const response = await asStaff(app, visit)('PATCH', `/users/${admin.userId}`, body);
      expect(response.statusCode).toBe(422);
      expect(response.json()).toMatchObject({ code: 'last_admin' });
    }
    // The positive control: with a second active admin, the demotion goes through.
    await staffHolding(db(), school, school.roles.admin);
    const demoted = await asStaff(app, visit)('PATCH', `/users/${admin.userId}`, {
      roleId: school.roles.teacher,
    });
    expect(demoted.statusCode).toBe(200);
  });

  it('keeps one admin when two admins demote each other at the same moment', async () => {
    const { school, admin } = await arrange();
    const second = await staffHolding(db(), school, school.roles.admin);
    const body = { roleId: school.roles.teacher };

    const results = await Promise.all([
      as(admin)('PATCH', `/users/${second.userId}`, body),
      as(second)('PATCH', `/users/${admin.userId}`, body),
    ]);

    // One goes through. The other is refused: 422 last_admin when it waited for the admin lock,
    // or 403 when its guard already saw its own demotion. Either way one admin remains.
    const [succeeded, refused] = results.map((response) => response.statusCode).sort();
    expect(succeeded).toBe(200);
    expect([403, 422]).toContain(refused);
    const { rows } = await db().platform.query<{ admins: string }>(
      `select count(*)::text as admins from user_roles where role_id = $1`,
      [school.roles.admin],
    );
    expect(rows[0]?.admins).toBe('1');
  });

  it('waits for a concurrent demotion and then refuses the last admin (the admin row lock)', async () => {
    const { school, admin } = await arrange();
    const second = await staffHolding(db(), school, school.roles.admin);
    const other = await db().platform.connect();
    let committed = false;
    try {
      // Another request, mid-flight: it holds the lock and has demoted `admin`, not yet committed.
      await other.query('begin');
      await other.query(`select id from roles where id = $1 for update`, [school.roles.admin]);
      await other.query(`update user_roles set role_id = $2 where user_id = $1`, [
        admin.userId,
        school.roles.teacher,
      ]);
      const pending = as(admin)('PATCH', `/users/${second.userId}`, {
        roleId: school.roles.teacher,
      });
      await waitForLockWaiter(await pidOf(other));
      await other.query('commit');
      committed = true;

      const response = await pending;
      expect(response.statusCode).toBe(422);
      expect(response.json()).toMatchObject({ code: 'last_admin' });
      expect((await memberRow(second.userId))?.role_ids).toEqual([school.roles.admin]);
    } finally {
      if (!committed) await other.query('rollback');
      other.release();
    }
  });

  it('puts a never-accepted invitation back to invited on reactivation, never active (I1)', async () => {
    const { school, admin } = await arrange();
    const invited = await as(admin)('POST', '/users/invite', {
      emails: [`invitee-${Date.now()}@example.test`],
      roleId: school.roles.teacher,
    });
    const id = StaffMember.parse(invited.json<{ items: unknown[] }>().items[0]).id;
    expect((await as(admin)('PATCH', `/users/${id}`, { status: 'deactivated' })).statusCode).toBe(
      200,
    );

    const back = await as(admin)('PATCH', `/users/${id}`, { status: 'active' });

    expect(back.statusCode).toBe(200);
    expect(StaffMember.parse(back.json()).status).toBe('invited');
    expect((await memberRow(id))?.status).toBe('invited');
    // It needs a new invitation: Resend applies again.
    expect((await as(admin)('POST', `/users/${id}/resend-invite`)).statusCode).toBe(202);
  });

  it('answers 404 when the new role is deleted while the change waits for it (M5)', async () => {
    const { school, admin, teacher } = await arrange();
    const doomed = await insertCustomRole(db(), school.id);
    const other = await db().platform.connect();
    let committed = false;
    try {
      await other.query('begin');
      await other.query('delete from roles where id = $1', [doomed]);
      const pending = as(admin)('PATCH', `/users/${teacher.userId}`, { roleId: doomed });
      await waitForLockWaiter(await pidOf(other));
      await other.query('commit');
      committed = true;
      const response = await pending;
      expect(response.statusCode).toBe(404);
      expect((await memberRow(teacher.userId))?.role_ids).toEqual([school.roles.teacher]);
    } finally {
      if (!committed) await other.query('rollback');
      other.release();
    }
  });

  it('refuses giving a role whose sensitive keys the admin lacks (403), but allows one without', async () => {
    const { school, teacher } = await arrange();
    const manager = await keylessManager(school);
    const refused = await as(manager)('PATCH', `/users/${teacher.userId}`, {
      roleId: school.roles.counsellor,
    });
    expect(refused.statusCode).toBe(403);
    expect(refused.json()).toMatchObject({ code: 'forbidden' });
    expect((await memberRow(teacher.userId))?.role_ids).toEqual([school.roles.teacher]);
    const allowed = await as(manager)('PATCH', `/users/${teacher.userId}`, {
      roleId: school.roles.frontdesk,
    });
    expect(allowed.statusCode).toBe(200);
  });
});

/**
 * Waits until a backend is blocked by `holder` (`pg_blocking_pids`): the API request has reached
 * the lock that connection holds. Nothing else on the server can satisfy it.
 */
async function waitForLockWaiter(holder: number): Promise<void> {
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

/** The backend pid of a held connection. */
async function pidOf(client: { query: (text: string) => Promise<{ rows: { pid: number }[] }> }) {
  const { rows } = await client.query('select pg_backend_pid() as pid');
  const pid = rows[0]?.pid;
  if (pid === undefined) throw new Error('No backend pid.');
  return pid;
}

describe('POST /users/:id/remind-two-step', () => {
  it('queues the reminder email from the school, audited (202)', async () => {
    const { school, admin, teacher } = await arrange();
    const response = await as(admin)('POST', `/users/${teacher.userId}/remind-two-step`);
    expect(response.statusCode).toBe(202);
    const sent = delivery.emails.filter(
      (email) => email.job.to === teacher.email && email.job.template === 'two_step_reminder',
    );
    expect(sent).toHaveLength(1);
    expect(sent[0]?.job).toMatchObject({ tenantId: school.id, school: { name: school.name } });
    expect(await auditIn('user.two_step_reminded', school.id)).toEqual([
      expect.objectContaining({ actor_user_id: admin.userId, target_id: teacher.userId }),
    ]);
  });

  it('answers 409 when two-step is already on, and 422 for an invited member', async () => {
    const { school, admin, teacher } = await arrange();
    await turnOnTwoStep(db(), teacher.accountId);
    const on = await as(admin)('POST', `/users/${teacher.userId}/remind-two-step`);
    expect(on.statusCode).toBe(409);
    expect(on.json()).toMatchObject({ code: 'conflict' });
    const invited = await insertMember(db(), school.id, await insertAccount(db()), {
      status: 'invited',
    });
    const notYet = await as(admin)('POST', `/users/${invited}/remind-two-step`);
    expect(notYet.statusCode).toBe(422);
  });

  it('answers 400 for a bad id, 403 to a teacher and while previewing, 404 across schools', async () => {
    const a = await arrange();
    const b = await arrange();
    expect((await as(a.admin)('POST', '/users/42/remind-two-step')).statusCode).toBe(400);
    expect(
      (await as(a.teacher)('POST', `/users/${a.admin.userId}/remind-two-step`)).json(),
    ).toMatchObject({
      code: 'forbidden',
    });
    await setPreview(db(), b.admin.session.id, b.school.roles.finance);
    expect(
      (await as(b.admin)('POST', `/users/${b.teacher.userId}/remind-two-step`)).json(),
    ).toMatchObject({
      code: 'preview_read_only',
    });
    expect(
      (await as(a.admin)('POST', `/users/${b.teacher.userId}/remind-two-step`)).statusCode,
    ).toBe(404);
  });
});

describe('POST /users/:id/reset-password', () => {
  it('queues a single-use reset link for this school that sets a new password (202)', async () => {
    const { school, admin, teacher } = await arrange();
    const response = await as(admin)('POST', `/users/${teacher.userId}/reset-password`);
    expect(response.statusCode).toBe(202);

    const token = linkTokenOf(delivery, teacher.email, 'password_reset');
    const [segment] = token.split('.');
    expect(JSON.parse(Buffer.from(segment ?? '', 'base64url').toString('utf8'))).toMatchObject({
      purpose: 'password_reset',
      tid: school.id,
      sub: teacher.accountId,
    });
    const reset = await new Browser(app).post('/auth/password/reset', {
      token,
      password: `${GOOD_PASSWORD} again`,
    });
    expect(reset.statusCode).toBe(204);
    expect(await auditIn('user.password_reset_sent', school.id)).toEqual([
      expect.objectContaining({ actor_user_id: admin.userId, target_id: teacher.userId }),
    ]);
  });

  it("sends the reset to the account's sign-in address, not the school's copy (M2)", async () => {
    const { admin, teacher } = await arrange();
    await db().platform.query(`update users set email = 'stale-copy@example.test' where id = $1`, [
      teacher.userId,
    ]);
    expect((await as(admin)('POST', `/users/${teacher.userId}/reset-password`)).statusCode).toBe(
      202,
    );
    expect(() => linkTokenOf(delivery, teacher.email, 'password_reset')).not.toThrow();
    expect(delivery.emails.filter((email) => email.job.to === 'stale-copy@example.test')).toEqual(
      [],
    );
  });

  it('answers 422 for a member who cannot sign in (invited)', async () => {
    const { school, admin } = await arrange();
    const invited = await insertMember(db(), school.id, await insertAccount(db()), {
      status: 'invited',
    });
    expect((await as(admin)('POST', `/users/${invited}/reset-password`)).statusCode).toBe(422);
  });

  it('answers 400 for a bad id, 403 to a teacher and while previewing, 404 across schools', async () => {
    const a = await arrange();
    const b = await arrange();
    expect((await as(a.admin)('POST', '/users/42/reset-password')).statusCode).toBe(400);
    expect(
      (await as(a.teacher)('POST', `/users/${a.admin.userId}/reset-password`)).json(),
    ).toMatchObject({
      code: 'forbidden',
    });
    await setPreview(db(), b.admin.session.id, b.school.roles.finance);
    expect(
      (await as(b.admin)('POST', `/users/${b.teacher.userId}/reset-password`)).json(),
    ).toMatchObject({
      code: 'preview_read_only',
    });
    const across = await as(a.admin)('POST', `/users/${b.teacher.userId}/reset-password`);
    expect(across.statusCode).toBe(404);
    expect(delivery.emails.filter((email) => email.job.to === b.teacher.email)).toEqual([]);
  });
});

/** Trusts a new device for the account ("Trust this device for 30 days"); its id. */
async function trustDevice(accountId: string): Promise<string> {
  const { rows } = await db().platform.query<{ id: string }>(
    `insert into trusted_devices (account_id, token_hash, expires_at)
     values ($1, decode(md5(random()::text), 'hex'), now() + interval '30 days') returning id`,
    [accountId],
  );
  return rows[0]?.id ?? '';
}

async function trustedRevoked(id: string): Promise<boolean> {
  const { rows } = await db().platform.query<{ revoked: boolean }>(
    'select revoked_at is not null as revoked from trusted_devices where id = $1',
    [id],
  );
  return rows[0]?.revoked ?? false;
}

describe('POST /users/:id/sign-out-everywhere', () => {
  it("also forgets every trusted device of the member's account, so two-step is asked again (D53)", async () => {
    const { admin, teacher } = await arrange();
    const other = await arrange();
    const laptop = await trustDevice(teacher.accountId);
    const phone = await trustDevice(teacher.accountId);
    const someoneElses = await trustDevice(other.teacher.accountId);

    const response = await as(admin)('POST', `/users/${teacher.userId}/sign-out-everywhere`);

    expect(response.statusCode).toBe(204);
    expect(await trustedRevoked(laptop)).toBe(true);
    expect(await trustedRevoked(phone)).toBe(true);
    expect(await trustedRevoked(someoneElses)).toBe(false);
  });

  it("leaves another school's member's trusted devices alone (404 across schools)", async () => {
    const a = await arrange();
    const b = await arrange();
    const device = await trustDevice(b.teacher.accountId);
    expect(
      (await as(a.admin)('POST', `/users/${b.teacher.userId}/sign-out-everywhere`)).statusCode,
    ).toBe(404);
    expect(await trustedRevoked(device)).toBe(false);
  });

  it("ends the member's sessions in this school only (OQ10), audited (204)", async () => {
    const { school, admin, teacher } = await arrange();
    const elsewhere = await schoolWithRoles(db());
    const inElsewhere = await staffHolding(db(), elsewhere, elsewhere.roles.teacher, {
      accountId: teacher.accountId,
    });
    const secondDevice = await insertWebSession(db(), teacher.accountId, {
      tenantId: school.id,
      userId: teacher.userId,
    });
    expect((await as(teacher)('GET', '/me')).statusCode).toBe(200);

    const response = await as(admin)('POST', `/users/${teacher.userId}/sign-out-everywhere`);

    expect(response.statusCode).toBe(204);
    expect((await as(teacher)('GET', '/me')).statusCode).toBe(401);
    expect(
      (await new Browser(app).get('/me', { headers: sessionHeaders(secondDevice) })).statusCode,
    ).toBe(401);
    expect((await as(inElsewhere)('GET', '/me')).statusCode).toBe(200);
    expect((await memberRow(teacher.userId))?.status).toBe('active');
    expect(await auditIn('user.signed_out_everywhere', school.id)).toEqual([
      expect.objectContaining({ actor_user_id: admin.userId, target_id: teacher.userId }),
    ]);
  });

  it('answers 400 for a bad id, 403 to a teacher and while previewing, 404 across schools', async () => {
    const a = await arrange();
    const b = await arrange();
    expect((await as(a.admin)('POST', '/users/42/sign-out-everywhere')).statusCode).toBe(400);
    expect(
      (await as(a.teacher)('POST', `/users/${a.admin.userId}/sign-out-everywhere`)).json(),
    ).toMatchObject({
      code: 'forbidden',
    });
    await setPreview(db(), b.admin.session.id, b.school.roles.finance);
    expect(
      (await as(b.admin)('POST', `/users/${b.teacher.userId}/sign-out-everywhere`)).json(),
    ).toMatchObject({
      code: 'preview_read_only',
    });
    expect(
      (await as(a.admin)('POST', `/users/${b.teacher.userId}/sign-out-everywhere`)).statusCode,
    ).toBe(404);
    expect(await revoked(b.teacher.session.id)).toBe(false);
  });
});
