import { sql } from 'drizzle-orm';
import { DatabaseError } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  auditLog,
  createAccountRunner,
  createPlatformRunner,
  createTenantRunner,
  rolePermissions,
  roleSensitive,
  roles,
  schoolSettings,
  sessions,
  userRoles,
  users,
} from '../src/internal';

import {
  buildRole,
  buildSession,
  buildUser,
  insertAccount,
  insertAuditEntry,
  insertRole,
  insertRolePermission,
  insertRoleSensitive,
  insertSchoolSettings,
  insertSession,
  insertTenant,
  insertUser,
  insertUserRole,
} from './factories';
import { postgresCause } from './pg-error';
import { useTestDatabase } from './setup';

import type {
  Account,
  AccountRunner,
  AuditEntry,
  Role,
  TenantRunner,
  TenantTx,
  User,
} from '../src/internal';

const testDb = useTestDatabase();

/** The tenant tables this milestone adds (spec 04, Identity). */
const TENANT_TABLES = [
  'users',
  'roles',
  'role_permissions',
  'role_sensitive',
  'user_roles',
  'school_settings',
  'audit_log',
] as const;
type TenantTable = (typeof TENANT_TABLES)[number];

/** One school's rows: a membership, a role, its matrix and keys, settings and an audit entry. */
interface School {
  readonly id: string;
  readonly member: User;
  readonly role: Role;
  readonly audit: AuditEntry;
}

let withTenant: TenantRunner;
let withAccount: AccountRunner;
let person: Account;
let schoolA: School;
let schoolB: School;

async function seedSchool(account: Account): Promise<School> {
  const tenant = await insertTenant(createPlatformRunner(testDb().platform));
  const member = await insertUser(withTenant, tenant.id, account.id);
  const role = await insertRole(withTenant, tenant.id);
  await insertRolePermission(withTenant, tenant.id, role.id);
  await insertRoleSensitive(withTenant, tenant.id, role.id);
  await insertUserRole(withTenant, tenant.id, member.id, role.id);
  await insertSchoolSettings(withTenant, tenant.id, { updatedBy: member.id });
  const audit = await insertAuditEntry(withTenant, tenant.id, { actorUserId: member.id });
  return { id: tenant.id, member, role, audit };
}

beforeAll(async () => {
  const { app } = testDb();
  withTenant = createTenantRunner(app);
  withAccount = createAccountRunner(app);
  // One person with a membership in both schools: the account is global, the rows are not.
  person = await insertAccount(withAccount);
  schoolA = await seedSchool(person);
  schoolB = await seedSchool(person);
});

async function tenantIdsUnder(tenantId: string, table: TenantTable): Promise<string[]> {
  return withTenant(tenantId, async (tx) => {
    const result = await tx.execute<{ tenant_id: string }>(
      sql.raw(`select tenant_id::text as tenant_id from ${table}`),
    );
    return result.rows.map((row) => row.tenant_id);
  });
}

/** An insert of a valid `table` row carrying school B's ids, run inside `tx`. */
function insertForSchoolB(tx: TenantTx, table: TenantTable): Promise<unknown> {
  const b = schoolB;
  switch (table) {
    case 'users':
      return tx.insert(users).values(buildUser(b.id, person.id));
    case 'roles':
      return tx.insert(roles).values(buildRole(b.id));
    case 'role_permissions':
      return tx
        .insert(rolePermissions)
        .values({ tenantId: b.id, roleId: b.role.id, module: 'fees', actions: '11000' });
    case 'role_sensitive':
      return tx
        .insert(roleSensitive)
        .values({ tenantId: b.id, roleId: b.role.id, key: 'export_data' });
    case 'user_roles':
      return tx
        .insert(userRoles)
        .values({ tenantId: b.id, userId: b.member.id, roleId: b.role.id, primary: false });
    case 'school_settings':
      return tx.insert(schoolSettings).values({ tenantId: b.id });
    case 'audit_log':
      return tx.insert(auditLog).values({ tenantId: b.id, action: 'test.smuggled' });
  }
}

async function failure(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('Expected the statement to fail.');
    },
    (caught: unknown) => postgresCause(caught),
  );
}

describe('Review Focus #4 (tenant tables): quad_app sees only the current school', () => {
  it.each(TENANT_TABLES)("under withTenant(A), %s returns only A's rows", async (table) => {
    const underA = await tenantIdsUnder(schoolA.id, table);
    const underB = await tenantIdsUnder(schoolB.id, table);
    expect(underA.length).toBeGreaterThan(0);
    expect(new Set(underA)).toEqual(new Set([schoolA.id]));
    expect(new Set(underB)).toEqual(new Set([schoolB.id]));
  });

  it.each(TENANT_TABLES)('with no app.tenant_id, %s returns no rows', async (table) => {
    const { rows } = await testDb().app.query<{ count: string }>(`select count(*) from ${table}`);
    expect(rows).toEqual([{ count: '0' }]);
  });

  it.each(TENANT_TABLES)(
    "a raw quad_app query with app.tenant_id = A returns only A's rows from %s",
    async (table) => {
      const client = await testDb().app.connect();
      try {
        await client.query('begin');
        await client.query(`select set_config('app.tenant_id', $1, true)`, [schoolA.id]);
        const { rows } = await client.query<{ tenant_id: string }>(`select * from ${table}`);
        expect(rows.length).toBeGreaterThan(0);
        expect(new Set(rows.map((row) => row.tenant_id))).toEqual(new Set([schoolA.id]));
      } finally {
        await client.query('rollback');
        client.release();
      }
    },
  );

  it.each(TENANT_TABLES)("refuses a %s row with school B's tenant_id while in A", async (table) => {
    const cause = await failure(withTenant(schoolA.id, (tx) => insertForSchoolB(tx, table)));
    expect(cause).toBeInstanceOf(DatabaseError);
    expect(cause).toMatchObject({ code: '42501' });
    expect((cause as DatabaseError).message).toMatch(
      new RegExp(`new row violates row-level security policy for table "${table}"`),
    );
  });

  it.each(TENANT_TABLES)("cannot update or delete school B's %s rows from A", async (table) => {
    const updated = await withTenant(schoolA.id, (tx) =>
      tx.execute(
        sql.raw(`update ${table} set tenant_id = tenant_id where tenant_id = '${schoolB.id}'`),
      ),
    );
    const deleted = await withTenant(schoolA.id, (tx) =>
      tx.execute(sql.raw(`delete from ${table} where tenant_id = '${schoolB.id}'`)),
    );
    expect([updated.rowCount, deleted.rowCount]).toEqual([0, 0]);
    expect(await tenantIdsUnder(schoolB.id, table)).not.toEqual([]);
  });

  it('cannot move a row of A into school B (WITH CHECK on update)', async () => {
    const cause = await failure(
      withTenant(schoolA.id, (tx) =>
        tx.execute(sql`update roles set tenant_id = ${schoolB.id} where id = ${schoolA.role.id}`),
      ),
    );
    expect(cause).toMatchObject({ code: '42501' });
  });

  it('every identity table has ENABLE and FORCE row level security and tenant_isolation', async () => {
    const { rows } = await testDb().owner.query<{
      name: string;
      rls: boolean;
      force: boolean;
      policies: string[];
    }>(
      `select c.relname as name, c.relrowsecurity as rls, c.relforcerowsecurity as force,
              array(select polname::text from pg_policy where polrelid = c.oid order by polname)
                as policies
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relname = any($1::text[]) order by c.relname`,
      [TENANT_TABLES],
    );
    expect(rows).toEqual(
      [...TENANT_TABLES]
        .sort()
        .map((name) => ({ name, rls: true, force: true, policies: ['tenant_isolation'] })),
    );
  });
});

describe('composite foreign keys keep rows inside one school (D23)', () => {
  it("refuses a user_roles row that gives A's member B's role", async () => {
    const cause = await failure(
      withTenant(schoolA.id, (tx) =>
        tx.insert(userRoles).values({
          tenantId: schoolA.id,
          userId: schoolA.member.id,
          roleId: schoolB.role.id,
        }),
      ),
    );
    expect(cause).toMatchObject({ code: '23503' });
  });

  it("refuses an audit entry in A whose actor is B's member", async () => {
    const cause = await failure(
      insertAuditEntry(withTenant, schoolA.id, { actorUserId: schoolB.member.id }),
    );
    expect(cause).toMatchObject({ code: '23503' });
  });

  it('refuses a sessions row whose active_user_id belongs to another school', async () => {
    const cause = await failure(
      insertSession(withAccount, person.id, {
        stage: 'active',
        activeTenantId: schoolA.id,
        activeUserId: schoolB.member.id,
      }),
    );
    expect(cause).toMatchObject({ code: '23503', constraint: 'sessions_active_user_fk' });
  });

  it("refuses a preview of another school's role or sample member", async () => {
    const role = await failure(
      insertSession(withAccount, person.id, {
        stage: 'active',
        activeTenantId: schoolA.id,
        activeUserId: schoolA.member.id,
        previewRoleId: schoolB.role.id,
      }),
    );
    expect(role).toMatchObject({ code: '23503', constraint: 'sessions_preview_role_fk' });
    const sample = await failure(
      insertSession(withAccount, person.id, {
        stage: 'active',
        activeTenantId: schoolA.id,
        activeUserId: schoolA.member.id,
        previewRoleId: schoolA.role.id,
        previewSampleUserId: schoolB.member.id,
      }),
    );
    expect(sample).toMatchObject({ code: '23503', constraint: 'sessions_preview_sample_user_fk' });
  });

  it('refuses a membership or preview id on a session with no school', async () => {
    const cause = await failure(
      withAccount(person.id, (tx) =>
        tx.insert(sessions).values(buildSession(person.id, { activeUserId: schoolA.member.id })),
      ),
    );
    expect(cause).toMatchObject({ code: '23514', constraint: 'sessions_school_ids_need_school' });
  });

  it("accepts a session in A with A's member, role and sample member", async () => {
    const session = await insertSession(withAccount, person.id, {
      stage: 'active',
      activeTenantId: schoolA.id,
      activeUserId: schoolA.member.id,
      previewRoleId: schoolA.role.id,
      previewSampleUserId: schoolA.member.id,
    });
    expect(session.activeUserId).toBe(schoolA.member.id);
  });
});

describe('identity table constraints', () => {
  it('refuses a second membership of the same account in the same school', async () => {
    const cause = await failure(insertUser(withTenant, schoolA.id, person.id));
    expect(cause).toMatchObject({ code: '23505', constraint: 'users_tenant_id_account_id_unique' });
  });

  it('refuses a second primary role for one member, but allows a second role', async () => {
    const extra = await insertRole(withTenant, schoolA.id);
    await expect(
      insertUserRole(withTenant, schoolA.id, schoolA.member.id, extra.id, { primary: false }),
    ).resolves.toMatchObject({ primary: false });
    const other = await insertRole(withTenant, schoolA.id);
    const cause = await failure(
      insertUserRole(withTenant, schoolA.id, schoolA.member.id, other.id, { primary: true }),
    );
    expect(cause).toMatchObject({ code: '23505', constraint: 'user_roles_one_primary_idx' });
  });

  it('refuses a role key used twice in one school, but not across schools', async () => {
    const cause = await failure(insertRole(withTenant, schoolA.id, { key: schoolA.role.key }));
    expect(cause).toMatchObject({ code: '23505', constraint: 'roles_tenant_id_key_unique' });
    await expect(
      insertRole(withTenant, schoolB.id, { key: schoolA.role.key }),
    ).resolves.toMatchObject({ key: schoolA.role.key });
  });

  it('stores a matrix row as exactly five action bits', async () => {
    const role = await insertRole(withTenant, schoolA.id);
    const cause = await failure(
      insertRolePermission(withTenant, schoolA.id, role.id, { actions: '111' }),
    );
    expect(cause).toMatchObject({ code: '22026' });
    const row = await insertRolePermission(withTenant, schoolA.id, role.id, {
      module: 'attendance',
      actions: '11001',
    });
    expect(row).toMatchObject({ module: 'attendance', actions: '11001' });
  });

  it('deleting a role removes its matrix and sensitive keys', async () => {
    const role = await insertRole(withTenant, schoolA.id);
    await insertRolePermission(withTenant, schoolA.id, role.id);
    await insertRoleSensitive(withTenant, schoolA.id, role.id, 'safeguarding');
    const left = await withTenant(schoolA.id, async (tx) => {
      await tx.execute(sql`delete from roles where id = ${role.id}`);
      const result = await tx.execute<{ count: string }>(
        sql`select (select count(*) from role_permissions where role_id = ${role.id})
                 + (select count(*) from role_sensitive where role_id = ${role.id}) as count`,
      );
      return result.rows[0]?.count;
    });
    expect(left).toBe('0');
  });

  it('gives a new school the spec defaults for its settings', async () => {
    const tenant = await insertTenant(createPlatformRunner(testDb().platform));
    const settings = await insertSchoolSettings(withTenant, tenant.id);
    expect(settings).toMatchObject({
      askQuadEnabled: true,
      askQuadKeepConversations: true,
      ewShareWithParents: 'after_plan',
      absenceAlert: 'at_time',
      absenceAlertTime: '09:00:00',
      reminderDays: [-3, 7, 14],
      photoConsentDefault: 'class',
      familyCircleEnabled: true,
      quietHoursEnabled: true,
      quietFrom: '18:00:00',
      quietUntil: '07:00:00',
      quietWeekends: true,
      address: null,
      smsSenderId: null,
      smsSenderStatus: null,
    });
  });
});

describe('audit_log is append-only', () => {
  it('refuses UPDATE and DELETE through quad_app, and TRUNCATE even for the owner', async () => {
    const { owner } = testDb();
    const update = await failure(
      withTenant(schoolA.id, (tx) =>
        tx.execute(sql`update audit_log set action = 'changed' where id = ${schoolA.audit.id}`),
      ),
    );
    expect(update).toBeInstanceOf(DatabaseError);
    expect((update as DatabaseError).message).toMatch(/append-only/);
    const remove = await failure(
      withTenant(schoolA.id, (tx) =>
        tx.execute(sql`delete from audit_log where id = ${schoolA.audit.id}`),
      ),
    );
    expect(remove).toBeInstanceOf(DatabaseError);
    expect((remove as DatabaseError).message).toMatch(/append-only/);
    await expect(owner.query('truncate audit_log')).rejects.toThrow(/append-only/);
    const actions = await withTenant(schoolA.id, async (tx) => {
      const result = await tx.execute<{ action: string }>(
        sql`select action from audit_log where id = ${schoolA.audit.id}`,
      );
      return result.rows.map((row) => row.action);
    });
    expect(actions).toEqual(['test.recorded']);
  });
});
