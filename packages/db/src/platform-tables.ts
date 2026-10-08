/**
 * The only tables allowed without `tenant_id` and a tenant policy (spec 04, Platform). Names in
 * schema `public` are bare; others are schema-qualified. Add a platform table here in the same
 * change that creates it.
 */
export const PLATFORM_TABLES: readonly string[] = Object.freeze([
  'tenants',
  // Written only through record_email_suppression (D16).
  'email_suppressions',
  // Drizzle's migration bookkeeping.
  'drizzle.__drizzle_migrations',
]);
