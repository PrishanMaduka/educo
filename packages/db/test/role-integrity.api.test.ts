import { eq, sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  createAccountRunner,
  createPlatformRunner,
  createTenantRunner,
  rolePermissions,
  roleSensitive,
  roles,
  userRoles,
  users,
} from '../src/internal';

import {
  insertAccount,
  insertRole,
  insertRolePermission,
  insertRoleSensitive,
  insertTenant,
  insertUser,
  insertUserRole,
} from './factories';
import { postgresCause } from './pg-error';
import { useTestDatabase } from './setup';

import type { AccountRunner, Role, Tenant, TenantRunner } from '../src/internal';

/**
 * Role integrity (Task 13, migration 0015): every role or matrix write moves `roles.updated_at`
 * (the permission cache key, spec 05) by itself, and only staff memberships hold roles.
 */

const testDb = useTestDatabase();

let withTenant: TenantRunner;
let withAccount: AccountRunner;
let school: Tenant;
let other: Tenant;

beforeAll(async () => {
  const { app, platform } = testDb();
  withTenant = createTenantRunner(app);
  withAccount = createAccountRunner(app);
  const withPlatform = createPlatformRunner(platform);
  school = await insertTenant(withPlatform);
  other = await insertTenant(withPlatform);
});

/** `roles.updated_at` in epoch microseconds, read through `quad_platform`. */
async function stampOf(roleId: string): Promise<bigint> {
  const { rows } = await testDb().platform.query<{ at: string }>(
    `select (extract(epoch from updated_at) * 1000000)::bigint::text as at from roles where id = $1`,
    [roleId],
  );
  const at = rows[0]?.at;
  if (at === undefined) throw new Error('No such role.');
  return BigInt(at);
}

async function failure(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('Expected the statement to fail.');
    },
    (caught: unknown) => postgresCause(caught),
  );
}

describe('roles.updated_at moves on every role or matrix write (the permission cache key)', () => {
  it('moves on a roles update, even one that sets an older updated_at', async () => {
    const role = await insertRole(withTenant, school.id);
    const before = await stampOf(role.id);
    await withTenant(school.id, (tx) =>
      tx
        .update(roles)
        .set({ name: 'Renamed', updatedAt: new Date('2000-01-01T00:00:00Z') })
        .where(eq(roles.id, role.id)),
    );
    expect(await stampOf(role.id)).toBeGreaterThan(before);
  });

  it.each([
    ['inserting', 'insert'],
    ['updating', 'update'],
    ['deleting', 'delete'],
  ] as const)('moves on %s a role_permissions row, with no explicit bump', async (_label, op) => {
    const role = await insertRole(withTenant, school.id);
    if (op !== 'insert') await insertRolePermission(withTenant, school.id, role.id);
    const before = await stampOf(role.id);
    await withTenant(school.id, async (tx) => {
      if (op === 'insert') {
        await tx
          .insert(rolePermissions)
          .values({ tenantId: school.id, roleId: role.id, module: 'fees', actions: '10000' });
      } else if (op === 'update') {
        await tx
          .update(rolePermissions)
          .set({ actions: '11000' })
          .where(eq(rolePermissions.roleId, role.id));
      } else {
        await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id));
      }
    });
    expect(await stampOf(role.id)).toBeGreaterThan(before);
  });

  it.each([
    ['inserting', 'insert'],
    ['updating', 'update'],
    ['deleting', 'delete'],
  ] as const)('moves on %s a role_sensitive row, with no explicit bump', async (_label, op) => {
    const role = await insertRole(withTenant, school.id);
    if (op !== 'insert') await insertRoleSensitive(withTenant, school.id, role.id, 'medical');
    const before = await stampOf(role.id);
    await withTenant(school.id, async (tx) => {
      if (op === 'insert') {
        await tx
          .insert(roleSensitive)
          .values({ tenantId: school.id, roleId: role.id, key: 'export_data' });
      } else if (op === 'update') {
        await tx
          .update(roleSensitive)
          .set({ key: 'safeguarding' })
          .where(eq(roleSensitive.roleId, role.id));
      } else {
        await tx.delete(roleSensitive).where(eq(roleSensitive.roleId, role.id));
      }
    });
    expect(await stampOf(role.id)).toBeGreaterThan(before);
  });

  it('moves every role one statement touches, and only those', async () => {
    const first = await insertRole(withTenant, school.id);
    const second = await insertRole(withTenant, school.id);
    const untouched = await insertRole(withTenant, school.id);
    const before = await Promise.all([first, second, untouched].map((role) => stampOf(role.id)));
    await withTenant(school.id, (tx) =>
      tx.insert(rolePermissions).values([
        { tenantId: school.id, roleId: first.id, module: 'sis', actions: '10000' },
        { tenantId: school.id, roleId: second.id, module: 'sis', actions: '10000' },
      ]),
    );
    const after = await Promise.all([first, second, untouched].map((role) => stampOf(role.id)));
    expect(after[0]).toBeGreaterThan(before[0] ?? 0n);
    expect(after[1]).toBeGreaterThan(before[1] ?? 0n);
    expect(after[2]).toBe(before[2]);
  });

  it('moves again on a second write in the same transaction (clock_timestamp, not now)', async () => {
    const role = await insertRole(withTenant, school.id);
    const read = (tx: Parameters<Parameters<TenantRunner>[1]>[0]) =>
      tx.execute<{ at: string }>(
        sql`select (extract(epoch from updated_at) * 1000000)::bigint::text as at from roles where id = ${role.id}`,
      );
    const [first, second] = await withTenant(school.id, async (tx) => {
      await tx
        .insert(rolePermissions)
        .values({ tenantId: school.id, roleId: role.id, module: 'sis', actions: '10000' });
      const one = await read(tx);
      await tx
        .update(rolePermissions)
        .set({ actions: '11000' })
        .where(eq(rolePermissions.roleId, role.id));
      const two = await read(tx);
      return [BigInt(one.rows[0]?.at ?? '0'), BigInt(two.rows[0]?.at ?? '0')];
    });
    expect(second).toBeGreaterThan(first);
  });

  it("leaves another school's roles alone", async () => {
    const mine: Role = await insertRole(withTenant, school.id);
    const theirs: Role = await insertRole(withTenant, other.id);
    const before = await stampOf(theirs.id);
    await insertRolePermission(withTenant, school.id, mine.id);
    expect(await stampOf(theirs.id)).toBe(before);
  });
});

describe('only staff memberships hold roles (Task 12 review, I1)', () => {
  it('gives a staff membership a role (the positive control)', async () => {
    const account = await insertAccount(withAccount);
    const staff = await insertUser(withTenant, school.id, account.id);
    const role = await insertRole(withTenant, school.id);
    await expect(insertUserRole(withTenant, school.id, staff.id, role.id)).resolves.toMatchObject({
      userId: staff.id,
    });
  });

  it.each(['guardian', 'relative'] as const)('refuses a role for a %s membership', async (kind) => {
    const account = await insertAccount(withAccount);
    const parent = await insertUser(withTenant, school.id, account.id, { kind });
    const role = await insertRole(withTenant, school.id);
    expect(await failure(insertUserRole(withTenant, school.id, parent.id, role.id))).toMatchObject({
      code: '23514',
    });
  });

  it('refuses moving a role onto a guardian membership with an update', async () => {
    const staff = await insertUser(withTenant, school.id, (await insertAccount(withAccount)).id);
    const parent = await insertUser(withTenant, school.id, (await insertAccount(withAccount)).id, {
      kind: 'guardian',
    });
    const role = await insertRole(withTenant, school.id);
    await insertUserRole(withTenant, school.id, staff.id, role.id);
    const moved = withTenant(school.id, (tx) =>
      tx.update(userRoles).set({ userId: parent.id }).where(eq(userRoles.userId, staff.id)),
    );
    expect(await failure(moved)).toMatchObject({ code: '23514' });
  });

  it('refuses turning a membership that holds a role into a guardian one', async () => {
    const staff = await insertUser(withTenant, school.id, (await insertAccount(withAccount)).id);
    const role = await insertRole(withTenant, school.id);
    await insertUserRole(withTenant, school.id, staff.id, role.id);
    const turned = withTenant(school.id, (tx) =>
      tx.update(users).set({ kind: 'guardian' }).where(eq(users.id, staff.id)),
    );
    expect(await failure(turned)).toMatchObject({ code: '23514' });
  });

  it('lets a membership without a role change kind (the positive control)', async () => {
    const staff = await insertUser(withTenant, school.id, (await insertAccount(withAccount)).id);
    const turned = await withTenant(school.id, (tx) =>
      tx
        .update(users)
        .set({ kind: 'guardian' })
        .where(eq(users.id, staff.id))
        .returning({ kind: users.kind }),
    );
    expect(turned).toEqual([{ kind: 'guardian' }]);
  });
});

describe('a role and a kind change racing (fix round 1, M3: FOR SHARE on the users row)', () => {
  it('refuses the kind change that waited for a concurrent role grant', async () => {
    const staff = await insertUser(withTenant, school.id, (await insertAccount(withAccount)).id);
    const role = await insertRole(withTenant, school.id);
    const granting = await testDb().platform.connect();
    try {
      await granting.query('begin');
      await granting.query(`select set_config('app.tenant_id', $1, true)`, [school.id]);
      await granting.query(
        `insert into user_roles (tenant_id, user_id, role_id, "primary") values ($1, $2, $3, true)`,
        [school.id, staff.id, role.id],
      );
      const { rows } = await granting.query<{ pid: number }>('select pg_backend_pid() as pid');
      const holder = rows[0]?.pid;
      let settled = false;
      const turning = withTenant(school.id, (tx) =>
        tx.update(users).set({ kind: 'guardian' }).where(eq(users.id, staff.id)),
      ).then(
        () => 'changed',
        (caught: unknown) => {
          const cause = postgresCause(caught);
          return typeof cause === 'object' && cause !== null && 'code' in cause
            ? String(cause.code)
            : 'failed';
        },
      );
      void turning.finally(() => {
        settled = true;
      });
      // The kind change must wait for the grant's share lock on the users row.
      await waitUntilBlockedBy(holder, () => settled);
      await granting.query('commit');
      expect(await turning).toBe('23514');
    } finally {
      granting.release();
    }
  });
});

/** Waits until a backend is blocked by `holder`, or until `done()` (it never blocked). */
async function waitUntilBlockedBy(holder: number | undefined, done: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 200 && !done(); attempt += 1) {
    const { rows } = await testDb().platform.query<{ blocked: string }>(
      'select count(*)::text as blocked from pg_stat_activity where $1 = any(pg_blocking_pids(pid))',
      [holder],
    );
    if (rows[0]?.blocked !== '0') return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
