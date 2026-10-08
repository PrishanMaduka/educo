import { createHash, randomBytes } from 'node:crypto';

import {
  accounts,
  auditLog,
  credentials,
  rolePermissions,
  roleSensitive,
  roles,
  schoolSettings,
  sessions,
  tenants,
  trustedDevices,
  userRoles,
  users,
  uuidv7,
} from '../src/internal';

import type {
  Account,
  AccountRunner,
  AuditEntry,
  NewAccount,
  NewAuditEntry,
  NewCredential,
  NewRole,
  NewRolePermission,
  NewSchoolSettings,
  NewSession,
  NewTenant,
  NewTrustedDevice,
  NewUser,
  NewUserRole,
  PlatformRunner,
  Role,
  RolePermission,
  RoleSensitive,
  SchoolSettings,
  Session,
  Tenant,
  TenantRunner,
  TrustedDevice,
  User,
  UserRole,
} from '../src/internal';

const DAY_MS = 24 * 60 * 60 * 1000;

/** A random SHA-256 digest, the shape every stored token hash has. */
export function randomTokenHash(): Buffer {
  return createHash('sha256').update(randomBytes(32)).digest();
}

/** A valid `tenants` row with a unique id and slug; override any column. */
export function buildTenant(overrides: Partial<NewTenant> = {}): NewTenant {
  const suffix = randomBytes(4).toString('hex');
  return {
    id: uuidv7(),
    name: `Test School ${suffix}`,
    shortName: 'TS',
    slug: `test-${suffix}`,
    country: 'LK',
    region: 'ap-south',
    timeZone: 'Asia/Colombo',
    currency: 'LKR',
    locale: 'en-LK',
    status: 'active',
    ...overrides,
  };
}

/** Inserts a tenant through `withPlatform` (tenants is a platform table). */
export async function insertTenant(
  withPlatform: PlatformRunner,
  overrides: Partial<NewTenant> = {},
): Promise<Tenant> {
  const [row] = await withPlatform((tx) =>
    tx.insert(tenants).values(buildTenant(overrides)).returning(),
  );
  if (!row) {
    throw new Error('Tenant insert returned no row.');
  }
  return row;
}

/** A valid `accounts` row with a unique id and a fictional `.test` email; override any column. */
export function buildAccount(overrides: Partial<NewAccount> = {}): NewAccount {
  return {
    id: uuidv7(),
    email: `person-${randomBytes(4).toString('hex')}@example.test`,
    status: 'active',
    ...overrides,
  };
}

/** Inserts an account under its own `withAccount` scope (accounts RLS keys on `id`). */
export async function insertAccount(
  withAccount: AccountRunner,
  overrides: Partial<NewAccount> = {},
): Promise<Account> {
  const values = buildAccount(overrides);
  const accountId = values.id ?? uuidv7();
  const [row] = await withAccount(accountId, (tx) =>
    tx
      .insert(accounts)
      .values({ ...values, id: accountId })
      .returning(),
  );
  if (!row) {
    throw new Error('Account insert returned no row.');
  }
  return row;
}

/** Inserts the account's `credentials` row (no password, no authenticator unless overridden). */
export async function insertCredentials(
  withAccount: AccountRunner,
  accountId: string,
  overrides: Partial<NewCredential> = {},
): Promise<void> {
  await withAccount(accountId, (tx) => tx.insert(credentials).values({ accountId, ...overrides }));
}

/** A valid web `sessions` row for `accountId`, expiring in 12 hours; override any column. */
export function buildSession(accountId: string, overrides: Partial<NewSession> = {}): NewSession {
  return {
    id: uuidv7(),
    accountId,
    kind: 'web',
    stage: 'choose_school',
    tokenHash: randomTokenHash(),
    expiresAt: new Date(Date.now() + DAY_MS / 2),
    ...overrides,
  };
}

/** Inserts a session for `accountId` under that account's `withAccount` scope. */
export async function insertSession(
  withAccount: AccountRunner,
  accountId: string,
  overrides: Partial<NewSession> = {},
): Promise<Session> {
  const [row] = await withAccount(accountId, (tx) =>
    tx.insert(sessions).values(buildSession(accountId, overrides)).returning(),
  );
  if (!row) {
    throw new Error('Session insert returned no row.');
  }
  return row;
}

/** Inserts a trusted device for `accountId`, expiring in 30 days. */
export async function insertTrustedDevice(
  withAccount: AccountRunner,
  accountId: string,
  overrides: Partial<NewTrustedDevice> = {},
): Promise<TrustedDevice> {
  const [row] = await withAccount(accountId, (tx) =>
    tx
      .insert(trustedDevices)
      .values({
        accountId,
        tokenHash: randomTokenHash(),
        expiresAt: new Date(Date.now() + 30 * DAY_MS),
        ...overrides,
      })
      .returning(),
  );
  if (!row) {
    throw new Error('Trusted device insert returned no row.');
  }
  return row;
}

/** Returns the only row a `returning()` insert gave back. */
function single<T>(rows: readonly T[], what: string): T {
  const [row] = rows;
  if (!row) {
    throw new Error(`${what} insert returned no row.`);
  }
  return row;
}

/** A valid staff `users` row (a membership) of `accountId` in `tenantId`; override any column. */
export function buildUser(
  tenantId: string,
  accountId: string,
  overrides: Partial<NewUser> = {},
): NewUser {
  const suffix = randomBytes(4).toString('hex');
  return {
    id: uuidv7(),
    tenantId,
    accountId,
    kind: 'staff',
    name: `Test Person ${suffix}`,
    email: `member-${suffix}@example.test`,
    status: 'active',
    ...overrides,
  };
}

/** Inserts a membership under `withTenant(tenantId)`. */
export async function insertUser(
  withTenant: TenantRunner,
  tenantId: string,
  accountId: string,
  overrides: Partial<NewUser> = {},
): Promise<User> {
  const rows = await withTenant(tenantId, (tx) =>
    tx
      .insert(users)
      .values(buildUser(tenantId, accountId, overrides))
      .returning(),
  );
  return single(rows, 'User');
}

/** A valid custom `roles` row in `tenantId` with a unique key; override any column. */
export function buildRole(tenantId: string, overrides: Partial<NewRole> = {}): NewRole {
  const suffix = randomBytes(4).toString('hex');
  return {
    id: uuidv7(),
    tenantId,
    key: `custom_${suffix}`,
    name: `Test Role ${suffix}`,
    scope: 'school',
    ...overrides,
  };
}

/** Inserts a role under `withTenant(tenantId)`. */
export async function insertRole(
  withTenant: TenantRunner,
  tenantId: string,
  overrides: Partial<NewRole> = {},
): Promise<Role> {
  const rows = await withTenant(tenantId, (tx) =>
    tx.insert(roles).values(buildRole(tenantId, overrides)).returning(),
  );
  return single(rows, 'Role');
}

/** Inserts one matrix row for `roleId` (default: `sis`, view only). */
export async function insertRolePermission(
  withTenant: TenantRunner,
  tenantId: string,
  roleId: string,
  overrides: Partial<NewRolePermission> = {},
): Promise<RolePermission> {
  const rows = await withTenant(tenantId, (tx) =>
    tx
      .insert(rolePermissions)
      .values({ tenantId, roleId, module: 'sis', actions: '10000', ...overrides })
      .returning(),
  );
  return single(rows, 'Role permission');
}

/** Gives `roleId` the sensitive key `key` (default `medical`). */
export async function insertRoleSensitive(
  withTenant: TenantRunner,
  tenantId: string,
  roleId: string,
  key: RoleSensitive['key'] = 'medical',
): Promise<RoleSensitive> {
  const rows = await withTenant(tenantId, (tx) =>
    tx.insert(roleSensitive).values({ tenantId, roleId, key }).returning(),
  );
  return single(rows, 'Role sensitive key');
}

/** Gives membership `userId` the role `roleId` (primary unless overridden). */
export async function insertUserRole(
  withTenant: TenantRunner,
  tenantId: string,
  userId: string,
  roleId: string,
  overrides: Partial<NewUserRole> = {},
): Promise<UserRole> {
  const rows = await withTenant(tenantId, (tx) =>
    tx
      .insert(userRoles)
      .values({ tenantId, userId, roleId, primary: true, ...overrides })
      .returning(),
  );
  return single(rows, 'User role');
}

/** Inserts the school's `school_settings` row with the database defaults; override any column. */
export async function insertSchoolSettings(
  withTenant: TenantRunner,
  tenantId: string,
  overrides: Partial<NewSchoolSettings> = {},
): Promise<SchoolSettings> {
  const rows = await withTenant(tenantId, (tx) =>
    tx
      .insert(schoolSettings)
      .values({ tenantId, ...overrides })
      .returning(),
  );
  return single(rows, 'School settings');
}

/** Appends an `audit_log` entry in `tenantId` (default action `test.recorded`). */
export async function insertAuditEntry(
  withTenant: TenantRunner,
  tenantId: string,
  overrides: Partial<NewAuditEntry> = {},
): Promise<AuditEntry> {
  const rows = await withTenant(tenantId, (tx) =>
    tx
      .insert(auditLog)
      .values({ tenantId, action: 'test.recorded', ...overrides })
      .returning(),
  );
  return single(rows, 'Audit entry');
}
