import { describe, expect, it } from 'vitest';

import { formatMoney } from './money';

describe('formatMoney', () => {
  it('shows LKR as Rs without decimals when the minor part is zero', () => {
    expect(formatMoney({ amountMinor: 31000000, currency: 'LKR' }, 'en-LK')).toBe('Rs 310,000');
  });
  it('keeps the cents when there are some', () => {
    expect(formatMoney({ amountMinor: 31000050, currency: 'LKR' }, 'en-LK')).toBe('Rs 310,000.50');
    expect(formatMoney({ amountMinor: 5, currency: 'LKR' }, 'en-LK')).toBe('Rs 0.05');
  });
  it('handles negatives and zero', () => {
    expect(formatMoney({ amountMinor: -250000, currency: 'LKR' }, 'en-LK')).toBe('-Rs 2,500');
    expect(formatMoney({ amountMinor: 0, currency: 'LKR' }, 'en-LK')).toBe('Rs 0');
  });
  it('uses Intl currency display for other currencies', () => {
    expect(formatMoney({ amountMinor: 12345, currency: 'USD' }, 'en-US')).toBe('$123.45');
    expect(formatMoney({ amountMinor: 500, currency: 'JPY' }, 'en-US')).toBe('¥500');
  });
  it('rejects non-integer minor units', () => {
    expect(() => formatMoney({ amountMinor: 10.5, currency: 'LKR' }, 'en-LK')).toThrow(RangeError);
  });
});
