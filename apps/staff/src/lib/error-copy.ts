import { ApiError } from './api';

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

/** The API's message for one field of a `validation` answer, if it named that field. */
export function fieldError(error: unknown, field: string): string | undefined {
  return error instanceof ApiError && error.code === 'validation' ? error.fields[field] : undefined;
}

/** True for a `validation` answer that named a field, which the field itself shows. */
export function isFieldError(error: unknown): boolean {
  return (
    error instanceof ApiError && error.code === 'validation' && Object.keys(error.fields).length > 0
  );
}

/** A toast for a failed shell action: the API's field message for a validation answer, else the code's copy. */
export function messageFor(error: unknown, translate: (key: MessageKey) => string): string {
  if (error instanceof ApiError && error.code === 'validation') {
    const first = Object.values(error.fields)[0];
    if (first !== undefined) return first;
  }
  return translate(errorKeyFor(error));
}
