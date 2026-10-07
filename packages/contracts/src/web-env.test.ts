import { describe, expect, it } from 'vitest';

import { parseWebPublicEnv } from './web-env';

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
});
