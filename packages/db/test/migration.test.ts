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
          'rls_probe: quad_app missing SELECT, INSERT, UPDATE, DELETE',
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

  it('fails for a partial index on tenant_id', async () => {
    await withProbeTable(
      `create table rls_probe (tenant_id uuid not null, archived boolean);
       create index rls_probe_tenant_idx on rls_probe (tenant_id) where not archived;
       ${tenantRlsSql('rls_probe')}`,
      (violations) => {
        expect(violations).toEqual(['rls_probe: no index starting with tenant_id']);
      },
    );
  });

  it('fails for an extra permissive policy that opens the table', async () => {
    await withProbeTable(
      `create table rls_probe (tenant_id uuid not null);
       create index rls_probe_tenant_idx on rls_probe (tenant_id);
       ${tenantRlsSql('rls_probe')}
       create policy open_select on rls_probe for select using (true);`,
      (violations) => {
        expect(violations).toEqual([
          'rls_probe: policy open_select does not match the tenant isolation expression',
        ]);
      },
    );
  });

  it('fails for a policy that mentions app.tenant_id without matching on it', async () => {
    await withProbeTable(
      `create table rls_probe (tenant_id uuid not null);
       create index rls_probe_tenant_idx on rls_probe (tenant_id);
       alter table rls_probe enable row level security;
       alter table rls_probe force row level security;
       grant select, insert, update, delete on rls_probe to quad_app;
       create policy weak on rls_probe using (current_setting('app.tenant_id', true) is not null);`,
      (violations) => {
        expect(violations).toEqual([
          'rls_probe: policy weak does not match the tenant isolation expression',
          'rls_probe: no permissive tenant isolation policy',
        ]);
      },
    );
  });

  it('allows an extra restrictive policy, which can only narrow access', async () => {
    await withProbeTable(
      `create table rls_probe (tenant_id uuid not null);
       create index rls_probe_tenant_idx on rls_probe (tenant_id);
       ${tenantRlsSql('rls_probe')}
       create policy narrow on rls_probe as restrictive for delete using (false);`,
      (violations) => {
        expect(violations).toEqual([]);
      },
    );
  });

  it('fails for a tenant table quad_app cannot fully use', async () => {
    await withProbeTable(
      `create table rls_probe (tenant_id uuid not null);
       create index rls_probe_tenant_idx on rls_probe (tenant_id);
       ${tenantRlsSql('rls_probe')}
       revoke insert, update, delete on rls_probe from quad_app;`,
      (violations) => {
        expect(violations).toEqual(['rls_probe: quad_app missing INSERT, UPDATE, DELETE']);
      },
    );
  });

  it('fails for a platform table that quad_app can touch', async () => {
    const { owner } = testDb();
    await owner.query('grant select on tenants to quad_app');
    try {
      expect(await findTenancyViolations(owner)).toEqual([
        'tenants: quad_app must have no privileges',
      ]);
    } finally {
      await owner.query('revoke all on tenants from quad_app');
    }
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

  it('gives quad_platform, but not quad_app, DML on tables quad_owner creates later', async () => {
    const { app, owner, platform } = testDb();
    await owner.query('create table default_grant_probe (id int)');
    try {
      await expect(
        platform.query('insert into default_grant_probe values (1)'),
      ).resolves.toBeTruthy();
      const { rows } = await platform.query<{ id: number }>('select id from default_grant_probe');
      expect(rows).toEqual([{ id: 1 }]);
      await expect(app.query('select id from default_grant_probe')).rejects.toThrow(
        /permission denied/,
      );
    } finally {
      await owner.query('drop table default_grant_probe');
    }
  });

  it('gives nobody EXECUTE on functions quad_owner creates later', async () => {
    const { owner } = testDb();
    await owner.query(
      'create function default_grant_fn() returns int language sql as $$ select 1 $$',
    );
    try {
      const { rows } = await owner.query<{ app: boolean; platform: boolean }>(
        `select has_function_privilege('quad_app', 'default_grant_fn()', 'EXECUTE') as app,
                has_function_privilege('quad_platform', 'default_grant_fn()', 'EXECUTE') as platform`,
      );
      expect(rows).toEqual([{ app: false, platform: false }]);
    } finally {
      await owner.query('drop function default_grant_fn()');
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
    // Roles are cluster-wide: bootstrap.api.test.ts creates `qbt_platform_<10 hex digits>`
    // (randomBytes(5)) in parallel and checks its attributes itself.
    const { rows } = await testDb().owner.query<{ rolname: string }>(
      `select rolname from pg_roles
       where rolbypassrls and not rolsuper and rolname !~ '^qbt_platform_[0-9a-f]{10}$'
       order by rolname`,
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
