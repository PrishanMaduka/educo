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

/** A person's global account status (spec 04 `accounts.status`; also `platform_users.status`). */
export const AccountStatus = z.enum(['active', 'locked', 'disabled']);
export type AccountStatus = z.infer<typeof AccountStatus>;

/** Single sign-on providers for staff (spec 04 `identities.provider`, spec 05). */
export const SsoProvider = z.enum(['google', 'microsoft']);
export type SsoProvider = z.infer<typeof SsoProvider>;

/** Which app a session belongs to (spec 04 `sessions.kind`). */
export const SessionKind = z.enum(['web', 'mobile', 'console']);
export type SessionKind = z.infer<typeof SessionKind>;

/** How far a session has come through the sign-in steps (`sessions.stage`, D32). */
export const SessionStage = z.enum(['two_step', 'two_step_setup', 'choose_school', 'active']);
export type SessionStage = z.infer<typeof SessionStage>;

/** Where a one-time code was sent (`otp_challenges.channel`, spec 05 Parent app). */
export const OtpChannel = z.enum(['sms', 'email']);
export type OtpChannel = z.infer<typeof OtpChannel>;

/** A Quad staff member's console role (spec 04 `platform_users.role`). */
export const PlatformRole = z.enum(['owner', 'admin', 'support', 'billing', 'readonly']);
export type PlatformRole = z.infer<typeof PlatformRole>;

/** Who a school's two-step rule covers (spec 04 `tenant_security.two_step`). */
export const TwoStepRule = z.enum(['off', 'admins', 'staff', 'all']);
export type TwoStepRule = z.infer<typeof TwoStepRule>;

/** A module a plan can include (spec 04 `tenant_modules.module`, `plans.modules`). */
export const PlanModule = z.enum([
  'admissions',
  'crm',
  'sis',
  'lms',
  'fees',
  'finance',
  'parent',
  'transport',
]);
export type PlanModule = z.infer<typeof PlanModule>;

/** What a person is in one school (spec 04 `users.kind`). */
export const MembershipKind = z.enum(['staff', 'guardian', 'relative']);
export type MembershipKind = z.infer<typeof MembershipKind>;

/** A membership's status (spec 04 `users.status`). */
export const MembershipStatus = z.enum(['invited', 'active', 'deactivated']);
export type MembershipStatus = z.infer<typeof MembershipStatus>;

/** How far a role reaches (spec 04 `roles.scope`). */
export const RoleScope = z.enum(['school', 'campus', 'own_classes']);
export type RoleScope = z.infer<typeof RoleScope>;

/** Sensitive data a role may be given (spec 04 `role_sensitive.key`, spec 05). */
export const SensitiveKey = z.enum(['safeguarding', 'medical', 'finance_reports', 'export_data']);
export type SensitiveKey = z.infer<typeof SensitiveKey>;
