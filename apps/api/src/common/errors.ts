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
