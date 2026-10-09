import { describe, expect, it } from 'vitest';

import { emailDomainOf, providerVouchesForEmail, ssoAdmits } from './sso-admission';

import type { SsoAdmissionInput, SsoClaims, SsoSchool } from './sso-admission';
import type { SsoProvider } from '@quad/contracts';

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

describe('providerVouchesForEmail (who may say an email is the person’s)', () => {
  it.each<[string, SsoProvider, SsoClaims, boolean]>([
    [
      'Google, verified, Workspace hd is the email domain',
      'google',
      { email: 'a@x.test', email_verified: true, hd: 'x.test' },
      true,
    ],
    [
      'Google, hd in another case',
      'google',
      { email: 'a@X.Test', email_verified: true, hd: 'x.TEST' },
      true,
    ],
    [
      'Google, verified but no hd (a consumer account holding the work address)',
      'google',
      { email: 'a@x.test', email_verified: true },
      false,
    ],
    [
      'Google, hd of another domain',
      'google',
      { email: 'a@x.test', email_verified: true, hd: 'other.test' },
      false,
    ],
    [
      'Google, hd not a string',
      'google',
      { email: 'a@x.test', email_verified: true, hd: true },
      false,
    ],
    [
      'Google, not verified',
      'google',
      { email: 'a@x.test', email_verified: false, hd: 'x.test' },
      false,
    ],
    [
      'Google, verified as a string',
      'google',
      { email: 'a@x.test', email_verified: 'true', hd: 'x.test' },
      false,
    ],
    ['Google, no word on it', 'google', { email: 'a@x.test', hd: 'x.test' }, false],
    ['Google, no email', 'google', { email_verified: true, hd: 'x.test' }, false],
    // Entra never sends email_verified; only xms_edov says the domain owner verified the email.
    ['Microsoft, xms_edov true', 'microsoft', { email: 'a@x.test', xms_edov: true }, true],
    ['Microsoft, no xms_edov', 'microsoft', { email: 'a@x.test' }, false],
    ['Microsoft, xms_edov false', 'microsoft', { email: 'a@x.test', xms_edov: false }, false],
    [
      'Microsoft, email_verified alone (nOAuth: ignored)',
      'microsoft',
      { email: 'a@x.test', email_verified: true },
      false,
    ],
    ['Microsoft, no email', 'microsoft', { xms_edov: true }, false],
  ])('%s', (_name, provider, claims, expected) => {
    expect(providerVouchesForEmail(provider, claims)).toBe(expected);
  });
});

describe('ssoAdmits (spec 05 step 2: the email must match a school’s sso_domain)', () => {
  const google = (
    email: string,
    hd: unknown,
    schools: readonly SsoSchool[],
  ): SsoAdmissionInput => ({ provider: 'google', email, hd, schools });
  const microsoft = (email: string, schools: readonly SsoSchool[]): SsoAdmissionInput => ({
    provider: 'microsoft',
    email,
    hd: undefined,
    schools,
  });

  it.each<[string, SsoAdmissionInput, boolean]>([
    [
      'Google: the Workspace hd is the sso_domain',
      google('a@colombo.test', 'colombo.test', [school('colombo.test', true)]),
      true,
    ],
    [
      'Google: the domain and hd in another case',
      google('a@Colombo.TEST', 'COLOMBO.test', [school('colombo.TEST', true)]),
      true,
    ],
    [
      'Google: no hd (a consumer account holding the work address)',
      google('a@colombo.test', undefined, [school('colombo.test', true)]),
      false,
    ],
    [
      'Google: another Workspace domain in hd',
      google('a@colombo.test', 'elsewhere.test', [school('colombo.test', true)]),
      false,
    ],
    [
      'Microsoft: one of several schools matches (no hd needed)',
      microsoft('a@kandy.test', [school('colombo.test', true), school('kandy.test', false, true)]),
      true,
    ],
    [
      'an email outside the sso_domain',
      google('a@elsewhere.test', 'elsewhere.test', [school('colombo.test', true)]),
      false,
    ],
    [
      'a subdomain of the sso_domain',
      google('a@staff.colombo.test', 'colombo.test', [school('colombo.test', true)]),
      false,
    ],
    [
      'the school has the other provider on',
      google('a@colombo.test', 'colombo.test', [school('colombo.test', false, true)]),
      false,
    ],
    [
      'the school has no sso_domain',
      google('a@colombo.test', 'colombo.test', [school(null, true)]),
      false,
    ],
    ['no schools at all', microsoft('a@colombo.test', []), false],
  ])('%s', (_name, input, expected) => {
    expect(ssoAdmits(input)).toBe(expected);
  });
});
