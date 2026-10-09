import { describe, expect, it } from 'vitest';

import { nextSignInStep } from './next-sign-in-step';

import type { SignInFacts } from './next-sign-in-step';
import type { SignInNext } from '@quad/contracts';

const base: SignInFacts = {
  totpEnabled: false,
  twoStepRequired: false,
  trustedDevice: false,
  membershipCount: 1,
};

describe('nextSignInStep (spec 05 steps 4 and 5)', () => {
  it.each<[string, Partial<SignInFacts>, SignInNext]>([
    ['one staff membership opens it', {}, 'done'],
    ['several staff memberships ask for a school', { membershipCount: 2 }, 'choose_school'],
    ['many staff memberships ask for a school', { membershipCount: 7 }, 'choose_school'],
    ['no staff membership has no school', { membershipCount: 0 }, 'no_school'],
    ['an authenticator asks for its code', { totpEnabled: true }, 'two_step'],
    [
      'an authenticator asks for its code even when no school requires it',
      { totpEnabled: true, twoStepRequired: false },
      'two_step',
    ],
    [
      'a required two-step without an authenticator asks to set one up',
      { twoStepRequired: true },
      'two_step_setup',
    ],
    [
      'a required two-step with an authenticator asks for the code',
      { twoStepRequired: true, totpEnabled: true },
      'two_step',
    ],
    [
      'a trusted device skips the code',
      { twoStepRequired: true, totpEnabled: true, trustedDevice: true },
      'done',
    ],
    [
      'a trusted device skips the code before a choice of schools',
      { totpEnabled: true, trustedDevice: true, membershipCount: 3 },
      'choose_school',
    ],
    [
      'a trusted device never skips setting up a required authenticator',
      { twoStepRequired: true, trustedDevice: true },
      'two_step_setup',
    ],
    [
      'the code comes before saying there is no school',
      { totpEnabled: true, membershipCount: 0 },
      'two_step',
    ],
  ])('%s', (_name, facts, next) => {
    expect(nextSignInStep({ ...base, ...facts })).toBe(next);
  });

  it('never picks a school itself: the step names no tenant', () => {
    expect(typeof nextSignInStep({ ...base, membershipCount: 2 })).toBe('string');
  });

  it.each([-1, 1.5, Number.NaN])('refuses a membership count of %s', (membershipCount) => {
    expect(() => nextSignInStep({ ...base, membershipCount })).toThrow(RangeError);
  });
});
