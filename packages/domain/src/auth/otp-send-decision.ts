/** Spec 05 (parent app step 3): a sign-in code by SMS or email works for 10 minutes. */
export const OTP_CODE_MINUTES = 10;
/** Tries per code (D32): the fifth wrong one ends it, and a new code must be asked for. */
export const OTP_MAX_ATTEMPTS = 5;
/** Spec 05: "Resend after 30 s". */
export const OTP_RESEND_SECONDS = 30;
/** Spec 05: at most 3 codes per 15 minutes per number or address… */
export const OTP_WINDOW_MINUTES = 15;
export const OTP_WINDOW_LIMIT = 3;
/** …and 10 per day (the 24 hours up to now). */
export const OTP_DAILY_LIMIT = 10;

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const DAY_MS = 24 * 60 * MINUTE_MS;

export interface OtpSendDecision {
  readonly allowed: boolean;
  /** Whole seconds until the next code may be sent; 0 when allowed (the `Retry-After` value). */
  readonly retryAfter: number;
}

/**
 * How long until one more send fits a limit of `limit` sends per `windowMs`: the send that would
 * then be the oldest one too many must first leave the window. 0 when it already fits.
 */
function waitForWindow(sorted: readonly number[], nowMs: number, windowMs: number, limit: number) {
  const inWindow = sorted.filter((time) => time > nowMs - windowMs);
  const excess = inWindow.slice(0, Math.max(0, inWindow.length - limit + 1));
  return Math.max(0, ...excess.map((time) => time + windowMs - nowMs));
}

/**
 * Whether one more code may be sent to a subject now, from the times of the codes already sent
 * to it (spec 05): 30 s after the last, at most 3 in any 15 minutes and 10 in any 24 hours. A
 * send exactly a window old has left that window; one stamped after `now` (clock skew) counts as
 * just sent. When several limits refuse, the longest wait is given.
 */
export function otpSendDecision(history: readonly Date[], now: Date): OtpSendDecision {
  const nowMs = now.getTime();
  const sorted = history.map((at) => at.getTime()).sort((a, b) => a - b);
  const latest = Math.max(Number.NEGATIVE_INFINITY, ...sorted);
  const waitMs = Math.max(
    latest + OTP_RESEND_SECONDS * SECOND_MS - nowMs,
    waitForWindow(sorted, nowMs, OTP_WINDOW_MINUTES * MINUTE_MS, OTP_WINDOW_LIMIT),
    waitForWindow(sorted, nowMs, DAY_MS, OTP_DAILY_LIMIT),
  );
  return waitMs > 0
    ? { allowed: false, retryAfter: Math.ceil(waitMs / SECOND_MS) }
    : { allowed: true, retryAfter: 0 };
}
