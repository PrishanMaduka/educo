import { z } from 'zod';

/**
 * Enums mirrored by Postgres enums in `packages/db` (spec 04, Conventions).
 * Add values only; removing one needs a data migration and a decision log row.
 */

/** Where a school's data lives (spec 04 `tenants.region`, D21). */
export const TenantRegion = z.enum(['ap-south', 'me-central', 'ap-southeast']);
export type TenantRegion = z.infer<typeof TenantRegion>;

/** A school's account status (spec 04 `tenants.status`). */
export const TenantStatus = z.enum([
  'trial',
  'onboarding',
  'active',
  'past_due',
  'suspended',
  'deleted',
]);
export type TenantStatus = z.infer<typeof TenantStatus>;

/** School health level (spec 04 `school_health_snapshots.level`, also `tenants.health_override`). */
export const SchoolHealthLevel = z.enum(['thriving', 'watch', 'at_risk', 'paused']);
export type SchoolHealthLevel = z.infer<typeof SchoolHealthLevel>;

/** Why an address is suppressed (spec 04 `email_suppressions.reason`). */
export const EmailSuppressionReason = z.enum(['bounce', 'complaint', 'manual']);
export type EmailSuppressionReason = z.infer<typeof EmailSuppressionReason>;
