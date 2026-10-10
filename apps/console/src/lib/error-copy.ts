import { ApiError } from '@quad/client';

import type { MessageKey } from '@/i18n';

/**
 * What the console says for an API error, from its `code` (spec 06) only. A wrong password and an
 * unknown address get the same answer from the API, so the copy never hints at which it was.
 */
const BY_CODE: Readonly<Record<string, MessageKey>> = {
  invalid_credentials: 'error.invalidCredentials',
  account_locked: 'error.accountLocked',
  invalid_code: 'error.invalidCode',
  rate_limited: 'error.rateLimited',
  unavailable: 'error.signInUnavailable',
  forbidden: 'console.support.notAllowed',
  not_found: 'console.support.notFound',
};

/** The message for a failed call: a validation answer's first field message, else the code's copy. */
export function messageFor(error: unknown, translate: (key: MessageKey) => string): string {
  if (!(error instanceof ApiError)) return translate('error.somethingWentWrong');
  if (error.code === 'validation') {
    const first = Object.values(error.fields)[0];
    if (first !== undefined) return first;
  }
  return translate(BY_CODE[error.code] ?? 'error.somethingWentWrong');
}
