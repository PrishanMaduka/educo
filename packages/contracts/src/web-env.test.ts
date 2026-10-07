import { describe, expect, it } from 'vitest';

import { parseWebPublicEnv, robotsTagFor } from './web-env';

describe('parseWebPublicEnv', () => {
  it('uses local defaults when nothing is set', () => {
    expect(parseWebPublicEnv({})).toEqual({
      NEXT_PUBLIC_APP_ENV: 'local',
      NEXT_PUBLIC_API_URL: 'http://localhost:4000',
    });
  });

  it('treats empty values as unset', () => {
    expect(parseWebPublicEnv({ NEXT_PUBLIC_APP_ENV: '', NEXT_PUBLIC_API_URL: '' })).toMatchObject({
      NEXT_PUBLIC_APP_ENV: 'local',
      NEXT_PUBLIC_API_URL: 'http://localhost:4000',
    });
  });

  it('keeps valid values', () => {
    expect(
      parseWebPublicEnv({
        NEXT_PUBLIC_APP_ENV: 'staging',
        NEXT_PUBLIC_API_URL: 'https://staging.quad-edu.com',
        NEXT_PUBLIC_PLAUSIBLE_DOMAIN: 'staging.quad-edu.com',
      }),
    ).toMatchObject({
      NEXT_PUBLIC_APP_ENV: 'staging',
      NEXT_PUBLIC_API_URL: 'https://staging.quad-edu.com',
      NEXT_PUBLIC_PLAUSIBLE_DOMAIN: 'staging.quad-edu.com',
    });
  });

  it('refuses unknown environments and bad URLs, naming each variable', () => {
    expect(() =>
      parseWebPublicEnv({ NEXT_PUBLIC_APP_ENV: 'prod', NEXT_PUBLIC_API_URL: 'not a url' }),
    ).toThrow(/NEXT_PUBLIC_APP_ENV[\s\S]*NEXT_PUBLIC_API_URL/);
  });

  it('accepts only an http(s) origin for the API, without a path', () => {
    expect(parseWebPublicEnv({ NEXT_PUBLIC_API_URL: 'http://localhost:4000/' })).toMatchObject({
      NEXT_PUBLIC_API_URL: 'http://localhost:4000',
    });
    for (const bad of [
      'ftp://quad-edu.com',
      'https://quad-edu.com/api/v1',
      'https://quad-edu.com?x=1',
      'https://quad-edu.com/#top',
      'https://user:pass@quad-edu.com',
    ]) {
      expect(() => parseWebPublicEnv({ NEXT_PUBLIC_API_URL: bad }), bad).toThrow(
        /NEXT_PUBLIC_API_URL/,
      );
    }
  });

  it('requires the API origin in staging and production (no localhost default)', () => {
    for (const env of ['staging', 'production']) {
      expect(() => parseWebPublicEnv({ NEXT_PUBLIC_APP_ENV: env }), env).toThrow(
        /NEXT_PUBLIC_API_URL/,
      );
    }
    expect(
      parseWebPublicEnv({
        NEXT_PUBLIC_APP_ENV: 'production',
        NEXT_PUBLIC_API_URL: 'https://quad-edu.com',
      }).NEXT_PUBLIC_API_URL,
    ).toBe('https://quad-edu.com');
  });
});

describe('robotsTagFor', () => {
  it.each([
    ['local', 'console', 'noindex, nofollow'],
    ['staging', 'console', 'noindex, nofollow'],
    ['production', 'console', 'noindex, nofollow'],
    [undefined, 'console', 'noindex, nofollow'],
    ['staging', 'staff', 'noindex, nofollow'],
    ['staging', 'api', 'noindex, nofollow'],
    ['production', 'staff', null],
    ['production', 'api', null],
    ['local', 'staff', null],
    ['local', 'api', null],
    [undefined, 'staff', 'noindex, nofollow'],
    [undefined, 'api', 'noindex, nofollow'],
    ['', 'staff', 'noindex, nofollow'],
    ['', 'api', 'noindex, nofollow'],
    ['Staging', 'staff', 'noindex, nofollow'],
    ['prod', 'api', 'noindex, nofollow'],
    ['test', 'staff', 'noindex, nofollow'],
    ['Production', 'staff', 'noindex, nofollow'],
  ] as const)('APP_ENV=%s on %s gives %s', (appEnv, surface, expected) => {
    expect(robotsTagFor(appEnv, surface)).toBe(expected);
  });
});
