import { formatMessage } from './delivery/templates/render';

import type { ErrorCode } from '@quad/contracts';

/** Default messages, plain English from the user's side (also used for framework errors). */
export const DEFAULT_MESSAGES = {
  validation: 'Some of the details are not valid. Check them and try again.',
  unauthorized: 'Please sign in to continue.',
  forbidden: 'You do not have permission to do that.',
  not_found: 'We could not find that.',
  conflict: 'That changed while you were working on it. Refresh and try again.',
  business_rule: 'That cannot be done right now.',
  app_update_required: 'Please update the Quad app to continue.',
  rate_limited: 'Too many requests. Wait a moment and try again.',
  invalid_link: 'This link has expired or has already been used. Ask for a new one.',
  internal: 'Something went wrong on our side. Please try again.',
} as const satisfies Partial<Record<ErrorCode, string>>;

/** Field-level messages keyed by dotted path (`guardians.0.phone`); `_root` for the whole value. */
export type ErrorFields = Readonly<Record<string, string>>;

/**
 * A failure the client should see, with a stable `code` from contracts and the HTTP status from
 * spec 06 (Conventions). Services throw these; the global filter turns them into
 * `{ code, message, fields? }`. Messages are plain English from the user's side.
 */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly status: number,
    readonly fields?: ErrorFields,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** 400: the request did not match its schema. */
export class ValidationError extends AppError {
  constructor(fields: ErrorFields, message: string = DEFAULT_MESSAGES.validation) {
    super('validation', message, 400, fields);
  }
}

/**
 * 401: no session or token, or one that has ended: revoked, expired, a deactivated membership
 * or a deleted school (spec 05; a suspended school is a 403 instead).
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = DEFAULT_MESSAGES.unauthorized) {
    super('unauthorized', message, 401);
  }
}

/** 403 for a cookie-authenticated write without a valid `X-CSRF-Token` (double submit, D32). */
export class CsrfError extends AppError {
  constructor() {
    super('forbidden', 'Your session needs refreshing. Reload the page and try again.', 403);
  }
}

/**
 * 415: a `text/plain` body (D28 follow-up): a cross-site form can send one without a preflight,
 * so only the SES webhook, which SNS calls that way, accepts it.
 */
export class UnsupportedMediaTypeError extends AppError {
  constructor() {
    super('validation', 'Send the request body as JSON.', 415);
  }
}

/** 404: the record does not exist, or belongs to another school (RLS hides it). */
export class NotFoundError extends AppError {
  constructor(message: string = DEFAULT_MESSAGES.not_found) {
    super('not_found', message, 404);
  }
}

export type ForbiddenCode = Extract<
  ErrorCode,
  'forbidden' | 'module_not_in_plan' | 'school_suspended'
>;

/** 403: signed in, but not allowed (spec 06: `forbidden`, `module_not_in_plan`, `school_suspended`). */
export class ForbiddenError extends AppError {
  constructor(code: ForbiddenCode = 'forbidden', message: string = DEFAULT_MESSAGES.forbidden) {
    super(code, message, 403);
  }
}

export type ConflictCode = Extract<
  ErrorCode,
  'conflict' | 'seat_limit' | 'slot_taken' | 'clash' | 'in_use'
>;

/** 409: the request clashes with the current state (spec 06: `conflict`, `seat_limit`, …). */
export class ConflictError extends AppError {
  constructor(
    code: ConflictCode = 'conflict',
    message: string = DEFAULT_MESSAGES.conflict,
    fields?: ErrorFields,
  ) {
    super(code, message, 409, fields);
  }
}

/** 422: valid input that a business rule from `packages/domain` refuses. */
export class BusinessRuleError extends AppError {
  constructor(code: ErrorCode, message: string, fields?: ErrorFields) {
    super(code, message, 422, fields);
  }
}

/**
 * 400: a signed link that cannot be used (spec 05). Every cause (a changed or forged token, the
 * wrong purpose, expired, already used) gets this one message, which never names the school.
 */
export class InvalidLinkError extends AppError {
  constructor() {
    super('invalid_link', DEFAULT_MESSAGES.invalid_link, 400);
  }
}

/** 429: too many requests (spec 06 → Rate limits). The filter sends `Retry-After`. */
export class RateLimitedError extends AppError {
  constructor(readonly retryAfterSeconds: number) {
    super('rate_limited', DEFAULT_MESSAGES.rate_limited, 429);
  }
}

/**
 * 401 for a sign-in that fails: an unknown email, a wrong password or a disabled account all
 * get this one answer, so the response never says whether an account exists (spec 05).
 */
export class InvalidCredentialsError extends AppError {
  constructor() {
    super('invalid_credentials', formatMessage('error.invalidCredentials'), 401);
  }
}

/** 403 while the lockout rule holds the account (spec 05 step 7, ruling F45). */
export class AccountLockedError extends AppError {
  constructor() {
    super('account_locked', formatMessage('error.accountLocked'), 403);
  }
}

/**
 * 400 for a code that does not match: a two-step or recovery code (it counts toward the lockout),
 * or a parent's sign-in code, which says so in its message.
 */
export class InvalidCodeError extends AppError {
  constructor(message: string = formatMessage('error.invalidCode')) {
    super('invalid_code', message, 400);
  }
}

/**
 * 503 when sign-in cannot reach the lockout counter (Redis): it fails closed rather than check a
 * password or code that could not be counted (D32). The person can try again shortly.
 */
export class UnavailableError extends AppError {
  constructor() {
    super('unavailable', formatMessage('error.signInUnavailable'), 503);
  }
}
