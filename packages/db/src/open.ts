import { runInTransaction } from './client';

import type { QuadTransaction } from './client';
import type pg from 'pg';

/**
 * A transaction with neither `app.tenant_id` nor `app.account_id` set, for the open tables (D32,
 * `OPEN_TABLES`: `otp_challenges`), whose rows exist before anyone is known. Every tenant and
 * account table keeps its RLS, so they read as empty here.
 */
export type OpenTx = QuadTransaction;

export type OpenRunner = <T>(fn: (tx: OpenTx) => Promise<T>) => Promise<T>;

/** Builds `withOpen` over a `quad_app` pool: `BEGIN`, run `fn`, commit or roll back, release. */
export function createOpenRunner(pool: pg.Pool): OpenRunner {
  return <T>(fn: (tx: OpenTx) => Promise<T>): Promise<T> =>
    runInTransaction(pool, () => Promise.resolve(), fn);
}
