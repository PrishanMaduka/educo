import { MePermissions } from '@quad/contracts';
import { beforeEach, describe, expect, it } from 'vitest';

import { PermissionsService } from '../../src/common/access/permissions.service';
import { RecordingDelivery } from '../fakes/delivery';
import { RecordingOtpSends } from '../fakes/otp-sends';
import {
  assignRole,
  auditEntries,
  insertCustomRole,
  insertSystemRole,
  setPlanModules,
  setPreview,
  setRoleMatrix,
  suspendSchool,
  touchRole,
} from '../helpers/access';
import { Browser } from '../helpers/browser';
import { useDatabaseApp } from '../helpers/database-app';
import {
  insertPlatformUser,
  insertSchool,
  insertSupportVisit,
  sessionHeaders,
  signedInMember,
} from '../helpers/identity';
import { bearer, insertParentMember, insertPhoneAccount, signedInParent } from '../helpers/parent';

import { GuardsProbeModule } from './probe.module';

import type { CustomRole } from '../helpers/access';
import type { SchoolSeed, SessionSeed } from '../helpers/identity';
import type { PlanModule } from '@quad/contracts';

const NOW = Date.UTC(2026, 9, 9, 3, 30, 1);
let clock = NOW;
const delivery = new RecordingDelivery();
const otpSends = new RecordingOtpSends(delivery);
const { db, app } = useDatabaseApp(
  {},
  { overrides: { now: () => clock, delivery, otpSends, testModules: [GuardsProbeModule] } },
);

beforeEach(() => {
  clock = NOW;
});

const EVERY_MODULE: readonly PlanModule[] = [
  'admissions',
  'crm',
  'sis',
  'lms',
  'fees',
  'finance',
  'parent',
  'transport',
];

type Seed = Pick<SessionSeed, 'token' | 'csrf'>;
const as = (session: Seed, options: { readonly csrfHeader?: boolean } = {}) => ({
  get: (url: string) => new Browser(app).get(url, { headers: sessionHeaders(session, options) }),
  post: (url: string, body?: unknown) =>
    new Browser(app).post(url, body ?? {}, { headers: sessionHeaders(session, options) }),
  request: (method: 'PATCH' | 'DELETE' | 'POST', url: string, body?: unknown) =>
    new Browser(app).request(method, url, body, { headers: sessionHeaders(session, options) }),
});

async function school(modules: readonly PlanModule[] = EVERY_MODULE): Promise<SchoolSeed> {
  const seeded = await insertSchool(db());
  await setPlanModules(db(), seeded.id, modules);
  return seeded;
}

/** A staff member of `at` holding a custom role, signed in there. */
async function staffWith(at: SchoolSeed, role: CustomRole) {
  const member = await signedInMember(db(), at);
  const roleId = await insertCustomRole(db(), at.id, role);
  await assignRole(db(), at.id, member.userId, roleId);
  return { ...member, roleId };
}

/** A staff member of `at` holding a system role (`admin`, `teacher`, …), signed in there. */
async function staffAs(at: SchoolSeed, key: string) {
  const member = await signedInMember(db(), at);
  const roleId = await insertSystemRole(db(), at.id, key);
  await assignRole(db(), at.id, member.userId, roleId);
  return { ...member, roleId };
}

async function supportIn(at: SchoolSeed) {
  const staff = await insertPlatformUser(db(), 'Nimal from Quad');
  return { staff, visit: await insertSupportVisit(db(), staff, at.id) };
}

describe('@Can (spec 05: any of its keys)', () => {
  it('answers 401 without a session', async () => {
    const response = await new Browser(app).get('/probe/guards/fees');
    expect(response.statusCode).toBe(401);
  });

  it('answers 403 forbidden without the key, and 200 with it', async () => {
    const at = await school();
    const without = await staffWith(at, { matrix: { sis: '10000' } });
    const holder = await staffWith(at, { matrix: { fees: '10000' } });

    const refused = await as(without.session).get('/probe/guards/fees');
    expect(refused.statusCode).toBe(403);
    expect(refused.json()).toMatchObject({ code: 'forbidden' });
    expect((await as(holder.session).get('/probe/guards/fees')).statusCode).toBe(200);
  });

  it('passes with either of two keys, and refuses with neither', async () => {
    const at = await school();
    const fees = await staffWith(at, { matrix: { fees: '10000' } });
    const finance = await staffWith(at, { matrix: { finance: '10000' } });
    const neither = await staffWith(at, { matrix: { crm: '11111' } });

    expect((await as(fees.session).get('/probe/guards/money')).statusCode).toBe(200);
    expect((await as(finance.session).get('/probe/guards/money')).statusCode).toBe(200);
    expect((await as(neither.session).get('/probe/guards/money')).statusCode).toBe(403);
  });

  it('gives a system role its fixed defaults (a finance officer reads fees, a teacher does not)', async () => {
    const at = await school();
    const finance = await staffAs(at, 'finance');
    const teacher = await staffAs(at, 'teacher');

    expect((await as(finance.session).get('/probe/guards/fees')).statusCode).toBe(200);
    expect((await as(teacher.session).get('/probe/guards/fees')).statusCode).toBe(403);
  });

  it('drops a key whose module is not in the plan', async () => {
    const at = await school(['sis']);
    const finance = await staffAs(at, 'finance');
    expect((await as(finance.session).get('/probe/guards/fees')).statusCode).toBe(403);
  });

  it("never lets school B's role reach school A: the same person in two schools", async () => {
    const a = await school();
    const b = await school();
    const inB = await staffWith(b, { matrix: { fees: '10000' } });
    const inA = await signedInMember(db(), a, { accountId: inB.accountId });
    const roleInA = await insertCustomRole(db(), a.id, { matrix: { sis: '10000' } });
    await assignRole(db(), a.id, inA.userId, roleInA);

    expect((await as(inB.session).get('/probe/guards/fees')).statusCode).toBe(200);
    expect((await as(inA.session).get('/probe/guards/fees')).statusCode).toBe(403);
  });

  it('refuses a parent token on a staff route (guardians hold no staff role)', async () => {
    const at = await school();
    const account = await insertPhoneAccount(db());
    await insertParentMember(db(), at.id, account.id, 'guardian');
    const pair = await signedInParent(app, otpSends, account.phone);
    const response = await new Browser(app).get('/probe/guards/fees', {
      headers: bearer(pair.accessToken),
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'forbidden' });
  });

  it("reads a token's permissions from the current roles, never from its rh claim (D32)", async () => {
    const at = await school();
    const account = await insertPhoneAccount(db());
    const userId = await insertParentMember(db(), at.id, account.id, 'guardian');
    const roleId = await insertCustomRole(db(), at.id, { matrix: { fees: '10000' } });
    await assignRole(db(), at.id, userId, roleId);
    const pair = await signedInParent(app, otpSends, account.phone);
    const fees = () =>
      new Browser(app).get('/probe/guards/fees', { headers: bearer(pair.accessToken) });

    expect((await fees()).statusCode).toBe(200);
    await db().platform.query('delete from user_roles where user_id = $1', [userId]);
    // The token (and its roles hash) is unchanged and still valid; the grant is gone at once.
    const after = await fees();
    expect(after.statusCode).toBe(403);
    expect(after.json()).toMatchObject({ code: 'forbidden' });
  });
});

describe('@Module (spec 05, Plan and module guard)', () => {
  it('answers 403 module_not_in_plan when the plan lacks the module, even for the admin', async () => {
    const at = await school(['sis', 'fees']);
    const admin = await staffAs(at, 'admin');
    const response = await as(admin.session).get('/probe/guards/transport');
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'module_not_in_plan' });
  });

  it('lets the route through once the plan has it', async () => {
    const at = await school(['transport']);
    const admin = await staffAs(at, 'admin');
    expect((await as(admin.session).get('/probe/guards/transport')).statusCode).toBe(200);
  });

  it('still answers 403 forbidden when the module is in the plan but the role lacks the key', async () => {
    const at = await school(['transport']);
    const teacher = await staffAs(at, 'teacher');
    const response = await as(teacher.session).get('/probe/guards/transport');
    expect(response.json()).toMatchObject({ code: 'forbidden' });
  });
});

describe('a suspended school (spec 05: 403 school_suspended with the reason)', () => {
  const REASON = 'Your subscription is overdue. Call Quad on 011 000 0000.';

  it('refuses every staff route with the reason as the message', async () => {
    const at = await school();
    const admin = await staffAs(at, 'admin');
    await suspendSchool(db(), at.id, REASON);

    for (const url of ['/probe/guards/fees', '/me', '/me/permissions', '/me/sessions']) {
      const response = await as(admin.session).get(url);
      expect({ url, status: response.statusCode }).toEqual({ url, status: 403 });
      expect(response.json()).toEqual({ code: 'school_suspended', message: REASON });
    }
    const write = await as(admin.session).request('PATCH', '/me', { theme: 'dark' });
    expect(write.json()).toMatchObject({ code: 'school_suspended' });
  });

  it('uses the default copy when the console gave no reason', async () => {
    const at = await school();
    const admin = await staffAs(at, 'admin');
    await suspendSchool(db(), at.id, null);
    const response = await as(admin.session).get('/me');
    expect(response.json()).toMatchObject({
      code: 'school_suspended',
      message: expect.stringContaining('paused') as unknown,
    });
  });

  it('refuses a support visit too', async () => {
    const at = await school();
    const { visit } = await supportIn(at);
    await suspendSchool(db(), at.id, REASON);
    const response = await as(visit).get('/me');
    expect(response.json()).toMatchObject({ code: 'school_suspended' });
  });

  it("refuses a guardian's token with the reason, and still lets it sign out", async () => {
    const at = await school();
    const account = await insertPhoneAccount(db());
    await insertParentMember(db(), at.id, account.id, 'guardian');
    const pair = await signedInParent(app, otpSends, account.phone);
    await suspendSchool(db(), at.id, REASON);

    const me = await new Browser(app).get('/me', { headers: bearer(pair.accessToken) });
    expect(me.statusCode).toBe(403);
    expect(me.json()).toEqual({ code: 'school_suspended', message: REASON });
    const out = await new Browser(app).post('/auth/sign-out', undefined, {
      headers: bearer(pair.accessToken),
    });
    expect(out.statusCode).toBe(204);
  });

  it("lets a relative's token sign out, and keeps every other route at the relative 403", async () => {
    const at = await school();
    const account = await insertPhoneAccount(db());
    await insertParentMember(db(), at.id, account.id, 'relative', 'Sunil Perera');
    const pair = await signedInParent(app, otpSends, account.phone);
    await suspendSchool(db(), at.id, REASON);

    const me = await new Browser(app).get('/me', { headers: bearer(pair.accessToken) });
    expect(me.json()).toMatchObject({ code: 'forbidden' });
    const out = await new Browser(app).post('/auth/sign-out', undefined, {
      headers: bearer(pair.accessToken),
    });
    expect(out.statusCode).toBe(204);
  });

  it('lets staff sign out (POST /auth/sign-out), and the session is then gone', async () => {
    const at = await school();
    const admin = await staffAs(at, 'admin');
    await suspendSchool(db(), at.id, REASON);

    expect((await as(admin.session).post('/auth/sign-out')).statusCode).toBe(204);
    expect((await as(admin.session).get('/me')).statusCode).toBe(401);
  });

  it('leaves other schools of the same person alone', async () => {
    const a = await school();
    const b = await school();
    const inA = await staffAs(a, 'admin');
    const inB = await signedInMember(db(), b, { accountId: inA.accountId });
    await assignRole(db(), b.id, inB.userId, await insertSystemRole(db(), b.id, 'admin'));
    await suspendSchool(db(), a.id, REASON);

    expect((await as(inA.session).get('/me')).statusCode).toBe(403);
    expect((await as(inB.session).get('/me')).statusCode).toBe(200);
  });
});

describe('@Sensitive (spec 05: sensitive keys, every view logged; support never sees two)', () => {
  it('answers 403 without the key, and writes no audit row (with a holder as the positive control)', async () => {
    const at = await school();
    const without = await staffWith(at, { matrix: { sis: '10000' } });
    const holder = await staffWith(at, { matrix: { sis: '10000' }, sensitive: ['safeguarding'] });

    const refused = await as(without.session).get('/probe/guards/safeguarding');
    expect(refused.statusCode).toBe(403);
    expect(refused.json()).toMatchObject({ code: 'forbidden' });
    expect((await as(holder.session).get('/probe/guards/safeguarding')).statusCode).toBe(200);

    const rows = (await auditEntries(db(), 'sensitive.accessed')).filter(
      (row) => row.tenant_id === at.id,
    );
    expect(rows).toEqual([
      expect.objectContaining({
        actor_user_id: holder.userId,
        meta: {
          key: 'safeguarding',
          method: 'GET',
          route: '/api/v1/probe/guards/safeguarding',
        },
      }),
    ]);
  });

  it('writes one audit row per allowed view', async () => {
    const at = await school();
    const holder = await staffWith(at, { matrix: { sis: '10000' }, sensitive: ['medical'] });
    await as(holder.session).get('/probe/guards/medical');
    await as(holder.session).get('/probe/guards/medical');
    const rows = (await auditEntries(db(), 'sensitive.accessed')).filter(
      (row) => row.actor_user_id === holder.userId,
    );
    expect(rows).toHaveLength(2);
  });

  it('refuses a support visit safeguarding and medical, and lets it reach a key it holds (Accept)', async () => {
    const at = await school();
    const { staff, visit } = await supportIn(at);

    for (const url of ['/probe/guards/safeguarding', '/probe/guards/medical']) {
      const response = await as(visit).get(url);
      expect({ url, status: response.statusCode }).toEqual({ url, status: 403 });
      expect(response.json()).toMatchObject({ code: 'forbidden' });
    }
    // The positive control: the same visit passes @Can and a sensitive key support holds.
    expect((await as(visit).get('/probe/guards/export')).statusCode).toBe(200);

    const rows = (await auditEntries(db(), 'sensitive.accessed')).filter(
      (row) => row.tenant_id === at.id,
    );
    expect(rows).toEqual([
      expect.objectContaining({
        actor_platform_user_id: staff,
        meta: expect.objectContaining({ key: 'export_data' }) as unknown,
      }),
    ]);
  });

  it('a school admin, who holds all four keys, reaches safeguarding', async () => {
    const at = await school();
    const admin = await staffAs(at, 'admin');
    expect((await as(admin.session).get('/probe/guards/safeguarding')).statusCode).toBe(200);
  });
});

describe('Preview a role (spec 06: every non-GET is 403 preview_read_only)', () => {
  async function previewing(previewed: CustomRole = { matrix: { sis: '10000' } }) {
    const at = await school();
    const admin = await staffAs(at, 'admin');
    const roleId = await insertCustomRole(db(), at.id, previewed);
    await setPreview(db(), admin.session.id, roleId);
    return { at, admin, roleId };
  }

  it('refuses a write with 403 preview_read_only, and a GET acts as the previewed role', async () => {
    const { admin } = await previewing({ matrix: { sis: '10000' } });

    const write = await as(admin.session).post('/probe/guards/write');
    expect(write.statusCode).toBe(403);
    expect(write.json()).toMatchObject({ code: 'preview_read_only' });
    // The admin holds fees.view; the previewed role does not.
    expect((await as(admin.session).get('/probe/guards/fees')).statusCode).toBe(403);
  });

  it('checks CSRF first: a write without X-CSRF-Token gets the CSRF 403, not preview_read_only', async () => {
    const { admin } = await previewing();
    const response = await as(admin.session, { csrfHeader: false }).post('/probe/guards/write');
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'forbidden' });
  });

  it('refuses PATCH /me and POST /me/totp while previewing', async () => {
    const { admin } = await previewing();
    const patch = await as(admin.session).request('PATCH', '/me', { theme: 'dark' });
    expect(patch.json()).toMatchObject({ code: 'preview_read_only' });
    const totp = await as(admin.session).post('/me/totp', {});
    expect(totp.statusCode).toBe(403);
    expect(totp.json()).toMatchObject({ code: 'preview_read_only' });
  });

  it('GET /me shows the preview banner', async () => {
    const { admin, roleId } = await previewing({ name: 'Bursar', matrix: { fees: '10000' } });
    const response = await as(admin.session).get('/me');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      preview: { roleId, roleName: 'Bursar', sampleUser: null },
    });
  });

  it('still lets the admin end the preview and sign out', async () => {
    const { admin } = await previewing();
    expect((await as(admin.session).request('DELETE', '/me/role-preview')).statusCode).toBe(204);
    const { admin: other } = await previewing();
    expect((await as(other.session).post('/auth/sign-out')).statusCode).toBe(204);
  });

  it('never adds a sensitive key the admin does not hold (end to end)', async () => {
    const at = await school();
    // A custom admin-like role without safeguarding: it may manage users but holds no key.
    const lead = await staffWith(at, { matrix: { settings: '11111', sis: '11111' } });
    const previewed = await insertCustomRole(db(), at.id, {
      matrix: { sis: '10000' },
      sensitive: ['safeguarding'],
    });
    await setPreview(db(), lead.session.id, previewed);

    const response = await as(lead.session).get('/probe/guards/safeguarding');
    expect(response.statusCode).toBe(403);
    const permissions = await as(lead.session).get('/me/permissions');
    expect(permissions.json()).toMatchObject({ preview: { roleId: previewed } });
    expect(MePermissions.parse(permissions.json()).keys).not.toContain('sensitive.safeguarding');
  });

  it('keeps a key the admin holds when the previewed role has it too', async () => {
    const { admin } = await previewing({ matrix: { sis: '10000' }, sensitive: ['safeguarding'] });
    expect((await as(admin.session).get('/probe/guards/safeguarding')).statusCode).toBe(200);
  });
});

describe('the permission cache (spec 05: 30 s, keyed by school, roles and their last change)', () => {
  it('serves a cached matrix until the role changes (the positive control for the next tests)', async () => {
    const at = await school();
    const member = await staffWith(at, { matrix: { fees: '10000' } });
    expect((await as(member.session).get('/probe/guards/fees')).statusCode).toBe(200);
    // A matrix row changed behind the API's back: no bump, no invalidation.
    await setRoleMatrix(db(), at.id, member.roleId, { sis: '10000' });
    expect((await as(member.session).get('/probe/guards/fees')).statusCode).toBe(200);
  });

  it('sees a role change on the next request: the matrix changes and roles.updated_at moves', async () => {
    const at = await school();
    const member = await staffWith(at, { matrix: { fees: '10000' } });
    expect((await as(member.session).get('/probe/guards/fees')).statusCode).toBe(200);
    await setRoleMatrix(db(), at.id, member.roleId, { sis: '10000' });
    await touchRole(db(), member.roleId);
    expect((await as(member.session).get('/probe/guards/fees')).statusCode).toBe(403);
  });

  it("sees a change on the next request once the school's keys are dropped (invalidateTenant)", async () => {
    const at = await school();
    const member = await staffWith(at, { matrix: { sis: '10000' } });
    expect((await as(member.session).get('/probe/guards/fees')).statusCode).toBe(403);
    await setRoleMatrix(db(), at.id, member.roleId, { fees: '10000' });
    await app().get(PermissionsService).invalidateTenant(at.id);
    expect((await as(member.session).get('/probe/guards/fees')).statusCode).toBe(200);
  });

  it('sees a new role assignment on the next request', async () => {
    const at = await school();
    const member = await staffWith(at, { matrix: { sis: '10000' } });
    expect((await as(member.session).get('/probe/guards/fees')).statusCode).toBe(403);
    const fees = await insertCustomRole(db(), at.id, { matrix: { fees: '10000' } });
    await assignRole(db(), at.id, member.userId, fees, false);
    expect((await as(member.session).get('/probe/guards/fees')).statusCode).toBe(200);
  });

  it('sees a plan change on the next request', async () => {
    const at = await school(['fees']);
    const member = await staffWith(at, { matrix: { fees: '10000' } });
    expect((await as(member.session).get('/probe/guards/fees')).statusCode).toBe(200);
    await setPlanModules(db(), at.id, ['sis']);
    expect((await as(member.session).get('/probe/guards/fees')).statusCode).toBe(403);
  });

  it("keeps one school's invalidation away from another school's entries", async () => {
    const a = await school();
    const b = await school();
    const inB = await staffWith(b, { matrix: { fees: '10000' } });
    expect((await as(inB.session).get('/probe/guards/fees')).statusCode).toBe(200);
    await setRoleMatrix(db(), b.id, inB.roleId, { sis: '10000' });
    await app().get(PermissionsService).invalidateTenant(a.id);
    expect((await as(inB.session).get('/probe/guards/fees')).statusCode).toBe(200);
  });
});
