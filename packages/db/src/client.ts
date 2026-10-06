import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import * as schema from './schema';

import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

/** The raw Drizzle database. Only `packages/db` and its tests may hold one (`@quad/db/internal`). */
export type QuadDatabase = NodePgDatabase<typeof schema>;

/** A Drizzle transaction over the Quad schema. */
export type QuadTransaction = Parameters<Parameters<QuadDatabase['transaction']>[0]>[0];

export interface PoolOptions {
  /** Maximum connections in the pool. */
  readonly max?: number;
  /** Shown in `pg_stat_activity.application_name`. */
  readonly applicationName?: string;
  /** Called when an idle connection fails; pass the app logger. */
  readonly onError?: (error: Error) => void;
}

function warnIdleConnectionError(error: Error): void {
  process.emitWarning(`An idle Postgres connection failed: ${error.message}`, 'QuadDbWarning');
}

/** A `pg` pool with an idle-error listener, so a dropped connection never crashes the process. */
export function createPool(url: string, options: PoolOptions = {}): pg.Pool {
  const pool = new pg.Pool({
    connectionString: url,
    max: options.max ?? 10,
    application_name: options.applicationName ?? 'quad',
  });
  pool.on('error', options.onError ?? warnIdleConnectionError);
  return pool;
}

/**
 * Runs `fn` in one transaction on one checked-out connection, then always releases it.
 *
 * We check out the connection ourselves rather than handing Drizzle the pool, so every
 * statement (including `prepare`) is guaranteed to run on that connection. While it is checked
 * out we listen for its `error` event (the pool only listens on idle connections, so a database
 * restart mid-transaction would otherwise crash the process). If the transaction fails we send a
 * defensive `rollback`; if the connection errored or even that fails, it is destroyed instead of
 * returning to the pool in an unknown state.
 */
export async function runInTransaction<T>(
  pool: pg.Pool,
  prepare: (tx: QuadTransaction) => Promise<unknown>,
  fn: (tx: QuadTransaction) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  let broken: Error | undefined;
  const onError = (error: Error): void => {
    broken = error;
  };
  client.on('error', onError);
  try {
    const db = drizzle({ client, schema });
    return await db.transaction(async (tx) => {
      await prepare(tx);
      return fn(tx);
    });
  } catch (error) {
    if (!broken) {
      try {
        await client.query('rollback');
      } catch (rollbackError) {
        broken = rollbackError instanceof Error ? rollbackError : new Error(String(rollbackError));
      }
    }
    throw error;
  } finally {
    client.off('error', onError);
    client.release(broken ?? false);
  }
}
