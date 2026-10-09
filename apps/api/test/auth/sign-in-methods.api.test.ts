import { describe, expect, it } from 'vitest';

import { cookieNames } from '../../src/common/session/cookies';
import { API_ROUTES } from '../../src/openapi/document';
import { Browser } from '../helpers/browser';
import { useDatabaseApp } from '../helpers/database-app';
import { freshEmail } from '../helpers/sign-in';

const { app } = useDatabaseApp();

/**
 * D37: work email and password (then two-step and Choose a school) is the only staff sign-in.
 * There is no Google or Microsoft sign-in, and no identify step that offers one: the page asks
 * for the email first and always goes on to the password (spec 05 step 1).
 */
describe('staff sign-in methods (D37)', () => {
  it.each([
    ['POST', '/auth/identify'],
    ['POST', '/auth/sso/google/start'],
    ['POST', '/auth/sso/microsoft/start'],
    ['GET', '/auth/sso/google/callback?code=c&state=s'],
    ['GET', '/auth/sso/microsoft/callback?code=c&state=s'],
  ] as const)('has no %s %s route', async (method, url) => {
    const response = await new Browser(app).request(method, url, {
      email: freshEmail(),
      keepSignedIn: false,
    });
    expect(response.statusCode).toBe(404);
  });

  it('publishes no identify or SSO route in the API description', () => {
    const paths = API_ROUTES.map((route) => route.path);
    expect(paths).toContain('/auth/password');
    expect(
      paths.filter((path) => path === '/auth/identify' || path.startsWith('/auth/sso')),
    ).toEqual([]);
  });

  it('names no SSO state cookie', () => {
    expect(Object.keys(cookieNames('local')).sort()).toEqual([
      'consoleCsrf',
      'consoleSession',
      'csrf',
      'session',
      'trustedDevice',
    ]);
  });
});
