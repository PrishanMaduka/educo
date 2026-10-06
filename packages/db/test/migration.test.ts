import { describe, expect, it } from 'vitest';

import { findTenancyViolations, runMigrations, tenantRlsSql } from '../src/internal';

import { useTestDatabase } from './setup';

const testDb = useTestDatabase();

async function withProbeTable(
  createSql: string,
  check: (violations: string[]) => void,
): Promise<void> {
  const { owner } = testDb();
  await owner.query(createSql);
  try {
    check(await findTenancyViolations(owner));
  } finally {
    await owner.query('drop table if exists rls_probe');
  }
}

describe('migrations and the tenancy check', () => {
  it('every non-platform table has tenant_id, a tenant_id-leading index, FORCE RLS and a policy', async () => {
    expect(await findTenancyViolations(testDb().owner)).toEqual([]);
  });

  it('fails for a table without FORCE RLS', async () => {
    await withProbeTable(
      `create table rls_probe (tenant_id uuid not null);
       alter table rls_probe enable row level security;`,
      (violations) => {
        expect(violations).toEqual([
          'rls_probe: no index starting with tenant_id',
          'rls_probe: FORCE ROW LEVEL SECURITY missing',
          'rls_probe: no row level security policy',
        ]);
      },
    );
  });

  it('fails for a table without tenant_id or with a nullable or non-uuid tenant_id', async () => {
    await withProbeTable('create table rls_probe (id int)', (violations) => {
      expect(violations).toContain('rls_probe: tenant_id column missing');
      expect(violations).toContain('rls_probe: ROW LEVEL SECURITY not enabled');
    });
    await withProbeTable('create table rls_probe (tenant_id text)', (violations) => {
      expect(violations).toContain('rls_probe: tenant_id must be uuid, found text');
      expect(violations).toContain('rls_probe: tenant_id must be not null');
    });
  });

  it('fails for an index where tenant_id is not the first column', async () => {
    await withProbeTable(
      `create table rls_probe (id int, tenant_id uuid not null);
       create index rls_probe_id_tenant_idx on rls_probe (id, tenant_id);
       ${tenantRlsSql('rls_probe')}`,
      (violations) => {
        expect(violations).toEqual(['rls_probe: no index starting with tenant_id']);
      },
    );
  });

  it('fails for a policy that does not filter by app.tenant_id', async () => {
    await withProbeTable(
      `create table rls_probe (tenant_id uuid not null);
       create index rls_probe_tenant_idx on rls_probe (tenant_id);
       ${tenantRlsSql('rls_probe')}
       create policy open_door on rls_probe using (true);`,
      (violations) => {
        expect(violations).toEqual([
          'rls_probe: policy open_door does not filter by app.tenant_id',
        ]);
      },
    );
  });

  it('passes for a table set up with tenantRlsSql and a tenant_id index', async () => {
    await withProbeTable(
      `create table rls_probe (id int, tenant_id uuid not null);
       create index rls_probe_tenant_idx on rls_probe (tenant_id, id);
       ${tenantRlsSql('rls_probe')}`,
      (violations) => {
        expect(violations).toEqual([]);
      },
    );
  });

  it('is idempotent: running the migrations again changes nothing', async () => {
    await expect(runMigrations(testDb().ownerUrl)).resolves.toBeUndefined();
    expect(await findTenancyViolations(testDb().owner)).toEqual([]);
  });

  it('creates the extensions the schema relies on', async () => {
    const { rows } = await testDb().owner.query<{ extname: string }>(
      `select extname from pg_extension where extname in ('citext', 'pg_trgm') order by extname`,
    );
    expect(rows.map((row) => row.extname)).toEqual(['citext', 'pg_trgm']);
  });

  it('lets quad_platform read tenants but refuses quad_app (platform table, spec 02)', async () => {
    const { app, platform } = testDb();
    await expect(platform.query('select count(*) from tenants')).resolves.toBeTruthy();
    await expect(app.query('select count(*) from tenants')).rejects.toThrow(/permission denied/);
  });

  it('gives quad_app and quad_platform DML on tables quad_owner creates later, in a brand-new database', async () => {
    const { app, owner, platform } = testDb();
    await owner.query('create table default_grant_probe (id int)');
    try {
      await expect(app.query('insert into default_grant_probe values (1)')).resolves.toBeTruthy();
      const { rows } = await platform.query<{ id: number }>('select id from default_grant_probe');
      expect(rows).toEqual([{ id: 1 }]);
    } finally {
      await owner.query('drop table default_grant_probe');
    }
  });
});

describe('database roles (D17)', () => {
  it('quad_app has no BYPASSRLS', async () => {
    const { rows } = await testDb().owner.query<{ rolbypassrls: boolean }>(
      `select rolbypassrls from pg_roles where rolname = 'quad_app'`,
    );
    expect(rows).toEqual([{ rolbypassrls: false }]);
  });

  it('only quad_platform has BYPASSRLS among non-superuser roles', async () => {
    const { rows } = await testDb().owner.query<{ rolname: string }>(
      `select rolname from pg_roles where rolbypassrls and not rolsuper order by rolname`,
    );
    expect(rows.map((row) => row.rolname)).toEqual(['quad_platform']);
  });

  it('quad_app and quad_owner are not superusers, and quad_owner has no BYPASSRLS', async () => {
    const { rows } = await testDb().owner.query<{
      rolname: string;
      rolsuper: boolean;
      rolbypassrls: boolean;
    }>(
      `select rolname, rolsuper, rolbypassrls from pg_roles
       where rolname in ('quad_app', 'quad_owner') order by rolname`,
    );
    expect(rows).toEqual([
      { rolname: 'quad_app', rolsuper: false, rolbypassrls: false },
      { rolname: 'quad_owner', rolsuper: false, rolbypassrls: false },
    ]);
  });

  it('quad_app cannot create objects in schema public', async () => {
    const { app } = testDb();
    const { rows } = await app.query<{ allowed: boolean }>(
      `select has_schema_privilege('quad_app', 'public', 'CREATE') as allowed`,
    );
    expect(rows).toEqual([{ allowed: false }]);
    await expect(app.query('create table app_made (id int)')).rejects.toThrow(/permission denied/);
  });
});
