import { registryEntry } from '@quad/contracts/cookies';
import { describe, expect, it } from 'vitest';

import { CONSOLE_CSRF_COOKIES, safeNext, signInPathFor } from './session';

describe('safeNext (where the console opens after sign-in)', () => {
  it.each(['/', '/schools', '/audit?actor=x', '/schools#top', '/%09/x'])(
    'keeps the console page %s',
    (path) => {
      expect(safeNext(path)).toBe(path);
    },
  );

  it.each([
    undefined,
    ['/audit'],
    '',
    'schools',
    'https://evil.example/',
    '//evil.example/path',
    '/\\evil.example',
    '/schools/../sign-in',
    '/./audit',
    '/sign-in',
    '/sign-in?next=/audit',
    '/sign-in/anything',
    // Browsers drop tab, newline and carriage return when they parse a URL: `//evil.example`.
    '/\t/evil.example',
    '/\n/evil.example',
    '/\r/evil.example',
    '/\\evil',
    '/\u0000/x',
    '/\u007f/x',
  ])('sends %j to the overview instead', (raw) => {
    expect(safeNext(raw)).toBe('/');
  });
});

describe('signInPathFor', () => {
  it('asks sign-in to come back to the page and its query', () => {
    expect(signInPathFor('/audit', '?actor=a&tenantId=b')).toBe(
      '/sign-in?next=%2Faudit%3Factor%3Da%26tenantId%3Db',
    );
  });
});

describe('CONSOLE_CSRF_COOKIES', () => {
  it('names only the console’s cookie, never the staff portal’s on the same host', () => {
    expect(CONSOLE_CSRF_COOKIES).toEqual(['quad_console_csrf', '__Host-quad_console_csrf']);
    expect(CONSOLE_CSRF_COOKIES).toEqual(registryEntry('consoleCsrf').names);
  });
});
