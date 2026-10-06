import { isSafeIdentifier } from './env';
import { PLATFORM_TABLES } from './platform-tables';

import type pg from 'pg';

/**
 * The tenant match used by every policy. `current_setting(..., true)` returns null or '' when no
 * school is set, and `nullif` turns '' into null, so a query without a school sees no rows
 * instead of failing on `''::uuid`.
 */
const TENANT_MATCH = `tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid`;

/**
 * SQL that makes `table` a tenant table (spec 02, D17): ENABLE and FORCE row level security, the
 * `tenant_isolation` policy for reads and writes, and DML for `quad_app`. Append it to the
 * generated migration that creates the table, alongside a `(tenant_id, …)` index.
 */
export function tenantRlsSql(table: string): string {
  if (!isSafeIdentifier(table)) {
    throw new Error(`Unsafe table name: ${JSON.stringify(table)}. Use a lowercase identifier.`);
  }
  return [
    `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`,
    '--> statement-breakpoint',
    `ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`,
    '--> statement-breakpoint',
    `CREATE POLICY tenant_isolation ON "${table}" FOR ALL USING (${TENANT_MATCH}) WITH CHECK (${TENANT_MATCH});`,
    '--> statement-breakpoint',
    `GRANT SELECT, INSERT, UPDATE, DELETE ON "${table}" TO quad_app;`,
    '',
  ].join('\n');
}

/** Anything that can run a parameterised query: a pool, a pooled client or a client. */
export type SqlQueryable = pg.Pool | pg.ClientBase;

interface TableRow {
  oid: number;
  name: string;
  rls: boolean;
  force: boolean;
  tenant_type: string | null;
  tenant_not_null: boolean | null;
  has_tenant_index: boolean;
}

interface PolicyRow {
  oid: number;
  name: string;
  qual: string | null;
  with_check: string | null;
}

interface RoleRow {
  rolsuper: boolean;
  rolbypassrls: boolean;
}

const TABLES_SQL = `
  select c.oid::int as oid,
         case when n.nspname = 'public' then c.relname else n.nspname || '.' || c.relname end as name,
         c.relrowsecurity as rls,
         c.relforcerowsecurity as force,
         format_type(a.atttypid, a.atttypmod) as tenant_type,
         a.attnotnull as tenant_not_null,
         exists (
           select 1 from pg_index i
           join pg_attribute ia on ia.attrelid = i.indrelid and ia.attnum = i.indkey[0]
           where i.indrelid = c.oid and ia.attname = 'tenant_id'
         ) as has_tenant_index
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_attribute a on a.attrelid = c.oid and a.attname = 'tenant_id' and not a.attisdropped
  where c.relkind in ('r', 'p')
    and n.nspname not in ('pg_catalog', 'information_schema')
    and n.nspname not like 'pg\\_%'
  order by name`;

const POLICIES_SQL = `
  select p.polrelid::int as oid,
         p.polname as name,
         pg_get_expr(p.polqual, p.polrelid) as qual,
         pg_get_expr(p.polwithcheck, p.polrelid) as with_check
  from pg_policy p
  order by p.polname`;

function tableViolations(table: TableRow, policies: readonly PolicyRow[]): string[] {
  const violations: string[] = [];
  const report = (problem: string): void => {
    violations.push(`${table.name}: ${problem}`);
  };
  if (table.tenant_type === null) {
    report('tenant_id column missing');
  } else {
    if (table.tenant_type !== 'uuid') {
      report(`tenant_id must be uuid, found ${table.tenant_type}`);
    }
    if (table.tenant_not_null !== true) {
      report('tenant_id must be not null');
    }
    if (!table.has_tenant_index) {
      report('no index starting with tenant_id');
    }
  }
  if (!table.rls) {
    report('ROW LEVEL SECURITY not enabled');
  }
  if (!table.force) {
    report('FORCE ROW LEVEL SECURITY missing');
  }
  if (policies.length === 0) {
    report('no row level security policy');
  }
  for (const policy of policies) {
    const expressions = [policy.qual, policy.with_check].filter((e): e is string => e !== null);
    if (expressions.length === 0 || !expressions.every((e) => e.includes("'app.tenant_id'"))) {
      report(`policy ${policy.name} does not filter by app.tenant_id`);
    }
  }
  return violations;
}

/**
 * Lists every way the database breaks the tenancy rules (spec 02, D17): each table outside
 * `PLATFORM_TABLES` needs a not-null uuid `tenant_id`, an index led by `tenant_id`, ENABLE and
 * FORCE row level security, and policies that all filter by `app.tenant_id`; `quad_app` must
 * not bypass RLS. Returns `[]` when everything is in order. Run it as `quad_owner`.
 */
export async function findTenancyViolations(db: SqlQueryable): Promise<string[]> {
  const [tables, policies, roles] = await Promise.all([
    db.query<TableRow>(TABLES_SQL),
    db.query<PolicyRow>(POLICIES_SQL),
    db.query<RoleRow>(`select rolsuper, rolbypassrls from pg_roles where rolname = 'quad_app'`),
  ]);
  const violations = tables.rows
    .filter((table) => !PLATFORM_TABLES.includes(table.name))
    .flatMap((table) =>
      tableViolations(
        table,
        policies.rows.filter((policy) => policy.oid === table.oid),
      ),
    );
  const role = roles.rows[0];
  if (!role) {
    violations.push('quad_app: role missing');
  } else {
    if (role.rolbypassrls) {
      violations.push('quad_app: BYPASSRLS must be off');
    }
    if (role.rolsuper) {
      violations.push('quad_app: must not be a superuser');
    }
  }
  return violations;
}
