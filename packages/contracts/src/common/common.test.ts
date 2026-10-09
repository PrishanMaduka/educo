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
    expect(ErrorCode.options).toHaveLength(22);
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

  it('permission keys stub', () => {
    expect(PermissionKey.options).toEqual(['settings.edit', 'users.manage']);
  });
});
