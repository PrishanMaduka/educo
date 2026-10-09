import { describe, expect, it } from 'vitest';

import {
  ErrorCode,
  PasswordForgotInput,
  PasswordResetInput,
  PasswordSignInInput,
  SelectSchoolInput,
  SignInMembershipList,
  SignInNext,
  SignInResult,
  TotpVerifyInput,
} from '../index';

const SCHOOL_ID = '0192a6f4-1b2c-7d3e-8f40-123456789abc';

const pathOf = (result: { success: boolean; error?: { issues: { path: unknown[] }[] } }) =>
  result.error?.issues[0]?.path;

describe('error codes for sign-in (spec 05, Task 7)', () => {
  it.each([
    'invalid_credentials',
    'account_locked',
    'invalid_link',
    'two_step_required',
    'preview_read_only',
    'invalid_code',
  ])('has %s', (code) => {
    expect(ErrorCode.safeParse(code).success).toBe(true);
  });
});

describe('PasswordSignInInput', () => {
  it('trims and lower-cases the work email', () => {
    expect(
      PasswordSignInInput.parse({
        email: '  Prishan.Maduka@Colombo-Intl.Local ',
        password: 'correct horse',
      }).email,
    ).toBe('prishan.maduka@colombo-intl.local');
  });

  it('defaults Keep me signed in to off', () => {
    expect(
      PasswordSignInInput.parse({ email: 'a@b.lk', password: 'correct horse' }).keepSignedIn,
    ).toBe(false);
  });

  it.each<[object, string]>([
    [{ email: 'a@b.lk', password: '' }, 'password'],
    [{ email: 'a@b.lk', password: 'x'.repeat(1025) }, 'password'],
    [{ email: 'nope', password: 'correct horse' }, 'email'],
    [{ email: 'a@b.lk', password: 'correct horse', keepSignedIn: 'yes' }, 'keepSignedIn'],
  ])('refuses %j at %s', (input, path) => {
    expect(pathOf(PasswordSignInInput.safeParse(input))).toEqual([path]);
  });
});

describe('SignInResult', () => {
  it.each(SignInNext.options)('accepts next %s', (next) => {
    expect(SignInResult.safeParse({ next }).success).toBe(true);
  });

  it('has exactly the five steps', () => {
    expect(SignInNext.options).toEqual([
      'two_step',
      'two_step_setup',
      'choose_school',
      'no_school',
      'done',
    ]);
  });
});

describe('TotpVerifyInput', () => {
  it('accepts a six-digit code or a recovery code, and defaults trustDevice to off', () => {
    expect(TotpVerifyInput.parse({ code: '123456' })).toEqual({
      code: '123456',
      trustDevice: false,
    });
    expect(TotpVerifyInput.parse({ recoveryCode: 'abcde-fghjk', trustDevice: true })).toEqual({
      recoveryCode: 'abcde-fghjk',
      trustDevice: true,
    });
  });

  it.each<[object, string]>([
    [{}, 'code'],
    [{ code: '123456', recoveryCode: 'abcde-fghjk' }, 'code'],
    [{ code: '12345' }, 'code'],
    [{ code: 'abcdef' }, 'code'],
    [{ recoveryCode: 'x'.repeat(41) }, 'recoveryCode'],
  ])('refuses %j at %s', (input, path) => {
    expect(pathOf(TotpVerifyInput.safeParse(input))).toEqual([path]);
  });
});

describe('SignInMembershipList', () => {
  it('accepts a school to choose, suspended or not', () => {
    const item = {
      tenantId: SCHOOL_ID,
      name: 'Colombo International School',
      shortName: 'CIS',
      logoUrl: null,
      brand: { color: '#1F6F5C', fill: '#1F6F5C', fillDark: '#5FBFA6', ink: '#FFFFFF' },
      roleNames: ['School admin'],
      suspended: false,
      suspendReason: null,
    };
    const suspended = { ...item, suspended: true, suspendReason: 'Unpaid invoice' };
    expect(SignInMembershipList.safeParse({ items: [item, suspended] }).success).toBe(true);
  });
});

describe('SelectSchoolInput', () => {
  it('needs a school id and defaults remember to off', () => {
    expect(SelectSchoolInput.parse({ tenantId: SCHOOL_ID })).toEqual({
      tenantId: SCHOOL_ID,
      remember: false,
    });
  });

  it.each<[object, string]>([
    [{}, 'tenantId'],
    [{ tenantId: 'colombo-intl' }, 'tenantId'],
    [{ tenantId: SCHOOL_ID, remember: 1 }, 'remember'],
  ])('refuses %j at %s', (input, path) => {
    expect(pathOf(SelectSchoolInput.safeParse(input))).toEqual([path]);
  });
});

describe('PasswordForgotInput and PasswordResetInput', () => {
  it('accepts an email, and a token with a new password', () => {
    expect(PasswordForgotInput.safeParse({ email: 'a@b.lk' }).success).toBe(true);
    expect(PasswordResetInput.safeParse({ token: 'abc.def', password: 'x' }).success).toBe(true);
  });

  it.each<[object, string]>([
    [{ password: 'long enough pass' }, 'token'],
    [{ token: '', password: 'long enough pass' }, 'token'],
    [{ token: 'abc.def', password: '' }, 'password'],
    [{ token: 'abc.def', password: 'x'.repeat(1025) }, 'password'],
  ])('refuses reset %j at %s', (input, path) => {
    expect(pathOf(PasswordResetInput.safeParse(input))).toEqual([path]);
  });
});
