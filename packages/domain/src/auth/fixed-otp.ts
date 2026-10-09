/**
 * The code `STORE_REVIEW_PHONE` accepts (spec 09 Store publishing, spec 20 Review access): the
 * one number that takes a fixed code in production, given to the app stores in the review notes
 * and linked only to the App Review demo school. The number, set per environment, is what keeps
 * it closed; the code is the documented `DEV_FIXED_OTP` value.
 */
export const STORE_REVIEW_OTP = '000000';

export interface FixedOtpConfig {
  readonly appEnv: 'local' | 'staging' | 'production';
  /** `DEV_FIXED_OTP`: every code, in local and staging only (the config refuses it in production). */
  readonly devFixedOtp?: string | null;
  /** `STORE_REVIEW_PHONE` (E.164). */
  readonly storeReviewPhone?: string | null;
}

/** Who a sign-in code is for: a normalised E.164 phone number or a lower-cased email. */
export type OtpSubject = { readonly phone: string } | { readonly email: string };

/**
 * The fixed sign-in code for `subject`, or null when it gets a random one (spec 16: the
 * store-review and development back doors stay narrow). `DEV_FIXED_OTP` applies to everyone in
 * local and staging and never in production; `STORE_REVIEW_PHONE` gets `STORE_REVIEW_OTP` in
 * every environment, for its own number only, never for an email.
 */
export function fixedOtpFor(config: FixedOtpConfig, subject: OtpSubject): string | null {
  const devFixedOtp = config.devFixedOtp ?? null;
  if (config.appEnv !== 'production' && devFixedOtp !== null) {
    return devFixedOtp;
  }
  const reviewPhone = config.storeReviewPhone ?? null;
  if ('phone' in subject && reviewPhone !== null && subject.phone === reviewPhone) {
    return STORE_REVIEW_OTP;
  }
  return null;
}
