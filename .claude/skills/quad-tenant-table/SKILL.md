---
name: quad-tenant-table
description: Recipe for adding or changing a database table or migration in Quad with Drizzle and Postgres row-level security (tenant_id, composite index, ENABLE + FORCE RLS, policy, cross-tenant test, safe migrations). Use whenever you touch packages/db schema or migrations.
---

# Adding a tenant table (or changing one)

Check `docs/spec/04-data-model.md` first: tables under a **[T]** heading are tenant tables, others are platform tables. Roles and RLS rules are in `02-architecture.md#database-roles-and-rls-d17`.

## Tenant table checklist
- [ ] `tenant_id uuid not null references tenants(id)` — **child tables too** (`invoice_lines`, `attendance_marks`…). Never rely on the parent row for isolation.
- [ ] Composite index starting with `tenant_id` for each access path (`(tenant_id, student_id)`, `(tenant_id, created_at desc)`). Unique constraints include `tenant_id` (`unique (tenant_id, admission_no)`).
- [ ] Foreign keys to other tenant tables are composite where practical (`(tenant_id, student_id) → students(tenant_id, id)`), so a row can't point into another school.
- [ ] RLS through the shared helper so you can't forget a step — it emits `ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL SECURITY` and the policy `tenant_id = current_setting('app.tenant_id')::uuid` for `USING` and `WITH CHECK`.
- [ ] `quad_app` gets DML grants only; no `BYPASSRLS` anywhere except `quad_platform`.
- [ ] Factory added to `packages/db/test/factories.ts`; seed updated if the prototypes show this data.
- [ ] One repository test proving tenant A cannot read or write tenant B's rows through `quad_app`.
- [ ] The migration test (which fails on any [T] table missing these) passes.

## Platform table checklist
No `tenant_id`, no tenant policy, reachable only via `withPlatform()` from `apps/api/src/platform/**` or `worker/platform-jobs/**`. Writes are recorded in `platform_audit`.

## Migrations
- Change the Drizzle schema, then `pnpm db:generate`. Read the generated SQL; hand-edit only to add RLS/helper calls or data backfills.
- Migrations are forward-only and must be safe on a live database:
  - add nullable column → backfill in batches → add `not null` in a later migration;
  - create indexes `concurrently` on large tables (in its own migration, no transaction);
  - never rename or drop a column the running API still reads: expand → migrate code → contract in a later release.
- Enum changes: add values only; removing needs a data migration and a decision log row.
- Run `pnpm db:reset` locally and the migration test before pushing.

## Security-definer functions
Only the ones named in spec 02 (D16). Owned by `quad_owner`, `set search_path = pg_catalog, public`, return the minimum columns, and have a cross-tenant test. Adding a new one is a decision log entry.

## Queries
- Every tenant query inside `withTenant(tenantId, tx => …)`; the raw client is banned outside `packages/db`.
- Append-only tables (`audit_log`, `platform_audit`): insert only; the trigger blocks update and delete.
