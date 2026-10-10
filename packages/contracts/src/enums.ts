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

/** What a demo request asked for (D57 `platform_leads.kind`): a school's demo, or a parent's intro. */
export const LeadKind = z.enum(['school_demo', 'parent_intro']);
export type LeadKind = z.infer<typeof LeadKind>;

/** Where a lead came from (spec 04 `platform_leads.source`). */
export const LeadSource = z.enum(['landing', 'referral', 'event', 'manual']);
export type LeadSource = z.infer<typeof LeadSource>;

/** Where a lead stands with Quad's team (spec 04 `platform_leads.status`). */
export const LeadStatus = z.enum(['new', 'contacted', 'demo_booked', 'won', 'lost']);
export type LeadStatus = z.infer<typeof LeadStatus>;

/** A person's global account status (spec 04 `accounts.status`; also `platform_users.status`). */
export const AccountStatus = z.enum(['active', 'locked', 'disabled']);
export type AccountStatus = z.infer<typeof AccountStatus>;

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

/** A person's colour theme in one school (spec 04 `users.theme`; `PATCH /me`). */
export const ThemeChoice = z.enum(['system', 'light', 'dark']);
export type ThemeChoice = z.infer<typeof ThemeChoice>;

/**
 * A row of the permission matrix (spec 05 `role_permissions.module`). Not the same list as
 * `PlanModule`: the matrix has `attendance` and `settings`, the plan has `parent`.
 */
export const PermissionModule = z.enum([
  'admissions',
  'crm',
  'sis',
  'attendance',
  'lms',
  'fees',
  'finance',
  'transport',
  'settings',
]);
export type PermissionModule = z.infer<typeof PermissionModule>;

/**
 * A column of the permission matrix (spec 05), in bit order: `role_permissions.actions` is
 * `bit(5)` with `view` as the leftmost bit, so `'10000'` is view only and `'11111'` is everything.
 */
export const PermissionAction = z.enum(['view', 'create', 'edit', 'delete', 'approve']);
export type PermissionAction = z.infer<typeof PermissionAction>;

/** When parents see an early-warning concern (spec 04 `school_settings.ew_share_with_parents`). */
export const EarlyWarningSharing = z.enum(['off', 'after_plan', 'automatic']);
export type EarlyWarningSharing = z.infer<typeof EarlyWarningSharing>;

/** When absence alerts go to parents (spec 04 `school_settings.absence_alert`). */
export const AbsenceAlertMode = z.enum(['at_time', 'immediately']);
export type AbsenceAlertMode = z.infer<typeof AbsenceAlertMode>;

/** Who may see photos of a child (spec 12 Photo consent; `school_settings.photo_consent_default`). */
export const PhotoConsent = z.enum(['class', 'family', 'none']);
export type PhotoConsent = z.infer<typeof PhotoConsent>;

/** Where a school's own SMS sender ID stands (spec 08 General: "QUAD" until approved). */
export const SmsSenderStatus = z.enum(['requested', 'approved']);
export type SmsSenderStatus = z.infer<typeof SmsSenderStatus>;
