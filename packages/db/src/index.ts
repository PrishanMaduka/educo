export type { AccountRunner, AccountScope, AccountTx } from './account';
export { InvalidAccountIdError } from './account';
export type { AccountTable, OpenTable, TablePrivilege } from './account-tables';
export { ACCOUNT_TABLES, OPEN_TABLES } from './account-tables';
export type { PlatformDbConfig, QuadPlatformDb, QuadTenantDb, TenantDbConfig } from './db';
export {
  closeDb,
  createPlatformDb,
  createTenantDb,
  withAccount,
  withPlatform,
  withTenant,
} from './db';
export type { OpenRunner, OpenTx } from './open';
export type { PlatformRunner, PlatformTx } from './platform';
export { PLATFORM_TABLES } from './platform-tables';
export { TransactionClosedError } from './client';
export type { FieldCipher } from './crypto/field-cipher';
export {
  FIELD_ENCRYPTION_KEY_MIN_LENGTH,
  FieldCipherError,
  createFieldCipher,
} from './crypto/field-cipher';
export type {
  AccountSessionLookup,
  AuthMembership,
  DefinerCalls,
  RefreshFamily,
  SessionLookup,
  SupportSessionLookup,
  SupportVisit,
  EndedSupportVisit,
  TenantProfile,
  TenantRename,
} from './definers';
export { pingDatabase } from './ping';
export type { SqlQueryable, TableClasses } from './rls';
export {
  DEFINER_READ_POLICY,
  DEFINER_READ_TABLES,
  TABLE_CLASSES,
  accountRlsSql,
  findTenancyViolations,
  tenantRlsSql,
} from './rls';
export * from './schema';
export type { SeedMembership, SeedPerson, SeedSchool } from './seed-data';
export {
  SEED_PEOPLE,
  SEED_PLATFORM_USERS,
  SEED_SCHOOL_ACCESS,
  SEED_SYSTEM_ROLES,
  SEED_TENANTS,
} from './seed-data';
export type { TenantRunner, TenantTx } from './tenant';
export { InvalidTenantIdError } from './tenant';
export { uuidv7 } from './uuid';
/**
 * Drizzle's query operators, re-exported so the API builds queries with this package's own
 * drizzle-orm instance (two installs of it have incompatible column types).
 */
export {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  or,
  sql,
} from 'drizzle-orm';
export type { AnyColumn, SQL } from 'drizzle-orm';
