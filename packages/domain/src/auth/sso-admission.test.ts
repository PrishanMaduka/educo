import { describe, expect, it } from 'vitest';

import { emailDomainOf, ssoAdmission } from './sso-admission';

import type { SsoSchool } from './sso-admission';

const school = (ssoDomain: string | null, google: boolean, microsoft = false): SsoSchool => ({
  ssoDomain,
  google,
  microsoft,
});

describe('emailDomainOf', () => {
  it.each([
    ['nadeesha@colombo-intl.local', 'colombo-intl.local'],
    ['Nadeesha@Colombo-Intl.LOCAL', 'colombo-intl.local'],
    ['"a@b"@school.test', 'school.test'],
  ])('%s is at %s', (email, domain) => {
    expect(emailDomainOf(email)).toBe(domain);
  });
});

describe('ssoAdmission (spec 05 step 2: the provider’s email must match a school’s sso_domain)', () => {
  it.each<[string, Parameters<typeof ssoAdmission>[0], ReturnType<typeof ssoAdmission>]>([
    [
      'a verified email at a school with the provider on',
      {
        provider: 'google',
        email: 'a@colombo.test',
        emailVerified: true,
        schools: [school('colombo.test', true)],
      },
      'admitted',
    ],
    [
      'the domain in another case',
      {
        provider: 'google',
        email: 'a@Colombo.TEST',
        emailVerified: true,
        schools: [school('COLOMBO.test', true)],
      },
      'admitted',
    ],
    [
      'one of several schools matches',
      {
        provider: 'microsoft',
        email: 'a@kandy.test',
        emailVerified: true,
        schools: [school('colombo.test', true), school('kandy.test', false, true)],
      },
      'admitted',
    ],
    [
      'an email the provider has not verified',
      {
        provider: 'google',
        email: 'a@colombo.test',
        emailVerified: false,
        schools: [school('colombo.test', true)],
      },
      'unverified_email',
    ],
    [
      'no word on verification',
      {
        provider: 'google',
        email: 'a@colombo.test',
        emailVerified: undefined,
        schools: [school('colombo.test', true)],
      },
      'unverified_email',
    ],
    [
      'an email outside the sso_domain',
      {
        provider: 'google',
        email: 'a@elsewhere.test',
        emailVerified: true,
        schools: [school('colombo.test', true)],
      },
      'no_school',
    ],
    [
      'a subdomain of the sso_domain',
      {
        provider: 'google',
        email: 'a@staff.colombo.test',
        emailVerified: true,
        schools: [school('colombo.test', true)],
      },
      'no_school',
    ],
    [
      'the school has the other provider on',
      {
        provider: 'google',
        email: 'a@colombo.test',
        emailVerified: true,
        schools: [school('colombo.test', false, true)],
      },
      'no_school',
    ],
    [
      'the school has no sso_domain',
      {
        provider: 'google',
        email: 'a@colombo.test',
        emailVerified: true,
        schools: [school(null, true)],
      },
      'no_school',
    ],
    [
      'no schools at all',
      { provider: 'google', email: 'a@colombo.test', emailVerified: true, schools: [] },
      'no_school',
    ],
  ])('%s', (_name, input, expected) => {
    expect(ssoAdmission(input)).toBe(expected);
  });
});
