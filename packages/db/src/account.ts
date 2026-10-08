import { IdSchema } from '@quad/contracts';
import { sql } from 'drizzle-orm';

import { runInTransaction } from './client';
import { assertTenantId } from './tenant';

import type { QuadTransaction } from './client';
import type pg from 'pg';

/** A transaction scoped to one account: account tables are filtered by RLS to `app.account_id`. */
export type AccountTx = QuadTransaction;

/** Also scope the transaction to a school (both settings in one transaction). */
export interface AccountScope {
  readonly tenantId?: string;
}

/**
 * Runs `fn` in a transaction scoped to `accountId`, and optionally to `scope.tenantId` too.
 */
export interface AccountRunner {
  <T>(accountId: string, fn: (tx: AccountTx) => Promise<T>): Promise<T>;
  <T>(accountId: string, scope: AccountScope, fn: (tx: AccountTx) => Promise<T>): Promise<T>;
}

/** Thrown before any database call when an account id is not a uuid. */
export class InvalidAccountIdError extends Error {
  readonly code = 'invalid_account_id';

  constructor() {
    // The value is left out on purpose: it may be attacker-controlled and end up in logs.
    super('The account id is not a valid uuid.');
    this.name = 'InvalidAccountIdError';
  }
}

/** Throws `InvalidAccountIdError` unless `value` is a uuid string. */
export function assertAccountId(value: unknown): asserts value is string {
  if (!IdSchema.safeParse(value).success) {
    throw new InvalidAccountIdError();
  }
}

/**
 * Builds `withAccount` over a `quad_app` pool (D32): validate the ids, `BEGIN`,
 * `set_config('app.account_id', id, true)` (and `app.tenant_id` when a school is given), both
 * transaction-local, run `fn`, then commit or roll back and release.
 */
export function createAccountRunner(pool: pg.Pool): AccountRunner {
  async function withAccount<T>(
    accountId: string,
    scopeOrFn: AccountScope | ((tx: AccountTx) => Promise<T>),
    maybeFn?: (tx: AccountTx) => Promise<T>,
  ): Promise<T> {
    const scope = typeof scopeOrFn === 'function' ? {} : scopeOrFn;
    const fn = typeof scopeOrFn === 'function' ? scopeOrFn : maybeFn;
    if (!fn) {
      throw new TypeError('withAccount needs a callback.');
    }
    assertAccountId(accountId);
    const { tenantId } = scope;
    if (tenantId !== undefined) {
      assertTenantId(tenantId);
    }
    return runInTransaction(
      pool,
      (tx) =>
        tx.execute(
          tenantId === undefined
            ? sql`select set_config('app.account_id', ${accountId}, true)`
            : sql`select set_config('app.account_id', ${accountId}, true),
                         set_config('app.tenant_id', ${tenantId}, true)`,
        ),
      fn,
    );
  }
  return withAccount;
}
