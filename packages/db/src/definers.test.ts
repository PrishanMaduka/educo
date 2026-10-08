import { describe, expect, it } from 'vitest';

import { createDefinerCalls } from './definers';

import type { TenantTx } from './tenant';
import type pg from 'pg';

/** A transaction stand-in whose `execute` answers with the given rows (no database). */
function txReturning(rows: readonly Record<string, unknown>[]): TenantTx {
  const fake = { execute: () => Promise.resolve({ rows }) };
  return fake as unknown as TenantTx;
}

// The tenant-scoped calls only use the caller's transaction, never the pool.
const definers = createDefinerCalls({} as pg.Pool);

describe('ensureAccountForEmail', () => {
  it('returns the id of the row the definer returned', async () => {
    const id = '0192a6f4-1b2c-7d3e-8f40-123456789abc';
    await expect(
      definers.ensureAccountForEmail(txReturning([{ id }]), 'a@example.test'),
    ).resolves.toBe(id);
  });

  it.each([[[]], [[{ id: null }]], [[{}]]])(
    'refuses %j instead of returning a missing account id',
    async (rows) => {
      await expect(
        definers.ensureAccountForEmail(txReturning(rows), 'a@example.test'),
      ).rejects.toThrow(/ensure_account_for_email returned a row in an unexpected shape/);
    },
  );
});
