/**
 * The platform tables (spec 04, Platform): no tenant policy and no `quad_app` privilege of any
 * kind (table, column or sequence). Names in schema `public` are bare; others are
 * schema-qualified. Add a platform table here in the same change that creates it.
 */
export const PLATFORM_TABLES: readonly string[] = Object.freeze([
  'tenants',
  // Written only through record_email_suppression (D16).
  'email_suppressions',
  'platform_users',
  // Append-only: a trigger refuses UPDATE, DELETE and TRUNCATE.
  'platform_audit',
  'support_sessions',
  'signed_token_uses',
  // School code reads these three through security-definer functions only (D24).
  'tenant_branding',
  'tenant_modules',
  'tenant_security',
  // Drizzle's migration bookkeeping.
  'drizzle.__drizzle_migrations',
]);
