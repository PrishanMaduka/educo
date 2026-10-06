import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadLocalEnvFile } from '../src/boot';

const file = join(mkdtempSync(join(tmpdir(), 'quad-boot-')), '.env');
writeFileSync(file, 'DEV_FIXED_OTP=000000\nREDIS_URL=redis://from-file:6379\n');

describe('loadLocalEnvFile', () => {
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
});
