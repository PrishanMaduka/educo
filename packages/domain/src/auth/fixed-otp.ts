export interface FixedOtpConfig {
  readonly appEnv: 'local' | 'staging' | 'production';
  /** `DEV_FIXED_OTP`: every code, in local only (D46; the config refuses it anywhere else). */
  readonly devFixedOtp?: string | null;
  /** `STORE_REVIEW_PHONE` (E.164): the app-store review account's number (spec 09, 20). */
  readonly storeReviewPhone?: string | null;
  /** `STORE_REVIEW_OTP`: that number's fixed code, a secret set with it. */
  readonly storeReviewOtp?: string | null;
}

/** Who a sign-in code is for: a normalised E.164 phone number or a lower-cased email. */
export type OtpSubject = { readonly phone: string } | { readonly email: string };

/**
 * Whether `subject` is the store-review number with its code configured (spec 16): its sign-in
 * may reach only the App Review school (`STORE_REVIEW_TENANT_ID`).
 */
export function isStoreReviewSubject(
  config: Pick<FixedOtpConfig, 'storeReviewPhone' | 'storeReviewOtp'>,
  subject: OtpSubject,
): boolean {
  const reviewPhone = config.storeReviewPhone ?? null;
  return (
    'phone' in subject &&
    reviewPhone !== null &&
    (config.storeReviewOtp ?? null) !== null &&
    subject.phone === reviewPhone
  );
}

/**
 * The fixed sign-in code for `subject`, or null when it gets a random one (spec 16: the
 * store-review and development back doors stay narrow). `STORE_REVIEW_OTP` goes to
 * `STORE_REVIEW_PHONE` only, in every environment, never to an email; `DEV_FIXED_OTP` applies to
 * everyone else in local only, never in staging or production (D46).
 */
export function fixedOtpFor(config: FixedOtpConfig, subject: OtpSubject): string | null {
  const reviewOtp = config.storeReviewOtp ?? null;
  if (reviewOtp !== null && isStoreReviewSubject(config, subject)) return reviewOtp;
  const devFixedOtp = config.devFixedOtp ?? null;
  return config.appEnv === 'local' && devFixedOtp !== null ? devFixedOtp : null;
}
