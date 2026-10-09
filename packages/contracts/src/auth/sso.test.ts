import { describe, expect, it } from 'vitest';

import { SsoCallbackQuery, SsoProviderParams, SsoStartInput, SsoStartResult } from '../index';

const pathOf = (result: { success: boolean; error?: { issues: { path: unknown[] }[] } }) =>
  result.error?.issues[0]?.path;

describe('SsoProviderParams', () => {
  it.each(['google', 'microsoft'])('accepts %s', (provider) => {
    expect(SsoProviderParams.parse({ provider })).toEqual({ provider });
  });

  it.each(['github', 'Google', ''])('refuses %j at provider', (provider) => {
    expect(pathOf(SsoProviderParams.safeParse({ provider }))).toEqual(['provider']);
  });
});

describe('SsoStartInput', () => {
  it('trims and lower-cases the work email, and keeps the session to the browser by default', () => {
    expect(SsoStartInput.parse({ email: ' Nadeesha@Colombo-Intl.Local ' })).toEqual({
      email: 'nadeesha@colombo-intl.local',
      keepSignedIn: false,
    });
  });

  it.each([{}, { email: 'not-an-email' }])('refuses %j at email', (input) => {
    expect(pathOf(SsoStartInput.safeParse(input))).toEqual(['email']);
  });

  it('refuses a keepSignedIn that is not a boolean', () => {
    const result = SsoStartInput.safeParse({ email: 'a@b.test', keepSignedIn: 'yes' });
    expect(pathOf(result)).toEqual(['keepSignedIn']);
  });
});

describe('SsoStartResult', () => {
  it('is the provider URL to open', () => {
    const url = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=x';
    expect(SsoStartResult.parse({ url })).toEqual({ url });
    expect(pathOf(SsoStartResult.safeParse({ url: 'nope' }))).toEqual(['url']);
  });
});

describe('SsoCallbackQuery', () => {
  it('takes the code and state, and ignores the other parameters a provider adds', () => {
    expect(
      SsoCallbackQuery.parse({ code: 'c', state: 's', scope: 'openid', authuser: '0' }),
    ).toEqual({ code: 'c', state: 's' });
  });

  it.each([
    [{ state: 's' }, 'code'],
    [{ code: 'c' }, 'state'],
    [{ code: '', state: 's' }, 'code'],
    [{ code: 'c', state: 's'.repeat(513) }, 'state'],
  ])('refuses %j at %s', (input, field) => {
    expect(pathOf(SsoCallbackQuery.safeParse(input))).toEqual([field]);
  });
});
