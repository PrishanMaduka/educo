import { QUAD_COOKIES, findRegistryEntry, registryEntry } from '@quad/contracts';
import { describe, expect, it } from 'vitest';

import { LAST_SCHOOL_COOKIE, cookieNames } from '../../src/common/session/cookies';

import type { CookieNames } from '../../src/common/session/cookies';

const namesOf = (names: CookieNames): string[] => [
  names.session,
  names.csrf,
  names.trustedDevice,
  names.consoleSession,
  names.consoleCsrf,
];

/** Every name the API sets in any environment. */
const apiNames = [
  ...namesOf(cookieNames('local')),
  ...namesOf(cookieNames('production')),
  LAST_SCHOOL_COOKIE,
];

/**
 * The API's cookie names come from the one registry (D57), which the Cookies page renders. A
 * cookie the API sets but the registry does not list would make that page untrue.
 */
describe('the API cookie names', () => {
  it('are the names it has always used (spec 05, D32)', () => {
    expect(cookieNames('local')).toEqual({
      session: 'quad_sid',
      consoleSession: 'quad_console_sid',
      consoleCsrf: 'quad_console_csrf',
      csrf: 'quad_csrf',
      trustedDevice: 'quad_trusted',
    });
    expect(cookieNames('production')).toEqual({
      session: '__Host-quad_sid',
      consoleSession: '__Host-quad_console_sid',
      consoleCsrf: '__Host-quad_console_csrf',
      csrf: '__Host-quad_csrf',
      trustedDevice: '__Host-quad_trusted',
    });
    expect(cookieNames('staging')).toEqual(cookieNames('production'));
    expect(LAST_SCHOOL_COOKIE).toBe('quad_last_school');
  });

  it('are each listed in the cookie registry as necessary cookies', () => {
    for (const name of apiNames) {
      const entry = findRegistryEntry(name, 'cookie');
      expect(entry?.category, name).toBe('necessary');
    }
  });

  it('cover every cookie the registry says Quad sets', () => {
    const quadCookies = QUAD_COOKIES.filter(
      (entry) => entry.kind === 'cookie' && entry.setBy === 'quad',
    ).flatMap((entry) => entry.names);
    expect(quadCookies.filter((name) => !apiNames.includes(name))).toEqual([]);
    expect(registryEntry('lastSchool').names).toEqual([LAST_SCHOOL_COOKIE]);
  });
});
