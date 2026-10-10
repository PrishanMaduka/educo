import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { hostPrefixedNames } from './cookie-names';
import {
  LAST_SCHOOL_COOKIE,
  QUAD_COOKIES,
  RAIL_STORAGE_KEY,
  THEME_STORAGE_KEY,
  VIEW_STORAGE_KEY,
  COOKIE_CONSENT_STORAGE_KEY,
  QUAD_SET_COOKIE_IDS,
  cookieNameIn,
  findRegistryEntry,
  matchesRegistry,
  registryEntry,
} from './cookies';

describe('QUAD_COOKIES', () => {
  // The refactor pin: moving the names here must not change a single one (D32, D57).
  it('keeps every cookie name the API and the apps used before', () => {
    const cookies = QUAD_COOKIES.filter((entry) => entry.kind === 'cookie').flatMap(
      (entry) => entry.names,
    );
    expect(cookies).toEqual([
      'quad_sid',
      '__Host-quad_sid',
      'quad_csrf',
      '__Host-quad_csrf',
      'quad_trusted',
      '__Host-quad_trusted',
      'quad_last_school',
      'quad_console_sid',
      '__Host-quad_console_sid',
      'quad_console_csrf',
      '__Host-quad_console_csrf',
      '_ga',
    ]);
  });

  it('keeps every browser storage key the apps used before, plus the cookie choice', () => {
    const keys = QUAD_COOKIES.filter((entry) => entry.kind === 'local_storage').flatMap(
      (entry) => entry.names,
    );
    expect(keys).toEqual(['quad-theme', 'quad-rail', 'quad-site-view', 'quad-cookie-consent']);
    expect([
      THEME_STORAGE_KEY,
      RAIL_STORAGE_KEY,
      VIEW_STORAGE_KEY,
      COOKIE_CONSENT_STORAGE_KEY,
    ]).toEqual(keys);
    expect(LAST_SCHOOL_COOKIE).toBe('quad_last_school');
  });

  it('names each prefixed cookie as cookieNames(appEnv) did: plain locally, __Host- elsewhere', () => {
    expect(cookieNameIn('session', 'local')).toBe('quad_sid');
    expect(cookieNameIn('session', 'staging')).toBe('__Host-quad_sid');
    expect(cookieNameIn('csrf', 'production')).toBe('__Host-quad_csrf');
    expect(cookieNameIn('trustedDevice', 'production')).toBe('__Host-quad_trusted');
    expect(cookieNameIn('consoleSession', 'production')).toBe('__Host-quad_console_sid');
    expect(cookieNameIn('consoleCsrf', 'local')).toBe('quad_console_csrf');
    // The remembered school has one name everywhere (spec 05).
    expect(cookieNameIn('lastSchool', 'production')).toBe('quad_last_school');
  });

  it('names only the cookies Quad sets: a storage key or a Google cookie is a compile error', () => {
    const quadCookies = QUAD_COOKIES.filter(
      (entry) => entry.kind === 'cookie' && entry.setBy === 'quad',
    ).map((entry) => entry.id);
    expect([...QUAD_SET_COOKIE_IDS]).toEqual(quadCookies);
    // @ts-expect-error `theme` is a local storage key, not a cookie.
    expect(() => cookieNameIn('theme', 'local')).not.toThrow();
    // @ts-expect-error `ga` is set by Google Analytics, not by Quad.
    expect(() => cookieNameIn('ga', 'local')).not.toThrow();
  });

  it('gives each entry a unique id, a purpose, a lifetime and a host', () => {
    const ids = QUAD_COOKIES.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of QUAD_COOKIES) {
      expect(entry.purpose.length).toBeGreaterThan(10);
      expect(entry.lifetime.length).toBeGreaterThan(3);
      expect(['quad-edu.com', 'console.quad-edu.com']).toContain(entry.host);
      expect(entry.names.length + (entry.pattern === undefined ? 0 : 1)).toBeGreaterThan(0);
    }
  });

  it('keeps the console cookies on the console host and the rest on quad-edu.com', () => {
    expect(registryEntry('consoleSession').host).toBe('console.quad-edu.com');
    expect(registryEntry('consoleCsrf').host).toBe('console.quad-edu.com');
    expect(registryEntry('session').host).toBe('quad-edu.com');
    expect(registryEntry('ga').host).toBe('quad-edu.com');
  });

  it('marks only the Google Analytics cookies as analytics, set by Google, for 13 months', () => {
    const analytics = QUAD_COOKIES.filter((entry) => entry.category === 'analytics');
    expect(analytics.map((entry) => entry.id)).toEqual(['ga', 'gaSession']);
    for (const entry of analytics) {
      expect(entry.setBy).toBe('google_analytics');
      expect(entry.kind).toBe('cookie');
      expect(entry.lifetime).toBe('13 months');
    }
    for (const entry of QUAD_COOKIES.filter((item) => item.category !== 'analytics')) {
      expect(entry.category).toBe('necessary');
      expect(entry.setBy).toBe('quad');
    }
  });

  it('shows _ga_<id> by its pattern on the Cookies page', () => {
    expect(registryEntry('gaSession').label).toBe('_ga_<id>');
    expect(registryEntry('session').label).toBe('quad_sid');
  });
});

describe('matchesRegistry', () => {
  it('knows every listed name and the _ga_<id> pattern', () => {
    expect(matchesRegistry('_ga_ABC123')).toBe(true);
    expect(matchesRegistry('_ga')).toBe(true);
    expect(matchesRegistry('__Host-quad_sid')).toBe(true);
    expect(matchesRegistry('quad-cookie-consent')).toBe(true);
  });

  it('refuses anything not listed, including other Google cookies', () => {
    expect(matchesRegistry('_gid')).toBe(false);
    expect(matchesRegistry('_ga_abc')).toBe(false);
    expect(matchesRegistry('_ga_')).toBe(false);
    expect(matchesRegistry('_gat')).toBe(false);
    expect(matchesRegistry('quad_theme')).toBe(false);
  });

  it('checks the kind when asked: a storage key is not a cookie', () => {
    expect(matchesRegistry('quad-theme', 'local_storage')).toBe(true);
    expect(matchesRegistry('quad-theme', 'cookie')).toBe(false);
    expect(matchesRegistry('quad_sid', 'local_storage')).toBe(false);
  });

  it('returns the entry, so the audit can check its category', () => {
    expect(findRegistryEntry('_ga_ABC123')?.category).toBe('analytics');
    expect(findRegistryEntry('quad_csrf', 'cookie')?.id).toBe('csrf');
    expect(findRegistryEntry('_gid')).toBeUndefined();
  });
});

describe('cookie-names', () => {
  it('gives a __Host- cookie its local and its prefixed name', () => {
    expect(hostPrefixedNames('quad_sid')).toEqual(['quad_sid', '__Host-quad_sid']);
  });

  // The public pages read names from it; the registry's text must not ride along (landing budget).
  it('imports nothing, so code that needs a name does not carry the registry', () => {
    const source = readFileSync(new URL('./cookie-names.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/^import /m);
  });
});

describe('the root barrel', () => {
  // The registry's text must not ride into the shared contracts chunk (the landing's sign-in
  // dialog imports the root barrel); readers import `@quad/contracts/cookies`.
  it('does not re-export the cookie registry', () => {
    const source = readFileSync(new URL('../index.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/web\/cookies'/);
  });
});
