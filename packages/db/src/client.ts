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

/** Thrown when code uses a transaction after `withTenant` / `withPlatform` has finished it. */
export class TransactionClosedError extends Error {
  readonly code = 'transaction_closed';

  constructor() {
    super('This transaction has already finished; run the query inside the callback.');
    this.name = 'TransactionClosedError';
  }
}

/**
 * The connection as Drizzle sees it: identical, except that once the transaction has finished
 * every `query` is refused. A transaction that escapes its callback (a fire-and-forget query, a
 * stored reference) can then never run on a connection that has gone back to the pool and may
 * be serving another school.
 */
function guardClient(client: pg.PoolClient, isClosed: () => boolean): pg.PoolClient {
  return new Proxy(client, {
    get(target, property) {
      const value: unknown = Reflect.get(target, property, target);
      if (typeof value !== 'function') {
        return value;
      }
      if (property !== 'query') {
        const bound: unknown = value.bind(target);
        return bound;
      }
      return (...args: unknown[]): unknown => {
        if (isClosed()) {
          return Promise.reject(new TransactionClosedError());
        }
        const result: unknown = Reflect.apply(value, target, args);
        return result;
      };
    },
  });
}

/** Returns a connection to a clean state; one round trip, outside any transaction. */
const RESET_CONNECTION_SQL = 'reset all; select pg_advisory_unlock_all(); discard temp';

/**
 * Runs `fn` in one transaction on one checked-out connection, then always releases it.
 *
 * - We check out the connection ourselves rather than handing Drizzle the pool, so every
 *   statement (including `prepare`) runs on that connection.
 * - Drizzle gets a guarded view of it that refuses queries once we have settled.
 * - While it is checked out we listen for its `error` event (the pool only listens on idle
 *   connections, so a database restart mid-transaction would otherwise crash the process).
 * - Before release, `RESET ALL` clears anything `fn` set at session level (`set_config(…,
 *   false)`, `SET`), `pg_advisory_unlock_all()` drops session-level advisory locks and
 *   `DISCARD TEMP` drops temporary tables, so nothing outlives the transaction on a pooled
 *   connection (D27 follow-up).
 * - A connection that errored, or that we could not return to a clean state, is destroyed
 *   instead of going back to the pool.
 */
export async function runInTransaction<T>(
  pool: pg.Pool,
  prepare: (tx: QuadTransaction) => Promise<unknown>,
  fn: (tx: QuadTransaction) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  let closed = false;
  let broken: Error | undefined;
  const onError = (error: Error): void => {
    broken = error;
  };
  client.on('error', onError);
  try {
    const db = drizzle({ client: guardClient(client, () => closed), schema });
    return await db.transaction(async (tx) => {
      await prepare(tx);
      return fn(tx);
    });
  } catch (error) {
    // Drizzle has already sent ROLLBACK, but if that failed it throws the rollback error and we
    // cannot tell whether the transaction is still open. The reset below would succeed inside an
    // open transaction, so roll back once more on this failure path only. When Drizzle's
    // rollback did work, Postgres answers with a harmless "no transaction in progress" notice.
    if (!broken) {
      try {
        await client.query('rollback');
      } catch (rollbackError) {
        broken = toError(rollbackError);
      }
    }
    throw error;
  } finally {
    closed = true;
    if (!broken) {
      try {
        await client.query(RESET_CONNECTION_SQL);
      } catch (resetError) {
        broken = toError(resetError);
      }
    }
    client.off('error', onError);
    client.release(broken ?? false);
  }
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
