import { sql } from 'drizzle-orm';
import pg, { DatabaseError } from 'pg';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import {
  InvalidTenantIdError,
  createDb,
  createPlatformRunner,
  createTenantRunner,
  tenantRlsSql,
  tenants,
} from '../src/internal';

import { insertTenant } from './factories';
import { useTestDatabase } from './setup';

import type { PlatformRunner, Tenant, TenantRunner } from '../src/internal';

const testDb = useTestDatabase();

let withTenant: TenantRunner;
let withPlatform: PlatformRunner;
let schoolA: Tenant;
let schoolB: Tenant;

// A type alias (not an interface) so it satisfies Drizzle's Record<string, unknown> row bound.
type ProbeRow = {
  tenant_id: string;
  label: string;
};

beforeAll(async () => {
  const { app, platform, owner } = testDb();
  withTenant = createTenantRunner(app);
  withPlatform = createPlatformRunner(platform);
  await owner.query(`
    create table rls_probe_items (
      id uuid primary key default gen_random_uuid(),
      tenant_id uuid not null references tenants(id),
      label text not null
    );
    create index rls_probe_items_tenant_idx on rls_probe_items (tenant_id);
    ${tenantRlsSql('rls_probe_items')}
  `);
  schoolA = await insertTenant(withPlatform, { name: 'School A' });
  schoolB = await insertTenant(withPlatform, { name: 'School B' });
});

async function insertProbe(tenantId: string, label: string, rowTenantId = tenantId): Promise<void> {
  await withTenant(tenantId, (tx) =>
    tx.execute(
      sql`insert into rls_probe_items (tenant_id, label) values (${rowTenantId}, ${label})`,
    ),
  );
}

async function labelsFor(tenantId: string): Promise<string[]> {
  return withTenant(tenantId, async (tx) => {
    const result = await tx.execute<{ label: string }>(
      sql`select label from rls_probe_items order by label`,
    );
    return result.rows.map((row) => row.label);
  });
}

describe('withTenant', () => {
  it('hides a row written under school A from school B', async () => {
    await insertProbe(schoolA.id, 'a-only');
    expect(await labelsFor(schoolA.id)).toContain('a-only');
    expect(await labelsFor(schoolB.id)).not.toContain('a-only');
  });

  it("refuses to write a row with school B's id while in school A", async () => {
    const error: unknown = await insertProbe(schoolA.id, 'smuggled', schoolB.id).catch(
      (caught: unknown) => caught,
    );
    // Drizzle wraps the driver error; the Postgres error is its cause.
    const cause = error instanceof Error ? error.cause : undefined;
    expect(cause).toBeInstanceOf(DatabaseError);
    expect(cause).toMatchObject({ code: '42501' });
    expect((cause as DatabaseError).message).toMatch(/new row violates row-level security policy/);
    const all = await testDb().platform.query<ProbeRow>(
      `select tenant_id, label from rls_probe_items where label = 'smuggled'`,
    );
    expect(all.rows).toEqual([]);
  });

  it("cannot update or delete school A's rows from school B", async () => {
    await insertProbe(schoolA.id, 'keep-me');
    const updated = await withTenant(schoolB.id, (tx) =>
      tx.execute(sql`update rls_probe_items set label = 'hijacked' where label = 'keep-me'`),
    );
    const deleted = await withTenant(schoolB.id, (tx) =>
      tx.execute(sql`delete from rls_probe_items where label = 'keep-me'`),
    );
    expect(updated.rowCount).toBe(0);
    expect(deleted.rowCount).toBe(0);
    expect(await labelsFor(schoolA.id)).toContain('keep-me');
  });

  it('returns what the callback returns and commits its writes', async () => {
    const result = await withTenant(schoolA.id, async (tx) => {
      await tx.execute(
        sql`insert into rls_probe_items (tenant_id, label) values (${schoolA.id}, 'committed')`,
      );
      return 42;
    });
    expect(result).toBe(42);
    expect(await labelsFor(schoolA.id)).toContain('committed');
  });

  it('rolls back every write when the callback throws', async () => {
    await expect(
      withTenant(schoolA.id, async (tx) => {
        await tx.execute(
          sql`insert into rls_probe_items (tenant_id, label) values (${schoolA.id}, 'rolled-back')`,
        );
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await labelsFor(schoolA.id)).not.toContain('rolled-back');
  });

  describe('Review Focus #1: no tenant leaks onto the pooled connection', () => {
    async function rawCheck(): Promise<{ pid: number; count: number; setting: string | null }> {
      const { app } = testDb();
      const pid = await app.query<{ pid: number }>('select pg_backend_pid() as pid');
      const count = await app.query<{ count: string }>('select count(*) from rls_probe_items');
      const setting = await app.query<{ setting: string | null }>(
        `select current_setting('app.tenant_id', true) as setting`,
      );
      return {
        pid: pid.rows[0]!.pid,
        count: Number(count.rows[0]!.count),
        setting: setting.rows[0]!.setting,
      };
    }

    async function pidInsideTenant(): Promise<number> {
      return withTenant(schoolA.id, async (tx) => {
        const result = await tx.execute<{ pid: number; count: string }>(
          sql`select pg_backend_pid() as pid, (select count(*) from rls_probe_items) as count`,
        );
        expect(Number(result.rows[0]!.count)).toBeGreaterThan(0);
        return result.rows[0]!.pid;
      });
    }

    it('a raw quad_app query on the same connection after withTenant(A) sees 0 rows and no tenant', async () => {
      await insertProbe(schoolA.id, 'leak-check');
      const insidePid = await pidInsideTenant();
      const after = await rawCheck();
      expect(after.pid).toBe(insidePid);
      expect(after.count).toBe(0);
      expect(after.setting ?? '').toBe('');
    });

    it('leaves no tenant on the connection after a callback that throws', async () => {
      await expect(
        withTenant(schoolA.id, () => Promise.reject(new Error('fail inside'))),
      ).rejects.toThrow('fail inside');
      const after = await rawCheck();
      expect(after.count).toBe(0);
      expect(after.setting ?? '').toBe('');
    });

    it('survives a connection that dies mid-transaction: no unhandled error, and the pool recovers', async () => {
      await expect(
        withTenant(schoolA.id, (tx) =>
          tx.execute(sql`select pg_terminate_backend(pg_backend_pid())`),
        ),
      ).rejects.toThrow();
      // The app pool has one connection, so this only works if the dead one was replaced.
      expect(await labelsFor(schoolA.id)).toContain('a-only');
      const after = await rawCheck();
      expect(after.count).toBe(0);
    });

    it('returns 0 rows without an error when app.tenant_id was never set', async () => {
      const fresh = new pg.Pool({ connectionString: testDb().appUrl, max: 1 });
      try {
        const result = await fresh.query<{ count: string }>('select count(*) from rls_probe_items');
        expect(Number(result.rows[0]!.count)).toBe(0);
      } finally {
        await fresh.end();
      }
    });

    it('returns 0 rows without an error when app.tenant_id is an empty string', async () => {
      const fresh = new pg.Pool({ connectionString: testDb().appUrl, max: 1 });
      try {
        const client = await fresh.connect();
        try {
          await client.query(`select set_config('app.tenant_id', '', false)`);
          const result = await client.query<{ count: string }>(
            'select count(*) from rls_probe_items',
          );
          expect(Number(result.rows[0]!.count)).toBe(0);
        } finally {
          client.release();
        }
      } finally {
        await fresh.end();
      }
    });
  });

  describe('Review Focus #2: invalid tenant ids', () => {
    it.each([
      'nope',
      '',
      '0192a000-0000-7000-8000-00000000000g',
      `'; drop table tenants; --`,
      ' 0192a000-0000-7000-8000-000000000001',
    ])('withTenant(%j) throws InvalidTenantIdError without touching the database', async (id) => {
      const pool = testDb().app;
      const connect = vi.spyOn(pool, 'connect');
      const query = vi.spyOn(pool, 'query');
      const fn = vi.fn(() => Promise.resolve('ran'));
      try {
        await expect(withTenant(id, fn)).rejects.toBeInstanceOf(InvalidTenantIdError);
        expect(fn).not.toHaveBeenCalled();
        expect(connect).not.toHaveBeenCalled();
        expect(query).not.toHaveBeenCalled();
      } finally {
        connect.mockRestore();
        query.mockRestore();
      }
    });

    it('throws InvalidTenantIdError for a non-string id from untyped callers', async () => {
      const notAString: unknown = 42;
      await expect(
        withTenant(notAString as string, () => Promise.resolve(1)),
      ).rejects.toBeInstanceOf(InvalidTenantIdError);
    });
  });
});

describe('withPlatform', () => {
  it("sees every school's rows (BYPASSRLS) and can read tenants", async () => {
    await insertProbe(schoolB.id, 'b-row');
    const { labels, schoolNames } = await withPlatform(async (tx) => {
      const probe = await tx.execute<ProbeRow>(sql`select tenant_id, label from rls_probe_items`);
      const schools = await tx.select({ name: tenants.name }).from(tenants);
      return {
        labels: probe.rows.map((row) => row.label),
        schoolNames: schools.map((row) => row.name),
      };
    });
    expect(labels).toEqual(expect.arrayContaining(['a-only', 'b-row']));
    expect(schoolNames).toEqual(expect.arrayContaining(['School A', 'School B']));
  });

  it('rolls back when the callback throws', async () => {
    await expect(
      withPlatform(async (tx) => {
        await tx.insert(tenants).values({
          name: 'Ghost School',
          shortName: 'GS',
          slug: 'ghost-school',
          country: 'LK',
          timeZone: 'Asia/Colombo',
          currency: 'LKR',
          locale: 'en-LK',
        });
        throw new Error('undo');
      }),
    ).rejects.toThrow('undo');
    const result = await testDb().platform.query(
      `select 1 from tenants where slug = 'ghost-school'`,
    );
    expect(result.rowCount).toBe(0);
  });
});

describe('quad_owner is filtered too (FORCE RLS)', () => {
  it('sees 0 tenant rows without app.tenant_id', async () => {
    const result = await testDb().owner.query<{ count: string }>(
      'select count(*) from rls_probe_items',
    );
    expect(Number(result.rows[0]!.count)).toBe(0);
  });
});

describe('createDb', () => {
  it('builds withTenant and withPlatform from URLs and closes its pools', async () => {
    await insertProbe(schoolB.id, 'via-create-db');
    const db = createDb({ appUrl: testDb().appUrl, platformUrl: testDb().platformUrl, poolMax: 2 });
    try {
      const labels = await db.withTenant(schoolB.id, async (tx) => {
        const result = await tx.execute<ProbeRow>(
          sql`select tenant_id, label from rls_probe_items`,
        );
        return result.rows;
      });
      expect(labels).toContainEqual({ tenant_id: schoolB.id, label: 'via-create-db' });
      expect(labels.every((row) => row.tenant_id === schoolB.id)).toBe(true);
      const count = await db.withPlatform(async (tx) => (await tx.select().from(tenants)).length);
      expect(count).toBeGreaterThanOrEqual(2);
    } finally {
      await db.close();
    }
  });
});
