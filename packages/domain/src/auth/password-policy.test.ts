import { describe, expect, it } from 'vitest';

import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, checkPasswordPolicy } from './password-policy';

describe('checkPasswordPolicy', () => {
  it('has spec 05 floor of 10 characters', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(10);
  });

  it.each<[string, string, number, readonly string[]]>([
    ['10 characters at the floor', 'a'.repeat(10), 10, []],
    ['9 characters at the floor', 'a'.repeat(9), 10, ['too_short']],
    ['the empty string', '', 10, ['too_short']],
    ['11 characters for a school minimum of 12', 'a'.repeat(11), 12, ['too_short']],
    ['12 characters for a school minimum of 12', 'a'.repeat(12), 12, []],
    ['9 characters when a school asks for less than the floor', 'a'.repeat(9), 6, ['too_short']],
    ['10 characters when a school asks for less than the floor', 'a'.repeat(10), 6, []],
    ['the maximum length', 'a'.repeat(MAX_PASSWORD_LENGTH), 10, []],
    ['one over the maximum length', 'a'.repeat(MAX_PASSWORD_LENGTH + 1), 10, ['too_long']],
  ])('%s', (_name, password, minLength, reasons) => {
    expect(checkPasswordPolicy(password, { minLength })).toEqual(reasons);
  });

  it('counts characters, not UTF-16 code units (an emoji is one character)', () => {
    expect(checkPasswordPolicy('🔑'.repeat(9), { minLength: 10 })).toEqual(['too_short']);
    expect(checkPasswordPolicy('🔑'.repeat(10), { minLength: 10 })).toEqual([]);
  });

  it('counts spaces, so a passphrase of short words is fine', () => {
    expect(checkPasswordPolicy('red cat sky', { minLength: 10 })).toEqual([]);
  });
});
