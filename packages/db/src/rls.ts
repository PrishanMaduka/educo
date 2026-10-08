import { ACCOUNT_TABLES, OPEN_TABLES } from './account-tables';
import { isSafeIdentifier } from './env';
import { PLATFORM_TABLES } from './platform-tables';

import type { AccountTable, OpenTable, TablePrivilege } from './account-tables';
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

/** The account match for `key`: like the tenant match, a query with no account sees no rows. */
function accountMatch(key: string): string {
  return `${key} = nullif(current_setting('app.account_id', true), '')::uuid`;
}

/**
 * SQL that makes `table` an account table (D32): ENABLE and FORCE row level security, the
 * `account_isolation` policy on `keyColumn` for reads and writes, and exactly `privileges` for
 * `quad_app`. Append it to the generated migration that creates the table, and list the table in
 * `ACCOUNT_TABLES` with the same key column and privileges.
 */
export function accountRlsSql(
  table: string,
  keyColumn: string,
  privileges: readonly TablePrivilege[],
): string {
  for (const name of [table, keyColumn]) {
    if (!isSafeIdentifier(name)) {
      throw new Error(`Unsafe identifier: ${JSON.stringify(name)}. Use a lowercase identifier.`);
    }
  }
  if (privileges.length === 0) {
    throw new Error(`Give quad_app at least one privilege on ${table}.`);
  }
  const match = accountMatch(keyColumn);
  return [
    `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`,
    '--> statement-breakpoint',
    `ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`,
    '--> statement-breakpoint',
    `CREATE POLICY account_isolation ON "${table}" FOR ALL USING (${match}) WITH CHECK (${match});`,
    '--> statement-breakpoint',
    `GRANT ${privileges.join(', ')} ON "${table}" TO quad_app;`,
    '',
  ].join('\n');
}

/** Anything that can run a parameterised query: a pool, a pooled client or a client. */
export type SqlQueryable = pg.Pool | pg.ClientBase;

/**
 * `TENANT_MATCH` as Postgres 16 deparses it (`pg_get_expr` on the policy). Every permissive
 * policy on a tenant table must use exactly this for USING and WITH CHECK; the migration test
 * proves `tenantRlsSql` produces it.
 */
export const DEPARSED_TENANT_MATCH =
  "(tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)";

/** `accountMatch(key)` as Postgres 16 deparses it. */
function deparsedAccountMatch(key: string): string {
  return `(${key} = (NULLIF(current_setting('app.account_id'::text, true), ''::text))::uuid)`;
}

const TENANT_DML = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] as const;
const ALL_TABLE_PRIVILEGES = [...TENANT_DML, 'TRUNCATE', 'REFERENCES', 'TRIGGER'] as const;
/** The privileges Postgres can also grant on single columns. */
const COLUMN_PRIVILEGES = ['SELECT', 'INSERT', 'UPDATE', 'REFERENCES'] as const;
const SEQUENCE_PRIVILEGES = 'USAGE, SELECT, UPDATE';

/** How each table is isolated (D32). A table in none of these lists is a tenant table. */
export interface TableClasses {
  readonly platformTables: readonly string[];
  readonly accountTables: Readonly<Record<string, AccountTable>>;
  readonly openTables: Readonly<Record<string, OpenTable>>;
}

/** The classes the schema declares: `PLATFORM_TABLES`, `ACCOUNT_TABLES` and `OPEN_TABLES`. */
export const TABLE_CLASSES: TableClasses = Object.freeze({
  platformTables: PLATFORM_TABLES,
  accountTables: ACCOUNT_TABLES,
  openTables: OPEN_TABLES,
});

interface TableRow {
  oid: number;
  name: string;
  rls: boolean;
  force: boolean;
  tenant_type: string | null;
  tenant_not_null: boolean | null;
  has_tenant_index: boolean;
  columns: string[];
  app_privileges: string[];
  /** Each of `COLUMN_PRIVILEGES` quad_app holds on at least one column (or the whole table). */
  app_column_privileges: string[];
}

interface SequenceRow {
  name: string;
  owner_table: string;
}

interface PolicyRow {
  oid: number;
  name: string;
  permissive: boolean;
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
             and i.indisvalid and i.indpred is null
         ) as has_tenant_index,
         array(
           select ca.attname::text from pg_attribute ca
           where ca.attrelid = c.oid and ca.attnum > 0 and not ca.attisdropped
           order by ca.attnum
         ) as columns,
         array(
           select p from unnest($2::text[]) with ordinality as t(p, ord)
           where exists (select 1 from pg_roles where rolname = 'quad_app')
             and has_any_column_privilege('quad_app', c.oid, p)
           order by ord
         ) as app_column_privileges,
         array(
           select p from unnest($1::text[]) with ordinality as t(p, ord)
           where exists (select 1 from pg_roles where rolname = 'quad_app')
             and has_table_privilege('quad_app', c.oid, p)
           order by ord
         ) as app_privileges
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_attribute a on a.attrelid = c.oid and a.attname = 'tenant_id' and not a.attisdropped
  where c.relkind in ('r', 'p')
    and n.nspname not in ('pg_catalog', 'information_schema')
    and n.nspname not like 'pg\\_%'
  order by name`;

/** Sequences owned by a table (serial or identity columns) that quad_app can use. */
const APP_SEQUENCES_SQL = `
  select case when n.nspname = 'public' then s.relname else n.nspname || '.' || s.relname end as name,
         case when tn.nspname = 'public' then t.relname else tn.nspname || '.' || t.relname end
           as owner_table
  from pg_class s
  join pg_namespace n on n.oid = s.relnamespace
  join pg_depend d on d.classid = 'pg_class'::regclass and d.objid = s.oid
    and d.refclassid = 'pg_class'::regclass and d.deptype in ('a', 'i')
  join pg_class t on t.oid = d.refobjid
  join pg_namespace tn on tn.oid = t.relnamespace
  where s.relkind = 'S'
    and exists (select 1 from pg_roles where rolname = 'quad_app')
    -- CASE, because the planner may otherwise call has_sequence_privilege on non-sequences.
    and case when s.relkind = 'S'
          then has_sequence_privilege('quad_app', s.oid, '${SEQUENCE_PRIVILEGES}') else false end
  order by name`;

const POLICIES_SQL = `
  select p.polrelid::int as oid,
         p.polname as name,
         p.polpermissive as permissive,
         pg_get_expr(p.polqual, p.polrelid) as qual,
         pg_get_expr(p.polwithcheck, p.polrelid) as with_check
  from pg_policy p
  order by p.polname`;

/**
 * A permissive policy isolates tenants only if every expression it has is the tenant match.
 * (A missing WITH CHECK falls back to USING, and an INSERT policy has only WITH CHECK.)
 */
function isIsolationPolicy(policy: PolicyRow, deparsedMatch: string): boolean {
  const expressions = [policy.qual, policy.with_check].filter((e): e is string => e !== null);
  return expressions.length > 0 && expressions.every((e) => e === deparsedMatch);
}

function isTenantIsolationPolicy(policy: PolicyRow): boolean {
  return isIsolationPolicy(policy, DEPARSED_TENANT_MATCH);
}

/** Collects `<table>: <problem>` lines for one table. */
function reporter(table: TableRow): { violations: string[]; report: (problem: string) => void } {
  const violations: string[] = [];
  return {
    violations,
    report: (problem) => {
      violations.push(`${table.name}: ${problem}`);
    },
  };
}

/**
 * Reports a privilege set that differs from the declared one, in a stable order, and any
 * undeclared privilege granted on single columns (`grant update (col)`), which
 * `has_table_privilege` does not see. An undeclared table privilege is reported once, as a table
 * privilege.
 */
function checkExactPrivileges(
  table: TableRow,
  declared: readonly TablePrivilege[],
  report: (problem: string) => void,
): void {
  const isDeclared = (privilege: string): boolean => declared.some((d) => d === privilege);
  const expected = ALL_TABLE_PRIVILEGES.filter(isDeclared);
  const found = table.app_privileges;
  if (expected.join(',') !== found.join(',')) {
    const foundText = found.length > 0 ? found.join(', ') : 'none';
    report(`quad_app privileges must be ${expected.join(', ')}, found ${foundText}`);
  }
  const columnOnly = table.app_column_privileges.filter(
    (privilege) => !isDeclared(privilege) && !found.includes(privilege),
  );
  if (columnOnly.length > 0) {
    report(`quad_app has undeclared column privileges: ${columnOnly.join(', ')}`);
  }
}

function accountTableViolations(
  table: TableRow,
  spec: AccountTable,
  policies: readonly PolicyRow[],
): string[] {
  const { violations, report } = reporter(table);
  if (!table.columns.includes(spec.key)) {
    report(`${spec.key} column missing`);
  }
  if (!table.rls) {
    report('ROW LEVEL SECURITY not enabled');
  }
  if (!table.force) {
    report('FORCE ROW LEVEL SECURITY missing');
  }
  const match = deparsedAccountMatch(spec.key);
  const permissive = policies.filter((policy) => policy.permissive);
  if (policies.length === 0) {
    report('no row level security policy');
  } else {
    for (const policy of permissive.filter((p) => !isIsolationPolicy(p, match))) {
      report(
        `policy ${policy.name} does not match the account isolation expression on ${spec.key}`,
      );
    }
    if (!permissive.some((p) => isIsolationPolicy(p, match))) {
      report('no permissive account isolation policy');
    }
  }
  checkExactPrivileges(table, spec.privileges, report);
  return violations;
}

function openTableViolations(table: TableRow, spec: OpenTable): string[] {
  const { violations, report } = reporter(table);
  if (table.rls) {
    report('an open table must not enable row level security');
  }
  checkExactPrivileges(table, spec.privileges, report);
  return violations;
}

function platformTableViolations(table: TableRow): string[] {
  if (table.app_privileges.length > 0) {
    return [`${table.name}: quad_app must have no privileges`];
  }
  if (table.app_column_privileges.length > 0) {
    return [`${table.name}: quad_app must have no column privileges`];
  }
  return [];
}

function tenantTableViolations(table: TableRow, policies: readonly PolicyRow[]): string[] {
  const { violations, report } = reporter(table);
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
  // Permissive policies are ORed together, so any permissive policy other than the tenant match
  // widens access. Restrictive policies are ANDed and can only narrow it.
  const permissive = policies.filter((policy) => policy.permissive);
  if (policies.length === 0) {
    report('no row level security policy');
  } else {
    for (const policy of permissive.filter((p) => !isTenantIsolationPolicy(p))) {
      report(`policy ${policy.name} does not match the tenant isolation expression`);
    }
    if (!permissive.some(isTenantIsolationPolicy)) {
      report('no permissive tenant isolation policy');
    }
  }
  const missing = TENANT_DML.filter((privilege) => !table.app_privileges.includes(privilege));
  if (missing.length > 0) {
    report(`quad_app missing ${missing.join(', ')}`);
  }
  return violations;
}

function classViolations(
  table: TableRow,
  classes: TableClasses,
  policies: readonly PolicyRow[],
): string[] {
  const isPlatform = classes.platformTables.includes(table.name);
  const account = Object.hasOwn(classes.accountTables, table.name)
    ? classes.accountTables[table.name]
    : undefined;
  const open = Object.hasOwn(classes.openTables, table.name)
    ? classes.openTables[table.name]
    : undefined;
  if ([isPlatform, account !== undefined, open !== undefined].filter(Boolean).length > 1) {
    return [`${table.name}: listed in more than one table class`];
  }
  if (isPlatform) {
    return platformTableViolations(table);
  }
  if (account) {
    return accountTableViolations(table, account, policies);
  }
  if (open) {
    return openTableViolations(table, open);
  }
  return tenantTableViolations(table, policies);
}

/** Every table `classes` names, platform first, then account, then open, as declared. */
function declaredTableNames(classes: TableClasses): string[] {
  return [
    ...classes.platformTables,
    ...Object.keys(classes.accountTables),
    ...Object.keys(classes.openTables),
  ];
}

/**
 * Lists every way the database breaks the tenancy rules (spec 02, D17; D32). Every table is in
 * exactly one class:
 * - **platform** (`PLATFORM_TABLES`): `quad_app` holds no table, column or sequence privilege;
 * - **account** (`ACCOUNT_TABLES`): its key column, ENABLE and FORCE row level security, the
 *   account isolation policy on that column as its only permissive policy, and exactly the
 *   declared `quad_app` privileges, with no other privilege granted on single columns;
 * - **open** (`OPEN_TABLES`): no row level security and exactly the declared privileges, again
 *   with no other column privilege;
 * - **tenant** (anything else, so an unclassified table fails here): a not-null uuid
 *   `tenant_id`, a valid, non-partial index led by `tenant_id`, ENABLE and FORCE row level
 *   security, the tenant isolation policy as its only permissive policy, and DML for `quad_app`.
 *
 * A declared table that does not exist is reported too, so a typo or a dropped table cannot
 * pass silently.
 *
 * `quad_app` must not bypass RLS or be a superuser. Returns `[]` when everything is in order.
 * Run it as `quad_owner`. `classes` defaults to the schema's own lists; tests pass probes.
 */
export async function findTenancyViolations(
  db: SqlQueryable,
  classes: TableClasses = TABLE_CLASSES,
): Promise<string[]> {
  const [tables, policies, sequences, roles] = await Promise.all([
    db.query<TableRow>(TABLES_SQL, [ALL_TABLE_PRIVILEGES, COLUMN_PRIVILEGES]),
    db.query<PolicyRow>(POLICIES_SQL),
    db.query<SequenceRow>(APP_SEQUENCES_SQL),
    db.query<RoleRow>(`select rolsuper, rolbypassrls from pg_roles where rolname = 'quad_app'`),
  ]);
  const violations = tables.rows.flatMap((table) =>
    classViolations(
      table,
      classes,
      policies.rows.filter((policy) => policy.oid === table.oid),
    ),
  );
  const existing = new Set(tables.rows.map((table) => table.name));
  for (const name of declaredTableNames(classes)) {
    if (!existing.has(name)) {
      violations.push(`${name}: declared but missing`);
    }
  }
  for (const sequence of sequences.rows) {
    if (classes.platformTables.includes(sequence.owner_table)) {
      violations.push(`${sequence.name}: quad_app must have no privileges on a platform sequence`);
    }
  }
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
