import { describe, expect, it } from 'vitest';

import {
  csrfTokenFrom,
  hasSessionCookie,
  lastSchoolFrom,
  safeNext,
  signInAgainPath,
  portalNoticeFrom,
  signInNoticeFrom,
  signInPathFor,
} from './session';

describe('hasSessionCookie', () => {
  it('sees the staff session cookie under its local and its __Host- name', () => {
    expect(hasSessionCookie((name) => (name === 'quad_sid' ? 'x' : undefined))).toBe(true);
    expect(hasSessionCookie((name) => (name === '__Host-quad_sid' ? 'x' : undefined))).toBe(true);
  });

  it('ignores other cookies and an empty value', () => {
    expect(hasSessionCookie(() => undefined)).toBe(false);
    expect(hasSessionCookie((name) => (name === 'quad_sid' ? '' : undefined))).toBe(false);
    expect(hasSessionCookie((name) => (name === 'quad_console_sid' ? 'x' : undefined))).toBe(false);
  });
});

describe('csrfTokenFrom', () => {
  it('reads the readable CSRF cookie, locally and with the __Host- prefix', () => {
    expect(csrfTokenFrom('a=1; quad_csrf=abc_-1; b=2')).toBe('abc_-1');
    expect(csrfTokenFrom('__Host-quad_csrf=xyz')).toBe('xyz');
  });

  it('never takes the console’s CSRF cookie', () => {
    expect(csrfTokenFrom('quad_console_csrf=nope')).toBeNull();
    expect(csrfTokenFrom('')).toBeNull();
  });
});

describe('lastSchoolFrom', () => {
  const cookie = (value: unknown) => encodeURIComponent(JSON.stringify(value));

  it('reads the name the API remembered (URL-encoded JSON)', () => {
    expect(lastSchoolFrom(cookie({ name: 'Colombo International School', logoUrl: null }))).toBe(
      'Colombo International School',
    );
  });

  it.each([
    ['nothing', undefined],
    ['not JSON', 'abc'],
    ['no name', cookie({ logoUrl: null })],
    ['an empty name', cookie({ name: '  ' })],
    ['a name that is not text', cookie({ name: 42 })],
    ['a broken escape', '%E0%A4%A'],
  ])('gives null for %s', (_label, value) => {
    expect(lastSchoolFrom(value)).toBeNull();
  });

  it('caps a very long name', () => {
    expect(lastSchoolFrom(cookie({ name: 'x'.repeat(500) }))?.length).toBe(120);
  });
});

describe('safeNext', () => {
  it.each([
    ['/app', '/app'],
    ['/app/students?year=7', '/app/students?year=7'],
    ['/app#fees', '/app#fees'],
  ])('keeps the portal path %s', (raw, expected) => {
    expect(safeNext(raw)).toBe(expected);
  });

  it.each([
    undefined,
    '',
    'https://evil.example/app',
    '//evil.example/app',
    '/\\evil.example',
    '/application',
    '/apps',
    '/sign-in',
    '/',
    'app',
    '/app/../sign-in',
    '/app\\..\\x',
    ['/app', '/x'],
  ])('sends %j to /app instead', (raw) => {
    expect(safeNext(raw)).toBe('/app');
  });
});

describe('signInPathFor', () => {
  it('puts the page the person asked for in ?next=', () => {
    expect(signInPathFor('/app/students', '?year=7')).toBe(
      '/sign-in?next=%2Fapp%2Fstudents%3Fyear%3D7',
    );
    expect(signInPathFor('/app', '')).toBe('/sign-in?next=%2Fapp');
  });
});

describe('signInAgainPath', () => {
  it('sends an expired session to sign-in, back to the portal page asked for', () => {
    expect(signInAgainPath('/app/fees?term=2')).toBe('/sign-in?next=%2Fapp%2Ffees%3Fterm%3D2');
  });

  it('falls back to /app for anything that is not a portal page', () => {
    expect(signInAgainPath(null)).toBe('/sign-in?next=%2Fapp');
    expect(signInAgainPath('https://evil.example/app')).toBe('/sign-in?next=%2Fapp');
  });
});

describe('signInNoticeFrom', () => {
  it('knows the two-step notice the portal asks for', () => {
    expect(signInNoticeFrom('two_step')).toBe('two_step');
  });

  it('ignores anything else, so no query text ever reaches the page', () => {
    for (const raw of [undefined, '', 'Two_Step', '<b>hi</b>', ['two_step'], 'two_step ']) {
      expect(signInNoticeFrom(raw)).toBeNull();
    }
  });
});

describe('portalNoticeFrom', () => {
  it('knows the failed-preview notice the shell reloads with', () => {
    expect(portalNoticeFrom('preview_failed')).toBe('preview_failed');
  });

  it('ignores anything else, so no query text ever reaches the page', () => {
    for (const raw of [null, undefined, '', 'Preview_failed', '<b>hi</b>', 'two_step']) {
      expect(portalNoticeFrom(raw)).toBeNull();
    }
  });
});
