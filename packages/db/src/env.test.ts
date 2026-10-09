import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseEnv } from 'node:util';

import { LOCAL_SEED_PASSWORD } from '@quad/contracts';
import { describe, expect, it } from 'vitest';

import {
  LOCAL_DATABASE_URLS,
  databaseUrls,
  loadLocalEnvFile,
  loadRootEnv,
  localSeedRefusal,
  seedPasswordRefusal,
  withDatabaseName,
} from './env';

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

describe('seedPasswordRefusal (D32)', () => {
  it('publishes the same placeholder as .env.example', () => {
    const example = parseEnv(
      readFileSync(new URL('../../../.env.example', import.meta.url), 'utf8'),
    );
    expect(example.SEED_PASSWORD).toBe(LOCAL_SEED_PASSWORD);
  });

  it.each([undefined, 'local'])('allows the placeholder when APP_ENV is %j', (appEnv) => {
    expect(seedPasswordRefusal({ APP_ENV: appEnv, SEED_PASSWORD: LOCAL_SEED_PASSWORD })).toBeNull();
    expect(seedPasswordRefusal({ APP_ENV: appEnv, SEED_PASSWORD: 'anything-else' })).toBeNull();
  });

  it.each([undefined, 'local'])('still requires a SEED_PASSWORD when APP_ENV is %j', (appEnv) => {
    for (const value of [undefined, '']) {
      expect(seedPasswordRefusal({ APP_ENV: appEnv, SEED_PASSWORD: value })).toBe(
        'SEED_PASSWORD is required when APP_ENV is local.',
      );
    }
  });

  it.each(['staging', 'production'])('requires a SEED_PASSWORD when APP_ENV is %s', (appEnv) => {
    for (const value of [undefined, '']) {
      expect(seedPasswordRefusal({ APP_ENV: appEnv, SEED_PASSWORD: value })).toBe(
        `SEED_PASSWORD is required when APP_ENV is ${appEnv}.`,
      );
    }
  });

  it.each(['staging', 'production'])('refuses the published placeholder in %s', (appEnv) => {
    const refusal = seedPasswordRefusal({ APP_ENV: appEnv, SEED_PASSWORD: LOCAL_SEED_PASSWORD });
    expect(refusal).toBe('SEED_PASSWORD is the published local value; set a real one.');
    expect(refusal).not.toContain(LOCAL_SEED_PASSWORD);
  });

  it('allows a real password in staging', () => {
    expect(
      seedPasswordRefusal({ APP_ENV: 'staging', SEED_PASSWORD: 'a-real-staging-password' }),
    ).toBeNull();
  });
});

describe('localSeedRefusal (pnpm db:seed)', () => {
  const local = LOCAL_DATABASE_URLS.ownerUrl;

  it.each([undefined, '', 'local'])(
    'allows APP_ENV %j with a database on this machine',
    (appEnv) => {
      for (const url of [
        local,
        'postgres://o:p@127.0.0.1:5432/quad',
        'postgres://o:p@[::1]/quad',
      ]) {
        expect(localSeedRefusal({ APP_ENV: appEnv }, url)).toBeNull();
      }
    },
  );

  it.each(['staging', 'production', 'test'])('refuses APP_ENV %s', (appEnv) => {
    expect(localSeedRefusal({ APP_ENV: appEnv }, local)).toBe(
      `pnpm db:seed is for local databases only (APP_ENV is ${appEnv}).`,
    );
  });

  it('refuses a database on another host, even with APP_ENV local', () => {
    expect(
      localSeedRefusal({ APP_ENV: 'local' }, 'postgres://o:p@db.staging.example.test:5432/quad'),
    ).toBe(
      'pnpm db:seed is for local databases only (the database is on db.staging.example.test).',
    );
  });
});

describe('loadLocalEnvFile (the one gated .env loader)', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'quad-env-')), '.env');
  writeFileSync(file, 'DEV_FIXED_OTP=000000\nREDIS_URL=redis://from-file:6379\n');

  it.each([[undefined], [''], ['local']])('loads the file when APP_ENV is %j', (appEnv) => {
    const env: NodeJS.ProcessEnv = { APP_ENV: appEnv };
    expect(loadLocalEnvFile(env, file)).toBe(true);
    expect(env.DEV_FIXED_OTP).toBe('000000');
  });

  it('keeps variables that are already set', () => {
    const env: NodeJS.ProcessEnv = { REDIS_URL: 'redis://set:6379' };
    loadLocalEnvFile(env, file);
    expect(env.REDIS_URL).toBe('redis://set:6379');
  });

  it.each([['staging'], ['production']])(
    'never reads the file when APP_ENV is %s (a stray .env must not leak local flags)',
    (appEnv) => {
      const env: NodeJS.ProcessEnv = { APP_ENV: appEnv };
      expect(loadLocalEnvFile(env, file)).toBe(false);
      expect(env.DEV_FIXED_OTP).toBeUndefined();
    },
  );

  it('does nothing when the file is missing', () => {
    expect(loadLocalEnvFile({}, join(tmpdir(), 'quad-no-such-dir', '.env'))).toBe(false);
  });

  it('loadRootEnv loads the given .env in local (so the cases below test the gate, not a missing file)', () => {
    const env: NodeJS.ProcessEnv = { APP_ENV: 'local' };
    expect(loadRootEnv(env, file)).toBe(true);
    expect(env.DEV_FIXED_OTP).toBe('000000');
  });

  it.each(['staging', 'production'])(
    'loadRootEnv ignores the .env when APP_ENV is %s',
    (appEnv) => {
      const env: NodeJS.ProcessEnv = { APP_ENV: appEnv };
      expect(loadRootEnv(env, file)).toBe(false);
      expect(env).toEqual({ APP_ENV: appEnv });
    },
  );
});
