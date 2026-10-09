/** Spec 05: a school's default idle timeout when it has not set `session_hours`. */
export const DEFAULT_SESSION_HOURS = 12;
/** Spec 05: "Keep me signed in on this device". */
export const KEEP_SIGNED_IN_DAYS = 30;
/** Spec 05: console sessions time out after 8 hours idle. */
export const CONSOLE_IDLE_HOURS = 8;
/** Spec 05: a parent's rotating refresh token family lives 60 days. */
export const REFRESH_FAMILY_DAYS = 60;
/**
 * A session between the password and the school (two-step, set-up or Choose a school) lives this
 * long from the step that started it; Keep me signed in applies only once it is active (D32).
 */
export const SIGN_IN_STEP_MINUTES = 15;
/**
 * A parent whose code found several schools has this long to choose one with the
 * `select_school` token (OQ20).
 */
export const SELECT_SCHOOL_MINUTES = 5;
/** Spec 05: a parent's access token (JWT) lives 15 minutes. */
export const ACCESS_TOKEN_MINUTES = 15;
/** Spec 05: a support visit ("Open as school admin") lasts at most 60 minutes. */
export const SUPPORT_VISIT_MINUTES = 60;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** What decides when a session ends, by kind. `now` is passed in; nothing reads the clock. */
export type SessionExpiryInput =
  | {
      readonly kind: 'web';
      readonly lastSeenAt: Date;
      readonly keepSignedIn: boolean;
      /** The school's `session_hours`; `DEFAULT_SESSION_HOURS` when absent. */
      readonly sessionHours?: number;
      readonly now: Date;
    }
  | { readonly kind: 'console'; readonly lastSeenAt: Date; readonly now: Date }
  /** A support visit's `expires_at`: 60 minutes after it started, a hard limit (spec 05). */
  | { readonly kind: 'support'; readonly supportExpiresAt: Date; readonly now: Date }
  | { readonly kind: 'refresh_family'; readonly createdAt: Date; readonly now: Date }
  /** A session still in the sign-in steps; each step starts it afresh. */
  | { readonly kind: 'sign_in_step'; readonly startedAt: Date; readonly now: Date }
  /** A parent's choice of school after the code (OQ20). */
  | { readonly kind: 'select_school'; readonly startedAt: Date; readonly now: Date };

export interface SessionExpiry {
  readonly expiresAt: Date;
  /** True from the instant `now` reaches `expiresAt`. */
  readonly expired: boolean;
}

function webIdleMs(keepSignedIn: boolean, sessionHours: number): number {
  if (!Number.isInteger(sessionHours) || sessionHours < 1) {
    throw new RangeError('A session length must be a whole number of hours, at least 1.');
  }
  return keepSignedIn ? KEEP_SIGNED_IN_DAYS * DAY_MS : sessionHours * HOUR_MS;
}

function expiresAtOf(input: SessionExpiryInput): Date {
  switch (input.kind) {
    case 'web':
      return new Date(
        input.lastSeenAt.getTime() +
          webIdleMs(input.keepSignedIn, input.sessionHours ?? DEFAULT_SESSION_HOURS),
      );
    case 'console':
      return new Date(input.lastSeenAt.getTime() + CONSOLE_IDLE_HOURS * HOUR_MS);
    case 'support':
      return input.supportExpiresAt;
    case 'refresh_family':
      return new Date(input.createdAt.getTime() + REFRESH_FAMILY_DAYS * DAY_MS);
    case 'sign_in_step':
      return new Date(input.startedAt.getTime() + SIGN_IN_STEP_MINUTES * 60 * 1000);
    case 'select_school':
      return new Date(input.startedAt.getTime() + SELECT_SCHOOL_MINUTES * 60 * 1000);
  }
}

/**
 * When a session ends (spec 05, Sessions): web sessions after the school's idle timeout (30 days
 * with "Keep me signed in"), console sessions after 8 hours idle, support visits at their hard
 * limit, parent refresh families 60 days after they were created, a session still in the
 * sign-in steps 15 minutes after its last step, and a parent's choice of school 5 minutes after
 * the code.
 */
export function sessionExpiry(input: SessionExpiryInput): SessionExpiry {
  const expiresAt = expiresAtOf(input);
  return { expiresAt, expired: input.now.getTime() >= expiresAt.getTime() };
}

/**
 * When a support visit opened at `openedAt` ends: its `expires_at`, a hard limit that no activity
 * extends (spec 05, Support access). The visit's clock starts when the console makes the link.
 */
export function supportVisitExpiresAt(openedAt: Date): Date {
  return new Date(openedAt.getTime() + SUPPORT_VISIT_MINUTES * 60 * 1000);
}
