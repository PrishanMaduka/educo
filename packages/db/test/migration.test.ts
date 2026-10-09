import { describe, expect, it } from 'vitest';

import {
  ACCOUNT_TABLES,
  OPEN_TABLES,
  PLATFORM_TABLES,
  accountRlsSql,
  findTenancyViolations,
  runMigrations,
  tenantRlsSql,
} from '../src/internal';

import { useTestDatabase } from './setup';

import type { TableClasses } from '../src/internal';

const testDb = useTestDatabase();

async function withProbeTable(
  createSql: string,
  check: (violations: string[]) => void,
  classes?: TableClasses,
): Promise<void> {
  const { owner } = testDb();
  await owner.query(createSql);
  try {
    check(await findTenancyViolations(owner, classes));
  } finally {
    await owner.query('drop table if exists rls_probe');
  }
}

/** The real classes, plus `rls_probe` as an account table keyed on `account_id`. */
const PROBE_AS_ACCOUNT_TABLE: TableClasses = {
  platformTables: PLATFORM_TABLES,
  accountTables: {
    ...ACCOUNT_TABLES,
    rls_probe: { key: 'account_id', privileges: ['SELECT', 'INSERT', 'UPDATE'] },
  },
  openTables: OPEN_TABLES,
};

/** The real classes, plus `rls_probe` as an open table. */
const PROBE_AS_OPEN_TABLE: TableClasses = {
  platformTables: PLATFORM_TABLES,
  accountTables: ACCOUNT_TABLES,
  openTables: { ...OPEN_TABLES, rls_probe: { privileges: ['SELECT', 'INSERT'] } },
};

const ACCOUNT_PROBE_SQL = `create table rls_probe (account_id uuid not null);
  ${accountRlsSql('rls_probe', 'account_id', ['SELECT', 'INSERT', 'UPDATE'])}`;

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

describe('table classes: tenant, account, open and platform (D32)', () => {
  it('classifies every table: a tenant_id column, or listed as an account, open or platform table', async () => {
    const { rows } = await testDb().owner.query<{ name: string; has_tenant_id: boolean }>(
      `select case when n.nspname = 'public' then c.relname else n.nspname || '.' || c.relname end as name,
              exists (select 1 from pg_attribute a
                      where a.attrelid = c.oid and a.attname = 'tenant_id' and not a.attisdropped
                        and a.attnum > 0) as has_tenant_id
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where c.relkind in ('r', 'p') and n.nspname not in ('pg_catalog', 'information_schema')
         and n.nspname not like 'pg\\_%'`,
    );
    const listed = (name: string): number =>
      [
        PLATFORM_TABLES.includes(name),
        Object.hasOwn(ACCOUNT_TABLES, name),
        Object.hasOwn(OPEN_TABLES, name),
      ].filter(Boolean).length;
    const unclassified = rows.filter((row) => listed(row.name) === 0 && !row.has_tenant_id);
    const twice = rows.filter((row) => listed(row.name) > 1);
    expect(unclassified.map((row) => row.name)).toEqual([]);
    expect(twice.map((row) => row.name)).toEqual([]);
    for (const name of [
      'accounts',
      'credentials',
      'sessions',
      'trusted_devices',
      'otp_challenges',
      'platform_users',
      'platform_audit',
      'support_sessions',
      'signed_token_uses',
      'tenant_branding',
      'tenant_modules',
      'tenant_security',
    ]) {
      expect(rows.map((row) => row.name)).toContain(name);
    }
  });

  it('fails for an account table without FORCE RLS', async () => {
    await withProbeTable(
      `${ACCOUNT_PROBE_SQL}
       alter table rls_probe no force row level security;`,
      (violations) => {
        expect(violations).toEqual(['rls_probe: FORCE ROW LEVEL SECURITY missing']);
      },
      PROBE_AS_ACCOUNT_TABLE,
    );
  });

  it('passes for an account table set up with accountRlsSql', async () => {
    await withProbeTable(
      ACCOUNT_PROBE_SQL,
      (violations) => {
        expect(violations).toEqual([]);
      },
      PROBE_AS_ACCOUNT_TABLE,
    );
  });

  it('fails for an account table without its key column', async () => {
    await withProbeTable(
      `create table rls_probe (id uuid not null);
       alter table rls_probe enable row level security;
       alter table rls_probe force row level security;`,
      (violations) => {
        expect(violations).toEqual([
          'rls_probe: account_id column missing',
          'rls_probe: no row level security policy',
          'rls_probe: quad_app privileges must be SELECT, INSERT, UPDATE, found none',
        ]);
      },
      PROBE_AS_ACCOUNT_TABLE,
    );
  });

  it('fails for an account table with a policy on another column, an extra permissive policy or extra privileges', async () => {
    await withProbeTable(
      `create table rls_probe (id uuid not null, account_id uuid not null);
       ${accountRlsSql('rls_probe', 'id', ['SELECT', 'INSERT', 'UPDATE', 'DELETE'])}
       create policy open_select on rls_probe for select using (true);`,
      (violations) => {
        expect(violations).toEqual([
          'rls_probe: policy account_isolation does not match the account isolation expression on account_id',
          'rls_probe: policy open_select does not match the account isolation expression on account_id',
          'rls_probe: no permissive account isolation policy',
          'rls_probe: quad_app privileges must be SELECT, INSERT, UPDATE, found SELECT, INSERT, UPDATE, DELETE',
        ]);
      },
      PROBE_AS_ACCOUNT_TABLE,
    );
  });

  it('fails for an open table whose quad_app privileges differ from the declared set', async () => {
    await withProbeTable(
      `create table rls_probe (id uuid not null);
       grant select, insert, delete on rls_probe to quad_app;`,
      (violations) => {
        expect(violations).toEqual([
          'rls_probe: quad_app privileges must be SELECT, INSERT, found SELECT, INSERT, DELETE',
        ]);
      },
      PROBE_AS_OPEN_TABLE,
    );
  });

  it('fails for an open table with row level security', async () => {
    await withProbeTable(
      `create table rls_probe (id uuid not null);
       alter table rls_probe enable row level security;
       grant select, insert on rls_probe to quad_app;`,
      (violations) => {
        expect(violations).toEqual(['rls_probe: an open table must not enable row level security']);
      },
      PROBE_AS_OPEN_TABLE,
    );
  });

  it('fails for a table listed in more than one class', async () => {
    await withProbeTable(
      ACCOUNT_PROBE_SQL,
      (violations) => {
        expect(violations).toEqual(['rls_probe: listed in more than one table class']);
      },
      { ...PROBE_AS_ACCOUNT_TABLE, platformTables: [...PLATFORM_TABLES, 'rls_probe'] },
    );
  });

  it('fails for a platform table with a column grant to quad_app', async () => {
    const { owner } = testDb();
    await owner.query('grant select (name), update (status) on tenants to quad_app');
    try {
      expect(await findTenancyViolations(owner)).toEqual([
        'tenants: quad_app must have no column privileges',
      ]);
    } finally {
      await owner.query('revoke select (name), update (status) on tenants from quad_app');
    }
  });

  it('fails for an open table with a column grant beyond the declared privileges', async () => {
    await withProbeTable(
      `create table rls_probe (id uuid not null);
       grant select, insert on rls_probe to quad_app;
       grant update (id), references (id) on rls_probe to quad_app;`,
      (violations) => {
        expect(violations).toEqual([
          'rls_probe: quad_app has undeclared column privileges: UPDATE, REFERENCES',
        ]);
      },
      PROBE_AS_OPEN_TABLE,
    );
  });

  it('fails for an account table with a column grant beyond the declared privileges', async () => {
    await withProbeTable(
      `${ACCOUNT_PROBE_SQL}
       grant references (account_id) on rls_probe to quad_app;`,
      (violations) => {
        expect(violations).toEqual([
          'rls_probe: quad_app has undeclared column privileges: REFERENCES',
        ]);
      },
      PROBE_AS_ACCOUNT_TABLE,
    );
  });

  it('reports an undeclared table privilege once, not again as a column privilege', async () => {
    await withProbeTable(
      `create table rls_probe (id uuid not null);
       grant select, insert, update on rls_probe to quad_app;`,
      (violations) => {
        expect(violations).toEqual([
          'rls_probe: quad_app privileges must be SELECT, INSERT, found SELECT, INSERT, UPDATE',
        ]);
      },
      PROBE_AS_OPEN_TABLE,
    );
  });

  it('fails for a declared table that does not exist', async () => {
    const violations = await findTenancyViolations(testDb().owner, {
      platformTables: [...PLATFORM_TABLES, 'ghost_platform'],
      accountTables: {
        ...ACCOUNT_TABLES,
        ghost_account: { key: 'account_id', privileges: ['SELECT'] },
      },
      openTables: { ...OPEN_TABLES, ghost_open: { privileges: ['SELECT'] } },
    });
    expect(violations).toEqual([
      'ghost_platform: declared but missing',
      'ghost_account: declared but missing',
      'ghost_open: declared but missing',
    ]);
  });

  it('fails when quad_app can use a platform table sequence', async () => {
    const { owner } = testDb();
    await owner.query('grant usage on sequence drizzle.__drizzle_migrations_id_seq to quad_app');
    try {
      expect(await findTenancyViolations(owner)).toEqual([
        'drizzle.__drizzle_migrations_id_seq: quad_app must have no privileges on a platform sequence',
      ]);
    } finally {
      await owner.query('revoke all on sequence drizzle.__drizzle_migrations_id_seq from quad_app');
    }
  });

  it('gives quad_app no privilege on any platform table, its columns or its sequences', async () => {
    const { rows } = await testDb().owner.query<{
      name: string;
      table_privilege: boolean;
      column_privilege: boolean;
    }>(
      `select t.name,
              has_any_column_privilege('quad_app', t.name::regclass, 'SELECT, INSERT, UPDATE, REFERENCES')
                as column_privilege,
              (has_table_privilege('quad_app', t.name::regclass,
                 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')) as table_privilege
       from unnest($1::text[]) as t(name) order by t.name`,
      [PLATFORM_TABLES],
    );
    expect(rows).toHaveLength(PLATFORM_TABLES.length);
    expect(rows.filter((row) => row.table_privilege || row.column_privilege)).toEqual([]);
  });
});

/** Runs `ddl` as quad_owner in a transaction, checks the violations, then rolls it all back. */
async function withRolledBackChange(
  ddl: string,
  check: (violations: string[]) => void,
): Promise<void> {
  const client = await testDb().owner.connect();
  try {
    await client.query('begin');
    await client.query(ddl);
    check(await findTenancyViolations(client));
  } finally {
    await client.query('rollback');
    client.release();
  }
}

describe('definer_read (D32, amends D24)', () => {
  it('fails for a definer_read policy on a table outside the five', async () => {
    await withProbeTable(
      `create table rls_probe (tenant_id uuid not null);
       create index rls_probe_tenant_idx on rls_probe (tenant_id);
       ${tenantRlsSql('rls_probe')}
       create policy definer_read on rls_probe for select to quad_owner using (true);`,
      (violations) => {
        expect(violations).toEqual([
          'rls_probe: policy definer_read does not match the tenant isolation expression',
        ]);
      },
    );
  });

  it.each([
    ['roles', 'for select to quad_app using (true)', 'the tenant isolation expression'],
    ['users', 'for all to quad_owner using (true)', 'the tenant isolation expression'],
    ['users', 'for select to quad_owner, quad_app using (true)', 'the tenant isolation expression'],
    [
      'user_roles',
      'for select to quad_owner using (tenant_id is not null)',
      'the tenant isolation expression',
    ],
    ['accounts', 'for all to quad_owner using (true)', 'the account isolation expression on id'],
    ['sessions', 'for select using (true)', 'the account isolation expression on account_id'],
  ])('fails for definer_read on %s %s', async (table, clause, expression) => {
    await withRolledBackChange(
      `drop policy definer_read on ${table};
       create policy definer_read on ${table} ${clause};`,
      (violations) => {
        expect(violations).toEqual([`${table}: policy definer_read does not match ${expression}`]);
      },
    );
  });

  it('fails for a second SELECT-to-quad_owner policy under another name on a listed table', async () => {
    await withRolledBackChange(
      'create policy owner_read on roles for select to quad_owner using (true);',
      (violations) => {
        expect(violations).toEqual([
          'roles: policy owner_read does not match the tenant isolation expression',
        ]);
      },
    );
  });
});

describe('platform_audit is append-only', () => {
  it('refuses UPDATE and DELETE, even for quad_platform, and TRUNCATE, even for the owner', async () => {
    const { owner, platform } = testDb();
    await platform.query(
      `insert into platform_audit (action, target_type, meta) values ('test.recorded', 'test', '{}')`,
    );
    await expect(platform.query(`update platform_audit set action = 'changed'`)).rejects.toThrow(
      /append-only/,
    );
    await expect(platform.query('delete from platform_audit')).rejects.toThrow(/append-only/);
    // quad_platform has no TRUNCATE privilege, so only the owner reaches the trigger.
    await expect(owner.query('truncate platform_audit')).rejects.toThrow(/append-only/);
    const { rows } = await platform.query<{ action: string }>('select action from platform_audit');
    expect(rows).toEqual([{ action: 'test.recorded' }]);
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
