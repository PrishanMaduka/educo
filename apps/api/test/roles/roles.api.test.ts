import { MePermissions, PermissionModule, Role, RoleList } from '@quad/contracts';
import { describe, expect, it } from 'vitest';

import { RecordingDelivery } from '../fakes/delivery';
import { RecordingOtpSends } from '../fakes/otp-sends';
import { assignRole, auditEntries, insertCustomRole, setPreview } from '../helpers/access';
import { useDatabaseApp } from '../helpers/database-app';
import { asStaff, schoolWithRoles, staffHolding } from '../helpers/users';

import type { RolesSchool, StaffSeed } from '../helpers/users';
import type { PlanModule } from '@quad/contracts';

const delivery = new RecordingDelivery();
const otpSends = new RecordingOtpSends(delivery);
const { db, app } = useDatabaseApp({}, { overrides: { delivery, otpSends } });

const as = (member: Pick<StaffSeed, 'session'>) => asStaff(app, member.session);

const NONE = { view: false, create: false, edit: false, delete: false, approve: false };
const VIEW = { ...NONE, view: true };
const WORK = { ...VIEW, create: true, edit: true };

async function arrange(modules?: readonly PlanModule[]) {
  const school = await schoolWithRoles(db(), modules);
  const admin = await staffHolding(db(), school, school.roles.admin);
  const teacher = await staffHolding(db(), school, school.roles.teacher);
  return { school, admin, teacher };
}

/** A member who manages users (settings.edit) but holds no sensitive key. */
async function keylessManager(school: RolesSchool) {
  const role = await insertCustomRole(db(), school.id, { matrix: { settings: '11111' } });
  return staffHolding(db(), school, role);
}

async function storedGrant(roleId: string) {
  const { rows: matrix } = await db().platform.query<{ module: string; actions: string }>(
    'select module, actions::text as actions from role_permissions where role_id = $1 order by module',
    [roleId],
  );
  const { rows: sensitive } = await db().platform.query<{ key: string }>(
    'select key from role_sensitive where role_id = $1 order by key',
    [roleId],
  );
  return {
    matrix: Object.fromEntries(matrix.map((row) => [row.module, row.actions])),
    sensitive: sensitive.map((row) => row.key),
  };
}

async function roleExists(roleId: string): Promise<boolean> {
  const { rows } = await db().platform.query('select 1 from roles where id = $1', [roleId]);
  return rows.length === 1;
}

const auditIn = async (action: string, tenantId: string) =>
  (await auditEntries(db(), action)).filter((row) => row.tenant_id === tenantId);

const createBody = {
  name: 'Head of Year',
  description: 'Leads a year group',
  color: '#1B7F53',
  scope: 'school',
  baseRoleKey: 'teacher',
};

describe('GET /roles', () => {
  it('lists system and custom roles with members, pages, home and matrix for the Preview card', async () => {
    const { school, admin } = await arrange();
    const custom = await insertCustomRole(db(), school.id, {
      name: 'Bursar',
      matrix: { fees: '11111' },
      sensitive: ['finance_reports'],
    });

    const response = await as(admin)('GET', '/roles');

    expect(response.statusCode).toBe(200);
    const list = RoleList.parse(response.json());
    expect(list.nextCursor).toBeNull();
    expect(list.items.slice(0, 7).every((role) => role.system)).toBe(true);
    const teacher = list.items.find((role) => role.key === 'teacher');
    expect(teacher).toMatchObject({ name: 'Teacher', memberCount: 1, home: 'my_teaching' });
    expect(teacher?.matrix.lms).toEqual(WORK);
    expect(teacher?.pageCount).toBeGreaterThan(0);
    const bursar = list.items.find((role) => role.id === custom);
    expect(bursar).toMatchObject({
      system: false,
      memberCount: 0,
      home: 'dashboard',
      sensitive: ['finance_reports'],
    });
    expect(bursar?.matrix.fees).toEqual({ ...WORK, delete: true, approve: true });
    expect(bursar?.matrix.sis).toEqual(NONE);
    expect(list.items.find((role) => role.key === 'admin')?.pageCount).toBe(24);
    expect(list.outsidePlan).toEqual([]);
  });

  it("names the matrix rows outside the school's plan (Not in plan)", async () => {
    const { admin } = await arrange(['admissions', 'crm', 'sis', 'lms', 'fees', 'parent']);
    const list = RoleList.parse((await as(admin)('GET', '/roles')).json());
    expect(list.outsidePlan).toEqual(['finance', 'transport']);
  });

  it('lets a principal (settings.view, any-of) read the roles, but not a teacher (403)', async () => {
    const { school, teacher } = await arrange();
    const principal = await staffHolding(db(), school, school.roles.principal);
    expect((await as(principal)('GET', '/roles')).statusCode).toBe(200);
    const refused = await as(teacher)('GET', '/roles');
    expect(refused.statusCode).toBe(403);
    expect(refused.json()).toMatchObject({ code: 'forbidden' });
  });

  it("never lists another school's roles", async () => {
    const a = await arrange();
    const b = await arrange();
    const theirs = await insertCustomRole(db(), b.school.id);
    const ids = RoleList.parse((await as(a.admin)('GET', '/roles')).json()).items.map((r) => r.id);
    expect(ids).not.toContain(theirs);
    expect(ids).not.toContain(b.school.roles.admin);
    expect(ids).toContain(a.school.roles.admin);
  });
});

describe('POST /roles', () => {
  it("creates a custom role from the base role's matrix and keys, audited (201)", async () => {
    const { school, admin } = await arrange();
    const response = await as(admin)('POST', '/roles', {
      ...createBody,
      baseRoleKey: 'counsellor',
    });

    expect(response.statusCode).toBe(201);
    const role = Role.parse(response.json());
    expect(role).toMatchObject({
      name: 'Head of Year',
      description: 'Leads a year group',
      color: '#1B7F53',
      system: false,
      scope: 'school',
      baseRoleKey: 'counsellor',
      memberCount: 0,
      sensitive: ['medical'],
    });
    expect(await storedGrant(role.id)).toEqual({
      matrix: { attendance: '10000', sis: '11000' },
      sensitive: ['medical'],
    });
    expect(await auditIn('role.created', school.id)).toEqual([
      expect.objectContaining({
        actor_user_id: admin.userId,
        target_type: 'role',
        target_id: role.id,
      }),
    ]);
  });

  it('starts from nothing with a null base, and leaves out rows the plan does not include', async () => {
    const { admin } = await arrange(['sis']);
    const blank = Role.parse(
      (await as(admin)('POST', '/roles', { ...createBody, baseRoleKey: null })).json(),
    );
    expect(await storedGrant(blank.id)).toEqual({ matrix: {}, sensitive: [] });
    const fromFrontDesk = Role.parse(
      (await as(admin)('POST', '/roles', { ...createBody, baseRoleKey: 'frontdesk' })).json(),
    );
    // Front desk also reads transport, which this school's plan does not include.
    expect(await storedGrant(fromFrontDesk.id)).toEqual({
      matrix: { attendance: '11100', sis: '10000' },
      sensitive: [],
    });
  });

  it.each([
    [{ ...createBody, name: '' }],
    [{ ...createBody, color: 'green' }],
    [{ ...createBody, baseRoleKey: 'no_such_role' }],
    [{ ...createBody, permissions: { matrix: {}, sensitive: ['secrets'] } }],
  ])('answers 400 validation for %j', async (body) => {
    const { admin } = await arrange();
    const response = await as(admin)('POST', '/roles', body);
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'validation' });
  });

  it('answers 403 to a teacher, while previewing, and when copying keys the admin lacks', async () => {
    const { school, admin, teacher } = await arrange();
    expect((await as(teacher)('POST', '/roles', createBody)).json()).toMatchObject({
      code: 'forbidden',
    });
    const manager = await keylessManager(school);
    const copyAdmin = await as(manager)('POST', '/roles', { ...createBody, baseRoleKey: 'admin' });
    expect(copyAdmin.statusCode).toBe(403);
    expect(copyAdmin.json()).toMatchObject({ code: 'forbidden' });
    // The positive control: a base role without keys is fine for them.
    expect((await as(manager)('POST', '/roles', createBody)).statusCode).toBe(201);
    await setPreview(db(), admin.session.id, school.roles.finance);
    expect((await as(admin)('POST', '/roles', createBody)).json()).toMatchObject({
      code: 'preview_read_only',
    });
  });

  it('creates the role with the grant it is sent, in one step, audited once (Task 21 fix)', async () => {
    const { school, admin } = await arrange();
    const response = await as(admin)('POST', '/roles', {
      ...createBody,
      baseRoleKey: 'counsellor',
      permissions: { matrix: { fees: { ...VIEW, edit: true }, sis: VIEW }, sensitive: [] },
    });
    expect(response.statusCode).toBe(201);
    const role = Role.parse(response.json());
    expect(role.baseRoleKey).toBe('counsellor');
    // The counsellor's attendance row and medical key are not copied: the grant sent is the role's.
    expect(await storedGrant(role.id)).toEqual({
      matrix: { fees: '10100', sis: '10000' },
      sensitive: [],
    });
    expect(await auditIn('role.created', school.id)).toHaveLength(1);
  });

  it('checks the grant it is sent: 422 outside the plan and 403 for unheld keys, and creates nothing', async () => {
    const { school, admin } = await arrange(['sis']);
    const before = await db().platform.query(
      'select count(*)::int as n from roles where tenant_id = $1',
      [school.id],
    );
    const outside = await as(admin)('POST', '/roles', {
      ...createBody,
      permissions: { matrix: { transport: VIEW }, sensitive: [] },
    });
    expect(outside.statusCode).toBe(422);
    expect(outside.json()).toMatchObject({ code: 'module_not_in_plan' });

    const manager = await keylessManager(school);
    const unheld = await as(manager)('POST', '/roles', {
      ...createBody,
      baseRoleKey: null,
      permissions: { matrix: {}, sensitive: ['medical'] },
    });
    expect(unheld.statusCode).toBe(403);
    const after = await db().platform.query(
      'select count(*)::int as n from roles where tenant_id = $1',
      [school.id],
    );
    // keylessManager added one custom role; the refused creates added none.
    expect(after.rows[0]).toEqual({ n: (before.rows[0] as { n: number }).n + 1 });
  });

  it('lets a manager start from a role with keys they lack when the grant they send drops them', async () => {
    const { school } = await arrange();
    const manager = await keylessManager(school);
    const response = await as(manager)('POST', '/roles', {
      ...createBody,
      baseRoleKey: 'admin',
      permissions: { matrix: { sis: VIEW }, sensitive: [] },
    });
    expect(response.statusCode).toBe(201);
    expect(await storedGrant(Role.parse(response.json()).id)).toEqual({
      matrix: { sis: '10000' },
      sensitive: [],
    });
  });

  it("refuses another school's custom role as the base (400)", async () => {
    const a = await arrange();
    const b = await arrange();
    const theirs = await insertCustomRole(db(), b.school.id);
    const { rows } = await db().platform.query<{ key: string }>(
      'select key from roles where id = $1',
      [theirs],
    );
    const response = await as(a.admin)('POST', '/roles', {
      ...createBody,
      baseRoleKey: rows[0]?.key,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      fields: { baseRoleKey: expect.any(String) as unknown },
    });
  });
});

describe('PATCH /roles/:id', () => {
  it('renames a custom role and changes its look and scope, audited', async () => {
    const { school, admin } = await arrange();
    const custom = await insertCustomRole(db(), school.id);
    const response = await as(admin)('PATCH', `/roles/${custom}`, {
      name: 'Year lead',
      description: null,
      color: '#4048B8',
      scope: 'own_classes',
    });
    expect(response.statusCode).toBe(200);
    expect(Role.parse(response.json())).toMatchObject({
      name: 'Year lead',
      description: null,
      color: '#4048B8',
      scope: 'own_classes',
    });
    expect(await auditIn('role.updated', school.id)).toEqual([
      expect.objectContaining({
        target_id: custom,
        meta: { fields: ['color', 'description', 'name', 'scope'] },
      }),
    ]);
  });

  it('refuses a system role with 422 system_role_locked', async () => {
    const { school, admin } = await arrange();
    const response = await as(admin)('PATCH', `/roles/${school.roles.teacher}`, { name: 'Tutor' });
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ code: 'system_role_locked' });
  });

  it('answers 400 for an empty change or a bad id', async () => {
    const { school, admin } = await arrange();
    const custom = await insertCustomRole(db(), school.id);
    expect((await as(admin)('PATCH', `/roles/${custom}`, {})).statusCode).toBe(400);
    expect((await as(admin)('PATCH', '/roles/42', { name: 'x' })).statusCode).toBe(400);
  });

  it('answers 403 to a teacher and while previewing, and 404 across schools', async () => {
    const a = await arrange();
    const b = await arrange();
    const custom = await insertCustomRole(db(), a.school.id, { name: 'Kept' });
    expect((await as(a.teacher)('PATCH', `/roles/${custom}`, { name: 'x' })).statusCode).toBe(403);
    expect((await as(b.admin)('PATCH', `/roles/${custom}`, { name: 'x' })).statusCode).toBe(404);
    await setPreview(db(), a.admin.session.id, a.school.roles.finance);
    expect((await as(a.admin)('PATCH', `/roles/${custom}`, { name: 'x' })).json()).toMatchObject({
      code: 'preview_read_only',
    });
    const { rows } = await db().platform.query<{ name: string }>(
      'select name from roles where id = $1',
      [custom],
    );
    expect(rows[0]?.name).toBe('Kept');
  });
});

describe('DELETE /roles/:id', () => {
  it('deletes an unassigned custom role with its matrix, audited (204)', async () => {
    const { school, admin } = await arrange();
    const custom = await insertCustomRole(db(), school.id, { matrix: { fees: '10000' } });
    const response = await as(admin)('DELETE', `/roles/${custom}`);
    expect(response.statusCode).toBe(204);
    expect(await roleExists(custom)).toBe(false);
    expect(await auditIn('role.deleted', school.id)).toEqual([
      expect.objectContaining({ target_id: custom }),
    ]);
  });

  it('answers 409 in_use for an assigned or previewed role, and 422 for a system role', async () => {
    const { school, admin, teacher } = await arrange();
    const assigned = await insertCustomRole(db(), school.id);
    await assignRole(db(), school.id, teacher.userId, assigned, false);
    const inUse = await as(admin)('DELETE', `/roles/${assigned}`);
    expect(inUse.statusCode).toBe(409);
    expect(inUse.json()).toMatchObject({ code: 'in_use' });
    const previewed = await insertCustomRole(db(), school.id);
    const other = await staffHolding(db(), school, school.roles.admin);
    await setPreview(db(), other.session.id, previewed);
    expect((await as(admin)('DELETE', `/roles/${previewed}`)).json()).toMatchObject({
      code: 'in_use',
    });
    const system = await as(admin)('DELETE', `/roles/${school.roles.frontdesk}`);
    expect(system.statusCode).toBe(422);
    expect(system.json()).toMatchObject({ code: 'system_role_locked' });
    expect(await roleExists(assigned)).toBe(true);
  });

  it('answers 400 for a bad id, 403 to a teacher and while previewing, and 404 across schools', async () => {
    const a = await arrange();
    const b = await arrange();
    const custom = await insertCustomRole(db(), a.school.id);
    expect((await as(a.admin)('DELETE', '/roles/42')).statusCode).toBe(400);
    expect((await as(a.teacher)('DELETE', `/roles/${custom}`)).statusCode).toBe(403);
    expect((await as(b.admin)('DELETE', `/roles/${custom}`)).statusCode).toBe(404);
    // A fresh admin: a preview written behind the API's back is seen once the session's 30 s
    // cache entry is gone, so it is set before the session's first request.
    const previewing = await staffHolding(db(), a.school, a.school.roles.admin);
    await setPreview(db(), previewing.session.id, a.school.roles.finance);
    expect((await as(previewing)('DELETE', `/roles/${custom}`)).json()).toMatchObject({
      code: 'preview_read_only',
    });
    expect(await roleExists(custom)).toBe(true);
  });
});

describe('PUT /roles/:id/permissions', () => {
  it('stores the normalised matrix and keys, audited, and members see it on their next request', async () => {
    const { school, admin } = await arrange();
    const custom = await insertCustomRole(db(), school.id, { matrix: { sis: '10000' } });
    const holder = await staffHolding(db(), school, custom);
    const keysOf = async () =>
      MePermissions.parse((await as(holder)('GET', '/me/permissions')).json()).keys;
    expect(await keysOf()).toContain('sis.view');

    const response = await as(admin)('PUT', `/roles/${custom}/permissions`, {
      matrix: {
        fees: { ...NONE, create: true },
        attendance: { ...NONE, edit: true, view: false },
        crm: VIEW,
      },
      sensitive: ['export_data'],
    });

    expect(response.statusCode).toBe(200);
    // A row without View is no access (normaliseRow), so attendance and fees store nothing.
    expect(await storedGrant(custom)).toEqual({
      matrix: { crm: '10000' },
      sensitive: ['export_data'],
    });
    expect(Role.parse(response.json()).matrix.fees).toEqual(NONE);
    const keys = await keysOf();
    expect(keys).toContain('crm.view');
    expect(keys).toContain('sensitive.export_data');
    expect(keys).not.toContain('sis.view');
    expect(await auditIn('role.permissions_changed', school.id)).toEqual([
      expect.objectContaining({
        target_id: custom,
        meta: { matrix: { crm: '10000' }, sensitive: ['export_data'] },
      }),
    ]);
  });

  it('refuses a module outside the plan (422 module_not_in_plan) and a system role (422)', async () => {
    const { school, admin } = await arrange(['sis']);
    const custom = await insertCustomRole(db(), school.id);
    const outside = await as(admin)('PUT', `/roles/${custom}/permissions`, {
      matrix: { fees: VIEW },
      sensitive: [],
    });
    expect(outside.statusCode).toBe(422);
    expect(outside.json()).toMatchObject({ code: 'module_not_in_plan' });
    const system = await as(admin)('PUT', `/roles/${school.roles.teacher}/permissions`, {
      matrix: {},
      sensitive: [],
    });
    expect(system.json()).toMatchObject({ code: 'system_role_locked' });
  });

  it('refuses giving a sensitive key the admin lacks (403), but keeps or removes keys freely', async () => {
    const { school } = await arrange();
    const manager = await keylessManager(school);
    const custom = await insertCustomRole(db(), school.id, { sensitive: ['medical'] });
    const adding = await as(manager)('PUT', `/roles/${custom}/permissions`, {
      matrix: {},
      sensitive: ['medical', 'safeguarding'],
    });
    expect(adding.statusCode).toBe(403);
    expect(adding.json()).toMatchObject({ code: 'forbidden' });
    expect((await storedGrant(custom)).sensitive).toEqual(['medical']);
    // Keeping a key they lack is not giving it; removing one is always allowed.
    expect(
      (
        await as(manager)('PUT', `/roles/${custom}/permissions`, {
          matrix: {},
          sensitive: ['medical'],
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await as(manager)('PUT', `/roles/${custom}/permissions`, { matrix: {}, sensitive: [] }))
        .statusCode,
    ).toBe(200);
  });

  it('answers 400 validation for a malformed matrix', async () => {
    const { school, admin } = await arrange();
    const custom = await insertCustomRole(db(), school.id);
    const response = await as(admin)('PUT', `/roles/${custom}/permissions`, {
      matrix: { galaxy: VIEW },
      sensitive: [],
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'validation' });
  });

  it('answers 403 to a teacher and while previewing, and 404 across schools', async () => {
    const a = await arrange();
    const b = await arrange();
    const custom = await insertCustomRole(db(), a.school.id, { matrix: { sis: '10000' } });
    const body = { matrix: { fees: VIEW }, sensitive: [] };
    expect((await as(a.teacher)('PUT', `/roles/${custom}/permissions`, body)).statusCode).toBe(403);
    expect((await as(b.admin)('PUT', `/roles/${custom}/permissions`, body)).statusCode).toBe(404);
    await setPreview(db(), a.admin.session.id, a.school.roles.finance);
    expect((await as(a.admin)('PUT', `/roles/${custom}/permissions`, body)).json()).toMatchObject({
      code: 'preview_read_only',
    });
    expect((await storedGrant(custom)).matrix).toEqual({ sis: '10000' });
  });
});

describe('a role its holder changes (fix round 1, M6)', () => {
  it('refuses PATCH and PUT …/permissions on a role the caller holds (422 own_role_locked)', async () => {
    const { school } = await arrange();
    const manager = await keylessManager(school);
    const { rows } = await db().platform.query<{ role_id: string }>(
      'select role_id from user_roles where user_id = $1',
      [manager.userId],
    );
    const own = rows[0]?.role_id ?? '';
    const renamed = await as(manager)('PATCH', `/roles/${own}`, { name: 'Mine now' });
    expect(renamed.statusCode).toBe(422);
    expect(renamed.json()).toMatchObject({ code: 'own_role_locked' });
    const widened = await as(manager)('PUT', `/roles/${own}/permissions`, {
      matrix: {
        settings: { view: true, create: true, edit: true, delete: true, approve: true },
        fees: VIEW,
      },
      sensitive: [],
    });
    expect(widened.statusCode).toBe(422);
    expect(widened.json()).toMatchObject({ code: 'own_role_locked' });
    expect((await storedGrant(own)).matrix).toEqual({ settings: '11111' });
    // The positive control: another custom role is theirs to change.
    const other = await insertCustomRole(db(), school.id);
    expect((await as(manager)('PATCH', `/roles/${other}`, { name: 'Year lead' })).statusCode).toBe(
      200,
    );
  });
});

describe('every module row in a role response', () => {
  it('has a row for each of the nine modules', async () => {
    const { admin } = await arrange();
    const [first] = RoleList.parse((await as(admin)('GET', '/roles')).json()).items;
    expect(Object.keys(first?.matrix ?? {}).sort()).toEqual([...PermissionModule.options].sort());
  });
});
