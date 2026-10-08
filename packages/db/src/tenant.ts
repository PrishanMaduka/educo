import { IdSchema } from '@quad/contracts';
import { sql } from 'drizzle-orm';

import { runInTransaction } from './client';

import type { QuadTransaction } from './client';
import type pg from 'pg';

/** A transaction scoped to one school: every query is filtered by RLS to `app.tenant_id`. */
export type TenantTx = QuadTransaction;

/** Runs `fn` in a transaction scoped to `tenantId`. */
export type TenantRunner = <T>(tenantId: string, fn: (tx: TenantTx) => Promise<T>) => Promise<T>;

/** Thrown before any database call when a tenant id is not a uuid. */
export class InvalidTenantIdError extends Error {
  readonly code = 'invalid_tenant_id';

  constructor() {
    // The value is left out on purpose: it may be attacker-controlled and end up in logs.
    super('The school id is not a valid uuid.');
    this.name = 'InvalidTenantIdError';
  }
}

/** Throws `InvalidTenantIdError` unless `value` is a uuid string. */
export function assertTenantId(value: unknown): asserts value is string {
  if (!IdSchema.safeParse(value).success) {
    throw new InvalidTenantIdError();
  }
}

/**
 * Builds `withTenant` over a `quad_app` pool (spec 02, Tenancy): validate the id, `BEGIN`,
 * `set_config('app.tenant_id', id, true)` (transaction-local, so it never outlives the
 * transaction on a pooled connection), run `fn`, then commit or roll back and release.
 */
export function createTenantRunner(pool: pg.Pool): TenantRunner {
  return async <T>(tenantId: string, fn: (tx: TenantTx) => Promise<T>): Promise<T> => {
    assertTenantId(tenantId);
    return runInTransaction(
      pool,
      (tx) => tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`),
      fn,
    );
  };
}
