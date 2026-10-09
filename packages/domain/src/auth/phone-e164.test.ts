import { describe, expect, it } from 'vitest';

import { PHONE_COUNTRIES, parseInternationalPhone, parsePhone } from './phone-e164';

describe('PHONE_COUNTRIES (OQ12, D35: Sri Lanka only for now)', () => {
  it('lists only Sri Lanka, +94 with 9 national digits', () => {
    expect(PHONE_COUNTRIES).toEqual([{ country: 'LK', dialCode: '94', nationalDigits: 9 }]);
  });
});

describe('parsePhone', () => {
  it.each([
    ['77 000 0001', '+94770000001'],
    ['770000001', '+94770000001'],
    ['+94 77 000 0001', '+94770000001'],
    ['+94770000001', '+94770000001'],
    ['(77) 000-0001', '+94770000001'],
    [' 77.000.0001 ', '+94770000001'],
  ])('reads %j as %s', (input, e164) => {
    expect(parsePhone('LK', input)).toEqual({ ok: true, e164 });
  });

  it.each([
    ['077 000 0001', 'the leading 0'],
    ['+94 077 000 0001', 'the leading 0 after the code'],
    ['77 000 001', '8 digits'],
    ['77 000 00011', '10 digits'],
    ['+91 98765 43210', 'another country code'],
    ['77 000 OOO1', 'letters'],
    ['', 'nothing'],
    ['+', 'a plus alone'],
  ])('refuses %j (%s)', (input) => {
    expect(parsePhone('LK', input)).toEqual({ ok: false, reason: 'invalid_number' });
  });

  it('refuses a country that is not on the list', () => {
    expect(parsePhone('IN', '98765 43210')).toEqual({
      ok: false,
      reason: 'unsupported_country',
    });
  });
});

describe('parseInternationalPhone', () => {
  it('finds the country from the code', () => {
    expect(parseInternationalPhone('+94 77 000 0001')).toEqual({ ok: true, e164: '+94770000001' });
  });

  it('refuses a country that is not on the list', () => {
    expect(parseInternationalPhone('+91 98765 43210')).toEqual({
      ok: false,
      reason: 'unsupported_country',
    });
  });

  it.each(['77 000 0001', '0094 77 000 0001', '+94 077 000 0001', 'not a number'])(
    'refuses %j',
    (input) => {
      expect(parseInternationalPhone(input)).toEqual({ ok: false, reason: 'invalid_number' });
    },
  );
});
