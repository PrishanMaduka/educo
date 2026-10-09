import { describe, expect, it } from 'vitest';

import { ApiError } from './api';
import { actionMessageFor } from './error-copy';

const translate = (key: string) => `t:${key}`;

describe('actionMessageFor (a refused change in the portal)', () => {
  it.each([
    [422, 'last_admin', 'The school needs at least one active admin.'],
    [422, 'business_rule', 'You can’t change your own role or deactivate yourself.'],
    [409, 'in_use', 'Someone still has this role.'],
    [403, 'forbidden', 'You can’t give access to sensitive data you don’t have yourself.'],
  ])('shows the API’s own sentence for a %i %s', (status, code, message) => {
    expect(actionMessageFor(new ApiError(code, status, {}, message), translate)).toBe(message);
  });

  it('uses the fixed copy while previewing, and for anything unexpected', () => {
    expect(actionMessageFor(new ApiError('preview_read_only', 403, {}, 'x'), translate)).toBe(
      't:error.previewReadOnly',
    );
    expect(actionMessageFor(new ApiError('internal', 500, {}, 'boom'), translate)).toBe(
      't:error.somethingWentWrong',
    );
    expect(actionMessageFor(new TypeError('Failed to fetch'), translate)).toBe(
      't:error.somethingWentWrong',
    );
  });

  it('shows the first field message of a validation answer', () => {
    const error = new ApiError(
      'validation',
      400,
      { 'emails.0': 'Enter a valid email address' },
      'x',
    );
    expect(actionMessageFor(error, translate)).toBe('Enter a valid email address');
  });
});
