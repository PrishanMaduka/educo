import { describe, expect, it } from 'vitest';

import {
  PlatformAuditAction,
  PlatformMe,
  PlatformPasswordSignInInput,
  PlatformSignInResult,
  PlatformTotpSetup,
  PlatformTotpSetupInput,
  PlatformTotpVerifyInput,
} from '../index';

const pathOf = (result: { success: boolean; error?: { issues: { path: unknown[] }[] } }) =>
  result.error?.issues[0]?.path;

describe('PlatformPasswordSignInInput (POST /platform/auth/password)', () => {
  it('takes an email and a password, and normalises the email', () => {
    expect(
      PlatformPasswordSignInInput.parse({ email: ' Owner@Quad.Local ', password: 'secret' }),
    ).toEqual({ email: 'owner@quad.local', password: 'secret' });
  });

  it.each([
    [{ email: 'not-an-email', password: 'secret' }, ['email']],
    [{ password: 'secret' }, ['email']],
    [{ email: 'owner@quad.local', password: '' }, ['password']],
    [{ email: 'owner@quad.local' }, ['password']],
  ])('refuses %j at %j', (input, path) => {
    expect(pathOf(PlatformPasswordSignInInput.safeParse(input))).toEqual(path);
  });

  it('has no Keep me signed in: a console session always idles out after 8 hours', () => {
    expect(
      PlatformPasswordSignInInput.parse({
        email: 'owner@quad.local',
        password: 'secret',
        keepSignedIn: true,
      }),
    ).not.toHaveProperty('keepSignedIn');
  });
});

describe('PlatformSignInResult', () => {
  it.each(['two_step', 'two_step_setup', 'done'])('accepts next %s', (next) => {
    expect(PlatformSignInResult.safeParse({ next }).success).toBe(true);
  });

  it.each(['choose_school', 'no_school'])('refuses the staff-only step %s', (next) => {
    expect(pathOf(PlatformSignInResult.safeParse({ next }))).toEqual(['next']);
  });
});

describe('PlatformTotpSetupInput and PlatformTotpSetup (POST /platform/auth/totp/setup)', () => {
  it('takes an empty body (or none) and refuses anything in it', () => {
    expect(PlatformTotpSetupInput.parse({})).toEqual({});
    expect(PlatformTotpSetupInput.parse(undefined)).toEqual({});
    expect(PlatformTotpSetupInput.safeParse({ code: '123456' }).success).toBe(false);
  });

  it('returns the secret and the otpauth URI', () => {
    expect(
      PlatformTotpSetup.safeParse({
        secret: 'JBSWY3DPEHPK3PXP',
        otpauthUri: 'otpauth://totp/Quad%20console:owner%40quad.local?secret=JBSWY3DPEHPK3PXP',
      }).success,
    ).toBe(true);
    expect(
      pathOf(PlatformTotpSetup.safeParse({ secret: 'JBSWY3DPEHPK3PXP', otpauthUri: 'https://x' })),
    ).toEqual(['otpauthUri']);
  });
});

describe('PlatformTotpVerifyInput (POST /platform/auth/totp/verify)', () => {
  it('takes a six-digit code', () => {
    expect(PlatformTotpVerifyInput.parse({ code: '123456' })).toEqual({ code: '123456' });
  });

  it.each([{}, { code: '12345' }, { code: 'abcdef' }, { code: 123456 }])(
    'refuses %j at code',
    (input) => {
      expect(pathOf(PlatformTotpVerifyInput.safeParse(input))).toEqual(['code']);
    },
  );
});

describe('PlatformMe (GET /platform/me)', () => {
  it('is the console user’s id, name and role', () => {
    const me = { id: '0192a6f4-1b2c-7d3e-8f40-123456789abc', name: 'Amaya Perera', role: 'owner' };
    expect(PlatformMe.parse(me)).toEqual(me);
    expect(pathOf(PlatformMe.safeParse({ ...me, role: 'principal' }))).toEqual(['role']);
  });
});

describe('PlatformAuditAction (console sign-in)', () => {
  it('names every console sign-in event', () => {
    expect(PlatformAuditAction.options).toEqual(
      expect.arrayContaining([
        'auth.password_accepted',
        'auth.sign_in',
        'auth.sign_in_failed',
        'auth.two_step_setup_started',
        'auth.two_step_enabled',
        'auth.sign_out',
      ]),
    );
  });
});
