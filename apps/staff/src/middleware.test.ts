import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PORTAL_PATH_HEADER } from './lib/session';
import { middleware } from './middleware';

function request(path: string, cookie?: string): NextRequest {
  return new NextRequest(new URL(path, 'http://localhost:3000'), {
    headers: cookie === undefined ? {} : { cookie },
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('staff middleware', () => {
  it('sends a signed-out visit to the portal to sign-in with the page as ?next=, 307', () => {
    const response = middleware(request('/app/students?year=7'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/sign-in?next=%2Fapp%2Fstudents%3Fyear%3D7',
    );
  });

  it.each([
    ['/app', '%2Fapp'],
    ['/app/', '%2Fapp%2F'],
  ])('redirects %s too', (path, next) => {
    expect(middleware(request(path)).headers.get('location')).toBe(
      `http://localhost:3000/sign-in?next=${next}`,
    );
  });

  it.each(['quad_sid=abc', '__Host-quad_sid=abc'])(
    'lets a request with the session cookie (%s) through to the portal',
    (cookie) => {
      const response = middleware(request('/app', cookie));
      expect(response.status).toBe(200);
      expect(response.headers.get('location')).toBeNull();
    },
  );

  it('tells the portal layout which page was asked for, overriding any header the browser sent', () => {
    const response = middleware(
      new NextRequest(new URL('/app/fees?term=2', 'http://localhost:3000'), {
        headers: { cookie: 'quad_sid=abc', [PORTAL_PATH_HEADER]: 'https://evil.example' },
      }),
    );
    expect(response.headers.get(`x-middleware-request-${PORTAL_PATH_HEADER}`)).toBe(
      '/app/fees?term=2',
    );
  });

  it('leaves pages outside the portal alone', () => {
    for (const path of ['/', '/sign-in', '/apps', '/about', '/healthz']) {
      expect(middleware(request(path)).headers.get('location'), path).toBeNull();
    }
  });

  it.each(['/sign-in/reset/a.b', '/sign-in/invite/a.b', '/sign-in/support/a.b'])(
    'keeps the token in %s out of Referer headers and search engines',
    (path) => {
      vi.stubEnv('APP_ENV', 'production');
      const response = middleware(request(path));
      expect(response.headers.get('referrer-policy')).toBe('no-referrer');
      expect(response.headers.get('x-robots-tag')).toBe('noindex');
    },
  );

  it('keeps the stricter tag where the whole app is not indexed', () => {
    vi.stubEnv('APP_ENV', 'staging');
    const response = middleware(request('/sign-in/reset/a.b'));
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });

  it('adds no token-page headers to the sign-in page itself or the landing', () => {
    vi.stubEnv('APP_ENV', 'production');
    for (const path of ['/sign-in', '/', '/sign-in/reset']) {
      const response = middleware(request(path));
      expect(response.headers.get('referrer-policy'), path).toBeNull();
      expect(response.headers.get('x-robots-tag'), path).toBeNull();
    }
  });
});
