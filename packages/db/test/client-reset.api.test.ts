import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';

import { createPlatformRunner, createTenantRunner } from '../src/internal';

import { insertTenant } from './factories';
import { useTestDatabase } from './setup';

import type { Tenant, TenantRunner } from '../src/internal';

const testDb = useTestDatabase();

let withTenant: TenantRunner;
let school: Tenant;

beforeAll(async () => {
  // Test databases revoke PUBLIC's default TEMP; a normal database (and RDS) keeps it, so give
  // it back to quad_app here to prove the reset, not the missing privilege, removes temp tables.
  await testDb().owner.query(`grant temporary on database ${testDb().name} to quad_app`);
  withTenant = createTenantRunner(testDb().app);
  school = await insertTenant(createPlatformRunner(testDb().platform));
});

interface ConnectionState {
  pid: number;
  advisoryLocks: number;
  tempTable: string | null;
}

/** What the pool's single `quad_app` connection still holds, read outside any transaction. */
async function connectionState(): Promise<ConnectionState> {
  const { rows } = await testDb().app.query<{
    pid: number;
    advisory_locks: string;
    temp_table: string | null;
  }>(
    `select pg_backend_pid() as pid,
            (select count(*) from pg_locks
              where locktype = 'advisory' and pid = pg_backend_pid()) as advisory_locks,
            to_regclass('pg_temp.reset_probe')::text as temp_table`,
  );
  const row = rows[0];
  if (!row) {
    throw new Error('The state query returned no row.');
  }
  return { pid: row.pid, advisoryLocks: Number(row.advisory_locks), tempTable: row.temp_table };
}

describe('connection reset before release (D27 follow-up)', () => {
  it('drops session advisory locks and temp tables taken inside a transaction', async () => {
    const insidePid = await withTenant(school.id, async (tx) => {
      await tx.execute(sql`select pg_advisory_lock(4242)`);
      await tx.execute(sql`create temp table reset_probe (id int)`);
      const result = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
      return result.rows[0]?.pid;
    });
    expect(await connectionState()).toEqual({
      pid: insidePid,
      advisoryLocks: 0,
      tempTable: null,
    });
  });

  it('also cleans up after a callback that throws', async () => {
    await expect(
      withTenant(school.id, async (tx) => {
        await tx.execute(sql`select pg_advisory_lock(4243)`);
        await tx.execute(sql`create temp table reset_probe (id int) on commit preserve rows`);
        throw new Error('fail inside');
      }),
    ).rejects.toThrow('fail inside');
    const after = await connectionState();
    expect(after.advisoryLocks).toBe(0);
    expect(after.tempTable).toBeNull();
  });
});
