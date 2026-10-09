import { describe, expect, it } from 'vitest';

import { PHONE_COUNTRIES, parseInternationalPhone, parsePhone } from './phone-e164';

describe('PHONE_COUNTRIES (OQ12, D35: Sri Lankan mobiles only for now)', () => {
  it('lists only Sri Lanka: +94, mobiles 7 and 8 more digits, any number 9 digits not from 0', () => {
    expect(PHONE_COUNTRIES).toEqual([
      {
        country: 'LK',
        dialCode: '94',
        nationalDigits: 9,
        mobilePattern: '7\\d{8}',
        numberPattern: '[1-9]\\d{8}',
      },
    ]);
  });
});

describe('parsePhone', () => {
  it.each([
    ['77 000 0001', '+94770000001'],
    ['770000001', '+94770000001'],
    ['077 000 0001', '+94770000001'],
    ['+94 77 000 0001', '+94770000001'],
    ['+94 077 000 0001', '+94770000001'],
    ['+94770000001', '+94770000001'],
    ['0094 77 000 0001', '+94770000001'],
    ['0094 077 000 0001', '+94770000001'],
    ['(77) 000-0001', '+94770000001'],
    [' 77.000.0001 ', '+94770000001'],
  ])('reads %j as %s', (input, e164) => {
    expect(parsePhone('LK', input)).toEqual({ ok: true, e164 });
  });

  it.each([
    ['11 234 5678', 'a Colombo landline'],
    ['+94 11 234 5678', 'a landline with the code'],
    ['0077 000 0001', 'two trunk zeros'],
    ['+94 0077 000 0001', 'two trunk zeros after the code'],
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
  it.each(['+94 77 000 0001', '0094 77 000 0001', '+94 077 000 0001'])(
    'finds the country from the code in %j',
    (input) => {
      expect(parseInternationalPhone(input)).toEqual({ ok: true, e164: '+94770000001' });
    },
  );

  it.each(['+91 98765 43210', '0091 98765 43210'])(
    'refuses %j: a country that is not on the list',
    (input) => {
      expect(parseInternationalPhone(input)).toEqual({ ok: false, reason: 'unsupported_country' });
    },
  );

  it.each(['77 000 0001', '077 000 0001', '+94 11 234 5678', 'not a number'])(
    'refuses %j',
    (input) => {
      expect(parseInternationalPhone(input)).toEqual({ ok: false, reason: 'invalid_number' });
    },
  );
});
