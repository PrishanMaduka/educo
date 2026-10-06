import { createPool } from './client';
import { databaseUrls } from './env';
import { createPlatformRunner } from './platform';
import { assertTenantId, createTenantRunner } from './tenant';

import type { PlatformRunner, PlatformTx } from './platform';
import type { TenantRunner, TenantTx } from './tenant';

export interface DbConfig {
  /** `quad_app` connection URL (DATABASE_URL). */
  readonly appUrl: string;
  /** `quad_platform` connection URL (DATABASE_PLATFORM_URL). */
  readonly platformUrl: string;
  /** Maximum connections in the `quad_app` pool (DATABASE_POOL_MAX). Default 10. */
  readonly poolMax?: number;
  /** Maximum connections in the separate, small `quad_platform` pool. Default 2. */
  readonly platformPoolMax?: number;
  /** Called when an idle connection fails; pass the app logger. */
  readonly onPoolError?: (error: Error) => void;
}

/** The database handles the API and worker use. */
export interface QuadDb {
  readonly withTenant: TenantRunner;
  readonly withPlatform: PlatformRunner;
  /** Ends both pools. */
  close(): Promise<void>;
}

/** Builds `withTenant` and `withPlatform` on two separate pools. Connections open on first use. */
export function createDb(config: DbConfig): QuadDb {
  const appPool = createPool(config.appUrl, {
    max: config.poolMax ?? 10,
    applicationName: 'quad-app',
    ...(config.onPoolError ? { onError: config.onPoolError } : {}),
  });
  const platformPool = createPool(config.platformUrl, {
    max: config.platformPoolMax ?? 2,
    applicationName: 'quad-platform',
    ...(config.onPoolError ? { onError: config.onPoolError } : {}),
  });
  return {
    withTenant: createTenantRunner(appPool),
    withPlatform: createPlatformRunner(platformPool),
    close: async () => {
      await Promise.all([appPool.end(), platformPool.end()]);
    },
  };
}

let defaultDb: QuadDb | undefined;

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

function getDefaultDb(): QuadDb {
  defaultDb ??= createDb({
    appUrl: databaseUrls().appUrl,
    platformUrl: databaseUrls().platformUrl,
    poolMax: parsePoolMax(process.env.DATABASE_POOL_MAX),
  });
  return defaultDb;
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
  return getDefaultDb().withTenant(tenantId, fn);
}

/**
 * Runs `fn` in a cross-tenant transaction on the default `quad_platform` pool from
 * DATABASE_PLATFORM_URL. Only for `apps/api/src/platform/**` and
 * `apps/api/src/worker/platform-jobs/**`.
 */
export async function withPlatform<T>(fn: (tx: PlatformTx) => Promise<T>): Promise<T> {
  return getDefaultDb().withPlatform(fn);
}

/** Ends the default pools (call on shutdown). Safe to call when they were never used. */
export async function closeDb(): Promise<void> {
  const db = defaultDb;
  defaultDb = undefined;
  await db?.close();
}
