/** Spec 05 step 7: five failures in 15 minutes lock the account for 15 minutes. */
export const LOCKOUT_FAILURES = 5;
export const LOCKOUT_WINDOW_MINUTES = 15;
export const LOCKOUT_MINUTES = 15;

const MINUTE_MS = 60_000;

export interface LockoutState {
  /** True when the recent failures reach `LOCKOUT_FAILURES`. */
  readonly locked: boolean;
  /** `now + LOCKOUT_MINUTES` when locked, otherwise null. */
  readonly lockedUntil: Date | null;
  /** Failures within the window ending at `now`. */
  readonly recentFailures: number;
}

/**
 * Whether failed sign-ins (wrong passwords and wrong two-step codes) lock the account at `now`.
 * The window is the 15 minutes up to `now`: a failure exactly 15:00 old has left it, and a
 * failure stamped after `now` (clock skew) does not count.
 */
export function lockoutState(failures: readonly Date[], now: Date): LockoutState {
  const windowStart = now.getTime() - LOCKOUT_WINDOW_MINUTES * MINUTE_MS;
  const recentFailures = failures.filter((at) => {
    const time = at.getTime();
    return time > windowStart && time <= now.getTime();
  }).length;
  const locked = recentFailures >= LOCKOUT_FAILURES;
  return {
    locked,
    lockedUntil: locked ? new Date(now.getTime() + LOCKOUT_MINUTES * MINUTE_MS) : null,
    recentFailures,
  };
}

/** True while a lock (`accounts.locked_until`) is in force; it ends at that instant. */
export function isLockedAt(lockedUntil: Date | null, now: Date): boolean {
  return lockedUntil !== null && now.getTime() < lockedUntil.getTime();
}
