import { describe, expect, it } from 'vitest';

import {
  ErrorBodySchema,
  ErrorCode,
  IdSchema,
  MoneySchema,
  PageQuerySchema,
  PermissionKey,
  paginated,
} from '../index';

describe('contracts', () => {
  it('money rejects fractional minor units and accepts integers', () => {
    expect(MoneySchema.safeParse({ amountMinor: 1.5, currency: 'LKR' }).success).toBe(false);
    expect(MoneySchema.safeParse({ amountMinor: 31000000, currency: 'LKR' }).success).toBe(true);
    expect(MoneySchema.safeParse({ amountMinor: 1, currency: 'lkr' }).success).toBe(false);
  });

  it('page query defaults to 50 and caps at 200', () => {
    expect(PageQuerySchema.parse({}).limit).toBe(50);
    expect(PageQuerySchema.safeParse({ limit: 201 }).success).toBe(false);
    expect(PageQuerySchema.safeParse({ limit: 0 }).success).toBe(false);
  });

  it('paginated wraps items with a cursor', () => {
    const schema = paginated(IdSchema);
    expect(schema.safeParse({ items: [], nextCursor: null }).success).toBe(true);
    expect(schema.safeParse({ items: ['nope'], nextCursor: null }).success).toBe(false);
  });

  it('error body and codes', () => {
    expect(
      ErrorBodySchema.safeParse({ code: 'forbidden', message: 'No', fields: { a: 'b' } }).success,
    ).toBe(true);
    expect(ErrorCode.options).toContain('app_update_required');
    // 22 until Task 13 added last_admin, system_role_locked, already_member and own_role_locked;
    // Task 15 added family_member; M1b added captcha_failed and captcha_unavailable.
    expect(ErrorCode.options).toHaveLength(29);
  });

  it('has captcha_failed (400) and captcha_unavailable (503) for the demo forms (M1b, D57)', () => {
    expect(ErrorCode.parse('captcha_failed')).toBe('captcha_failed');
    expect(ErrorCode.parse('captcha_unavailable')).toBe('captcha_unavailable');
  });

  it('has invalid_link for every refused signed link (spec 05, one message for every cause)', () => {
    expect(ErrorCode.parse('invalid_link')).toBe('invalid_link');
  });

  it('has unavailable (503) for sign-in while the lockout counter cannot be reached', () => {
    expect(ErrorCode.parse('unavailable')).toBe('unavailable');
  });

  it('has an internal code for unexpected server errors (500)', () => {
    expect(ErrorCode.parse('internal')).toBe('internal');
  });

  it('permission keys come from the full catalogue', () => {
    expect(PermissionKey.options).toContain('settings.edit');
    expect(PermissionKey.options).toContain('users.manage');
  });
});
