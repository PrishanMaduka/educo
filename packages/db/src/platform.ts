import { runInTransaction } from './client';

import type { QuadTransaction } from './client';
import type pg from 'pg';

/** A cross-tenant transaction on the `quad_platform` (BYPASSRLS) pool. */
export type PlatformTx = QuadTransaction;

/** Runs `fn` in a platform transaction. */
export type PlatformRunner = <T>(fn: (tx: PlatformTx) => Promise<T>) => Promise<T>;

/**
 * Builds `withPlatform` over a `quad_platform` pool (spec 02, D17). Only
 * `apps/api/src/platform/**` and `apps/api/src/worker/platform-jobs/**` may use it, and every
 * write must be recorded in `platform_audit`.
 */
export function createPlatformRunner(pool: pg.Pool): PlatformRunner {
  return async <T>(fn: (tx: PlatformTx) => Promise<T>): Promise<T> =>
    runInTransaction(pool, () => Promise.resolve(), fn);
}
