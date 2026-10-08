import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

import { describe, expect, it } from 'vitest';

import { LOCAL_DATABASE_URLS, databaseUrls, withDatabaseName } from './env';

describe('databaseUrls', () => {
  it('reads the three urls from the environment', () => {
    expect(
      databaseUrls({
        APP_ENV: 'production',
        DATABASE_URL: 'postgres://a@db/quad',
        DATABASE_PLATFORM_URL: 'postgres://p@db/quad',
        DATABASE_OWNER_URL: 'postgres://o@db/quad',
      }),
    ).toEqual({
      appUrl: 'postgres://a@db/quad',
      platformUrl: 'postgres://p@db/quad',
      ownerUrl: 'postgres://o@db/quad',
    });
  });

  it.each([undefined, 'local'])('falls back to the local defaults when APP_ENV is %j', (appEnv) => {
    expect(databaseUrls(appEnv === undefined ? {} : { APP_ENV: appEnv, DATABASE_URL: '' })).toEqual(
      LOCAL_DATABASE_URLS,
    );
  });

  it.each(['staging', 'production'])('refuses to fall back when APP_ENV is %s', (appEnv) => {
    expect(() => databaseUrls({ APP_ENV: appEnv })).toThrow(/DATABASE_URL/);
  });

  it('uses the local defaults from .env.example', () => {
    const example = parseEnv(
      readFileSync(new URL('../../../.env.example', import.meta.url), 'utf8'),
    );
    expect(LOCAL_DATABASE_URLS).toEqual({
      appUrl: example.DATABASE_URL,
      platformUrl: example.DATABASE_PLATFORM_URL,
      ownerUrl: example.DATABASE_OWNER_URL,
    });
  });
});

describe('withDatabaseName', () => {
  it('swaps only the database name', () => {
    expect(withDatabaseName('postgres://u:p@h:5432/quad?sslmode=require', 'quad_test_1')).toBe(
      'postgres://u:p@h:5432/quad_test_1?sslmode=require',
    );
  });

  it('refuses an unsafe database name', () => {
    expect(() => withDatabaseName('postgres://u:p@h/quad', 'x/../y')).toThrow(/database name/);
  });
});
