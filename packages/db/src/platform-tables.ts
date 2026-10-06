/**
 * The only tables allowed without `tenant_id` and a tenant policy (spec 04, Platform). Names in
 * schema `public` are bare; others are schema-qualified. Add a platform table here in the same
 * change that creates it.
 */
export const PLATFORM_TABLES: readonly string[] = Object.freeze([
  'tenants',
  // Drizzle's migration bookkeeping.
  'drizzle.__drizzle_migrations',
]);
