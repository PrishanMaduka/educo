import type { SignedLinkPayload, SignedLinkPurpose } from '@quad/contracts';

/** How long a link for one purpose lives, and whether its nonce may be used only once. */
export interface SignedLinkRule {
  /** Seconds from signing to expiry, or null when the link never expires. */
  readonly ttlSeconds: number | null;
  /** Single-use links record their nonce in `signed_token_uses` the first time they verify. */
  readonly singleUse: boolean;
}

/** Why a signed payload is or is not usable for a purpose right now. */
export type SignedLinkStatus = 'ok' | 'expired' | 'wrong_purpose' | 'malformed';

const MINUTE = 60;
const DAY = 24 * 60 * MINUTE;

/**
 * Lifetimes and single-use rules per purpose (spec 05; OQ7 for staff invites; D32).
 */
export const SIGNED_LINK_RULES: Readonly<Record<SignedLinkPurpose, SignedLinkRule>> = {
  password_reset: { ttlSeconds: 30 * MINUTE, singleUse: true },
  staff_invite: { ttlSeconds: 7 * DAY, singleUse: true },
  guardian_invite: { ttlSeconds: 30 * DAY, singleUse: true },
  relative_invite: { ttlSeconds: 30 * DAY, singleUse: true },
  support_session: { ttlSeconds: 2 * MINUTE, singleUse: true },
  calendar_feed: { ttlSeconds: null, singleUse: false },
  email_link: { ttlSeconds: 30 * DAY, singleUse: false },
};

/** Only an account-level password reset (Forgot password) is signed without a school (OQ8). */
const SCHOOL_LESS_PURPOSES: ReadonlySet<SignedLinkPurpose> = new Set(['password_reset']);

/** The `exp` (Unix seconds) of a link for `purpose` signed at `now`, or null if it never expires. */
export function signedLinkExpiry(purpose: SignedLinkPurpose, now: Date): number | null {
  const { ttlSeconds } = SIGNED_LINK_RULES[purpose];
  return ttlSeconds === null ? null : Math.floor(now.getTime() / 1000) + ttlSeconds;
}

/**
 * Whether a payload whose signature and shape have already been checked may be used for
 * `expectedPurpose` at `now`. Checked in order: the purpose, then the purpose's rules (a school
 * unless OQ8 allows none; an expiry exactly when the purpose has one), then the expiry. A link is
 * expired from the instant `now` reaches `exp`.
 */
export function signedLinkStatus(
  payload: SignedLinkPayload,
  expectedPurpose: SignedLinkPurpose,
  now: Date,
): SignedLinkStatus {
  if (payload.purpose !== expectedPurpose) {
    return 'wrong_purpose';
  }
  const neverExpires = SIGNED_LINK_RULES[payload.purpose].ttlSeconds === null;
  if (payload.tid === null && !SCHOOL_LESS_PURPOSES.has(payload.purpose)) {
    return 'malformed';
  }
  if (payload.exp === null) {
    return neverExpires ? 'ok' : 'malformed';
  }
  if (neverExpires) {
    return 'malformed';
  }
  return now.getTime() >= payload.exp * 1000 ? 'expired' : 'ok';
}
