export type { GreetingPeriod, GreetingResult } from './greeting/greeting-period';
export { greetingPeriod } from './greeting/greeting-period';
export type { EmailSuppressionInput } from './email/ses-suppressions';
export { suppressionsFromSesEvent } from './email/ses-suppressions';
export type { SignedLinkRule, SignedLinkStatus } from './auth/signed-link-status';
export {
  SIGNED_LINK_RULES,
  signedLinkExpiry,
  signedLinkIssuedAt,
  signedLinkStatus,
} from './auth/signed-link-status';
export type { PasswordPolicy, PasswordPolicyReason } from './auth/password-policy';
export {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  checkPasswordPolicy,
} from './auth/password-policy';
export type { SessionExpiry, SessionExpiryInput } from './auth/session-expiry';
export {
  ACCESS_TOKEN_MINUTES,
  CONSOLE_IDLE_HOURS,
  DEFAULT_SESSION_HOURS,
  KEEP_SIGNED_IN_DAYS,
  REFRESH_FAMILY_DAYS,
  SELECT_SCHOOL_MINUTES,
  SIGN_IN_STEP_MINUTES,
  sessionExpiry,
} from './auth/session-expiry';
export type { SignInFacts } from './auth/next-sign-in-step';
export { nextSignInStep } from './auth/next-sign-in-step';
export type { LockoutState } from './auth/lockout';
export {
  LOCKOUT_FAILURES,
  LOCKOUT_MINUTES,
  LOCKOUT_WINDOW_MINUTES,
  isLockedAt,
  lockoutState,
} from './auth/lockout';
export type { TwoStepResult, TwoStepRow } from './auth/two-step-rule';
export { strictestTwoStep } from './auth/two-step-rule';
export type { RandomBytes } from './auth/recovery-codes';
export {
  RECOVERY_CODE_COUNT,
  RECOVERY_CODE_PATTERN,
  generateRecoveryCodes,
  normaliseRecoveryCode,
} from './auth/recovery-codes';
export type { OtpSendDecision } from './auth/otp-send-decision';
export {
  OTP_CODE_MINUTES,
  OTP_DAILY_LIMIT,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_SECONDS,
  OTP_WINDOW_LIMIT,
  OTP_WINDOW_MINUTES,
  otpSendDecision,
} from './auth/otp-send-decision';
export type { FixedOtpConfig, OtpSubject } from './auth/fixed-otp';
export { fixedOtpFor, isStoreReviewSubject } from './auth/fixed-otp';
export type { PhoneCountry, PhoneParse } from './auth/phone-e164';
export { PHONE_COUNTRIES, parseInternationalPhone, parsePhone } from './auth/phone-e164';
export type { RefreshFacts, RefreshOutcome } from './auth/refresh-rotation';
export { refreshOutcome } from './auth/refresh-rotation';
export { firstNameOf } from './people/first-name';
export type { PermissionMatrix, PermissionRow, RoleGrant, RowChange } from './access/matrix';
export { FULL_ACCESS, NO_ACCESS, bitsOf, normaliseRow, rowOf } from './access/matrix';
export type { SystemRoleDefaults } from './access/system-roles';
export { systemRoleMatrix } from './access/system-roles';
export type { EffectivePermissionsInput } from './access/effective-permissions';
export { HIDDEN_FROM_SUPPORT, effectivePermissions } from './access/effective-permissions';
export { isPageVisible, pageAccess } from './access/page-access';
export { roleHome } from './access/role-home';
export { canGrant, sensitiveKeysOf } from './access/grant-checks';
export type { PlannedMatrix } from './access/matrix-plan';
export { planMatrix } from './access/matrix-plan';
export { maskEmail, nameFromEmail } from './people/email-name';
export type {
  StaffAction,
  StaffActionRefusal,
  StaffChange,
  StaffChangeRefusal,
} from './access/staff-changes';
export { staffActionRefusal, staffChangeRefusal, statusAfterChange } from './access/staff-changes';
