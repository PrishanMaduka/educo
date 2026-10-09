import { describe, expect, it } from 'vitest';

import { parseOfficePhone } from './office-phone';

describe('parseOfficePhone (D35: checked against the school’s own country)', () => {
  it.each([
    ['a Colombo landline with its trunk 0', '011 234 5678', '+94112345678'],
    ['a landline in full', '+94 11 234 5678', '+94112345678'],
    ['the 0094 prefix', '0094-11-234-5678', '+94112345678'],
    ['a mobile', '077 000 0001', '+94770000001'],
    ['the national digits without the trunk 0', '11 234 5678', '+94112345678'],
    ['brackets and dots', '(011) 234.5678', '+94112345678'],
  ])('reads %s in Sri Lanka', (_name, input, e164) => {
    expect(parseOfficePhone('LK', input)).toEqual({ ok: true, e164 });
  });

  it.each([
    ['too short', '011 234 567'],
    ['too long', '011 234 56789'],
    ['another country’s code', '+44 20 7946 0000'],
    ['letters', '011 CALL NOW'],
    ['a national number starting 0 after the trunk', '00 11 234 5678'],
  ])('refuses %s for a Sri Lankan school', (_name, input) => {
    expect(parseOfficePhone('LK', input)).toEqual({ ok: false, reason: 'invalid_number' });
  });

  it('takes a full international number for a country without a number plan yet', () => {
    expect(parseOfficePhone('GB', '+44 20 7946 0000')).toEqual({ ok: true, e164: '+442079460000' });
    expect(parseOfficePhone('AE', '00971 4 123 4567')).toEqual({ ok: true, e164: '+97141234567' });
  });

  it.each([
    ['a national number', '020 7946 0000'],
    ['too few digits', '+44 2079'],
    ['too many digits', '+44 2079 4600 0000 12'],
    ['a code starting 0', '+0 2079 460 000'],
  ])('refuses %s for such a country', (_name, input) => {
    expect(parseOfficePhone('GB', input)).toEqual({ ok: false, reason: 'invalid_number' });
  });

  it('never takes the Sri Lankan plan for a school elsewhere (no global default)', () => {
    expect(parseOfficePhone('GB', '011 234 5678').ok).toBe(false);
  });
});
