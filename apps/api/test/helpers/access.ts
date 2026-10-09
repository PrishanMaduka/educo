import { randomBytes, randomUUID } from 'node:crypto';

import type { PermissionModule, PlanModule, RoleScope, SensitiveKey } from '@quad/contracts';
import type { TestDatabase } from '@quad/db/testing';

/**
 * Arranges roles, matrices and plans for the permission tests (Task 12) with plain SQL through
 * `quad_platform` (BYPASSRLS): the arrangement step only, never the code under test.
 */

const suffix = () => randomBytes(4).toString('hex');

/** A matrix as `bit(5)` text per module, view first (`'10000'` is view only). */
export type MatrixBits = Partial<Record<PermissionModule, string>>;

export interface CustomRole {
  readonly matrix?: MatrixBits;
  readonly sensitive?: readonly SensitiveKey[];
  readonly scope?: RoleScope;
  readonly name?: string;
}

/** A custom role (not system) with its matrix rows and sensitive keys. */
export async function insertCustomRole(
  db: TestDatabase,
  tenantId: string,
  role: CustomRole = {},
): Promise<string> {
  const id = randomUUID();
  await db.platform.query(
    `insert into roles (id, tenant_id, key, name, scope) values ($1, $2, $3, $4, $5)`,
    [id, tenantId, `custom_${suffix()}`, role.name ?? `Custom ${suffix()}`, role.scope ?? 'school'],
  );
  await setRoleMatrix(db, tenantId, id, role.matrix ?? {}, role.sensitive ?? []);
  return id;
}

/** Replaces a role's matrix rows and sensitive keys, leaving `roles.updated_at` alone. */
export async function setRoleMatrix(
  db: TestDatabase,
  tenantId: string,
  roleId: string,
  matrix: MatrixBits,
  sensitive: readonly SensitiveKey[] = [],
): Promise<void> {
  await db.platform.query('delete from role_permissions where role_id = $1', [roleId]);
  await db.platform.query('delete from role_sensitive where role_id = $1', [roleId]);
  for (const [module, bits] of Object.entries(matrix)) {
    await db.platform.query(
      `insert into role_permissions (tenant_id, role_id, module, actions) values ($1, $2, $3, $4::bit(5))`,
      [tenantId, roleId, module, bits],
    );
  }
  for (const key of sensitive) {
    await db.platform.query(
      `insert into role_sensitive (tenant_id, role_id, key) values ($1, $2, $3)`,
      [tenantId, roleId, key],
    );
  }
}

/** Moves `roles.updated_at` on, as every role or matrix write does (spec 05 cache key). */
export async function touchRole(db: TestDatabase, roleId: string): Promise<void> {
  await db.platform.query(
    `update roles set updated_at = greatest(now(), updated_at + interval '1 millisecond') where id = $1`,
    [roleId],
  );
}

/** A system role of the school (`admin`, `teacher`, …): its permissions are the fixed defaults. */
export async function insertSystemRole(
  db: TestDatabase,
  tenantId: string,
  key: string,
  options: { readonly name?: string; readonly scope?: RoleScope } = {},
): Promise<string> {
  const id = randomUUID();
  await db.platform.query(
    `insert into roles (id, tenant_id, key, name, system, scope) values ($1, $2, $3, $4, true, $5)`,
    [id, tenantId, key, options.name ?? key, options.scope ?? 'school'],
  );
  return id;
}

/** Gives a membership a role. */
export async function assignRole(
  db: TestDatabase,
  tenantId: string,
  userId: string,
  roleId: string,
  primary = true,
): Promise<void> {
  await db.platform.query(
    `insert into user_roles (tenant_id, user_id, role_id, "primary") values ($1, $2, $3, $4)`,
    [tenantId, userId, roleId, primary],
  );
}

/** Switches the school's plan modules on (replacing any it had). */
export async function setPlanModules(
  db: TestDatabase,
  tenantId: string,
  modules: readonly PlanModule[],
): Promise<void> {
  await db.platform.query('delete from tenant_modules where tenant_id = $1', [tenantId]);
  for (const module of modules) {
    await db.platform.query(
      `insert into tenant_modules (tenant_id, module, enabled) values ($1, $2, true)`,
      [tenantId, module],
    );
  }
}

/** Puts a role preview on a session directly (the arrangement for guard tests). */
export async function setPreview(
  db: TestDatabase,
  sessionId: string,
  roleId: string | null,
  sampleUserId: string | null = null,
): Promise<void> {
  await db.platform.query(
    'update sessions set preview_role_id = $2, preview_sample_user_id = $3 where id = $1',
    [sessionId, roleId, sampleUserId],
  );
}

/** Suspends a school with a reason, as the console does. */
export async function suspendSchool(
  db: TestDatabase,
  tenantId: string,
  reason: string | null,
): Promise<void> {
  await db.platform.query(
    `update tenants set status = 'suspended', suspended_at = now(), suspend_reason = $2 where id = $1`,
    [tenantId, reason],
  );
}

/** The school audit rows of one action with their meta, oldest first. */
export async function auditEntries(
  db: TestDatabase,
  action: string,
): Promise<
  {
    tenant_id: string;
    actor_user_id: string | null;
    actor_platform_user_id: string | null;
    target_type: string | null;
    target_id: string | null;
    meta: Record<string, unknown>;
  }[]
> {
  const { rows } = await db.platform.query<{
    tenant_id: string;
    actor_user_id: string | null;
    actor_platform_user_id: string | null;
    target_type: string | null;
    target_id: string | null;
    meta: Record<string, unknown>;
  }>(
    `select tenant_id, actor_user_id, actor_platform_user_id, target_type, target_id, meta
     from audit_log where action = $1 order by at, id`,
    [action],
  );
  return rows;
}
