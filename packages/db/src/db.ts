import { assertAccountId, createAccountRunner } from './account';
import { createPool } from './client';
import { createDefinerCalls } from './definers';
import { databaseUrls } from './env';
import { createPlatformRunner } from './platform';
import { assertTenantId, createTenantRunner } from './tenant';

import type { AccountRunner, AccountScope, AccountTx } from './account';
import type { DefinerCalls } from './definers';
import type { PlatformRunner, PlatformTx } from './platform';
import type { TenantRunner, TenantTx } from './tenant';

interface PoolConfig {
  /** Maximum connections in the pool. */
  readonly poolMax?: number;
  /** Called when an idle connection fails; pass the app logger. */
  readonly onPoolError?: (error: Error) => void;
}

export interface TenantDbConfig extends PoolConfig {
  /** `quad_app` connection URL (DATABASE_URL). Default pool size 10. */
  readonly appUrl: string;
}

export interface PlatformDbConfig extends PoolConfig {
  /** `quad_platform` connection URL (DATABASE_PLATFORM_URL). Default pool size 2. */
  readonly platformUrl: string;
}

/** A `quad_app` handle: `withTenant`, `withAccount` and the definer calls on its own pool. */
export interface QuadTenantDb {
  readonly withTenant: TenantRunner;
  /** Account-scoped transactions for the account tables (D32), on the same pool. */
  readonly withAccount: AccountRunner;
  /** Tenant-less security-definer calls (spec 02, D16), on the same `quad_app` pool. */
  readonly definers: DefinerCalls;
  /** Ends the pool. */
  close(): Promise<void>;
}

/** A `quad_platform` handle. Only reachable through `createPlatformDb` / `withPlatform`, both lint-restricted. */
export interface QuadPlatformDb {
  readonly withPlatform: PlatformRunner;
  /** Ends the pool. */
  close(): Promise<void>;
}

/** Builds `withTenant` on its own `quad_app` pool. Connections open on first use. */
export function createTenantDb(config: TenantDbConfig): QuadTenantDb {
  const pool = createPool(config.appUrl, {
    max: config.poolMax ?? 10,
    applicationName: 'quad-app',
    ...(config.onPoolError ? { onError: config.onPoolError } : {}),
  });
  return {
    withTenant: createTenantRunner(pool),
    withAccount: createAccountRunner(pool),
    definers: createDefinerCalls(pool),
    close: async () => {
      await pool.end();
    },
  };
}

/**
 * Builds `withPlatform` on its own small `quad_platform` pool. Only for
 * `apps/api/src/platform/**` and `apps/api/src/worker/platform-jobs/**`.
 */
export function createPlatformDb(config: PlatformDbConfig): QuadPlatformDb {
  const pool = createPool(config.platformUrl, {
    max: config.poolMax ?? 2,
    applicationName: 'quad-platform',
    ...(config.onPoolError ? { onError: config.onPoolError } : {}),
  });
  return {
    withPlatform: createPlatformRunner(pool),
    close: async () => {
      await pool.end();
    },
  };
}

let defaultTenantDb: QuadTenantDb | undefined;
let defaultPlatformDb: QuadPlatformDb | undefined;

function parsePoolMax(value: string | undefined): number | undefined {
  if (value === undefined || value === '') {
    return undefined;
  }
  const max = Number(value);
  if (!Number.isInteger(max) || max < 1) {
    throw new Error('DATABASE_POOL_MAX must be a whole number of at least 1.');
  }
  return max;
}

function getDefaultTenantDb(): QuadTenantDb {
  defaultTenantDb ??= createTenantDb({
    appUrl: databaseUrls().appUrl,
    poolMax: parsePoolMax(process.env.DATABASE_POOL_MAX),
  });
  return defaultTenantDb;
}

function getDefaultPlatformDb(): QuadPlatformDb {
  defaultPlatformDb ??= createPlatformDb({ platformUrl: databaseUrls().platformUrl });
  return defaultPlatformDb;
}

/**
 * Runs `fn` in a transaction scoped to one school, on the default `quad_app` pool from
 * DATABASE_URL. Throws `InvalidTenantIdError` for a non-uuid before touching the database.
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (tx: TenantTx) => Promise<T>,
): Promise<T> {
  assertTenantId(tenantId);
  return getDefaultTenantDb().withTenant(tenantId, fn);
}

/**
 * Runs `fn` in a transaction scoped to one account (and, with `{ tenantId }`, one school), on
 * the default `quad_app` pool. Throws `InvalidAccountIdError` for a non-uuid before touching
 * the database.
 */
export async function withAccount<T>(
  accountId: string,
  fn: (tx: AccountTx) => Promise<T>,
): Promise<T>;
export async function withAccount<T>(
  accountId: string,
  scope: AccountScope,
  fn: (tx: AccountTx) => Promise<T>,
): Promise<T>;
export async function withAccount<T>(
  accountId: string,
  scopeOrFn: AccountScope | ((tx: AccountTx) => Promise<T>),
  maybeFn?: (tx: AccountTx) => Promise<T>,
): Promise<T> {
  assertAccountId(accountId);
  const runner = getDefaultTenantDb().withAccount;
  if (typeof scopeOrFn === 'function') {
    return runner(accountId, scopeOrFn);
  }
  if (!maybeFn) {
    throw new TypeError('withAccount needs a callback.');
  }
  return runner(accountId, scopeOrFn, maybeFn);
}

/**
 * Runs `fn` in a cross-tenant transaction on the default `quad_platform` pool from
 * DATABASE_PLATFORM_URL. Only for `apps/api/src/platform/**` and
 * `apps/api/src/worker/platform-jobs/**`.
 */
export async function withPlatform<T>(fn: (tx: PlatformTx) => Promise<T>): Promise<T> {
  return getDefaultPlatformDb().withPlatform(fn);
}

/** Ends the default pools (call on shutdown). Safe to call when they were never used. */
export async function closeDb(): Promise<void> {
  const tenantDb = defaultTenantDb;
  const platformDb = defaultPlatformDb;
  defaultTenantDb = undefined;
  defaultPlatformDb = undefined;
  await Promise.all([tenantDb?.close(), platformDb?.close()]);
}
