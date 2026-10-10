import { ApiError } from '@quad/client';
import { describe, expect, it } from 'vitest';

import { messageFor } from './error-copy';

const t = (key: string) => `[${key}]`;

describe('messageFor (the console’s copy for a failed call)', () => {
  it.each([
    ['invalid_credentials', 401, '[error.invalidCredentials]'],
    ['account_locked', 423, '[error.accountLocked]'],
    ['invalid_code', 401, '[error.invalidCode]'],
    ['rate_limited', 429, '[error.rateLimited]'],
    ['forbidden', 403, '[console.support.notAllowed]'],
    ['not_found', 404, '[console.support.notFound]'],
    ['internal', 500, '[error.somethingWentWrong]'],
  ])('says %s in plain words', (code, status, copy) => {
    expect(messageFor(new ApiError(code, status, {}, 'API text'), t)).toBe(copy);
  });

  it('gives a validation answer’s first field message', () => {
    expect(messageFor(new ApiError('validation', 400, { reason: 'Too short' }, 'Check'), t)).toBe(
      'Too short',
    );
  });

  it('is generic for anything that is not an API answer (a network failure)', () => {
    expect(messageFor(new TypeError('Failed to fetch'), t)).toBe('[error.somethingWentWrong]');
  });
});
