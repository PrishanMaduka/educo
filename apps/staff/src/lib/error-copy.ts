import { ApiError, fieldError, isFieldError } from '@quad/client';

export { fieldError, isFieldError };

import type { MessageKey } from '@/i18n';

/**
 * What the sign-in pages and the portal shell say for an API error, from its `code` (spec 06) only: the API answers a
 * wrong password, an unknown email and a disabled account alike, so the copy never hints at
 * which it was.
 */
const BY_CODE: Readonly<Record<string, MessageKey>> = {
  invalid_credentials: 'error.invalidCredentials',
  account_locked: 'error.accountLocked',
  invalid_code: 'error.invalidCode',
  school_suspended: 'error.schoolSuspended',
  two_step_required: 'error.twoStepRequired',
  rate_limited: 'error.rateLimited',
  unavailable: 'error.signInUnavailable',
  invalid_link: 'link.invalid.title',
  forbidden: 'error.notYourSchool',
  preview_read_only: 'error.previewReadOnly',
};

/** The message key for a failed call; anything unexpected (a network error too) is generic. */
export function errorKeyFor(error: unknown): MessageKey {
  if (error instanceof ApiError) return BY_CODE[error.code] ?? 'error.somethingWentWrong';
  return 'error.somethingWentWrong';
}

/** A toast for a failed shell action: the API's field message for a validation answer, else the code's copy. */
export function messageFor(error: unknown, translate: (key: MessageKey) => string): string {
  if (error instanceof ApiError && error.code === 'validation') {
    const first = Object.values(error.fields)[0];
    if (first !== undefined) return first;
  }
  return translate(errorKeyFor(error));
}

/** Statuses whose API message is written for the person (spec 06): a refused change, in plain English. */
const SPOKEN_STATUSES: ReadonlySet<number> = new Set([403, 409, 422]);

/**
 * A toast for a refused change in the portal (Users & roles and later pages): the API's own
 * sentence for a 403, 409 or 422 ("The school needs at least one active admin…"), which en.json
 * gives the API, and the code's fixed copy otherwise (a preview, a server error).
 */
export function actionMessageFor(error: unknown, translate: (key: MessageKey) => string): string {
  if (
    error instanceof ApiError &&
    SPOKEN_STATUSES.has(error.status) &&
    error.code !== 'preview_read_only' &&
    error.message !== ''
  ) {
    return error.message;
  }
  return messageFor(error, translate);
}
