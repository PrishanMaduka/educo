import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

import { describe, expect, it } from 'vitest';

import {
  ConfigError,
  CONFIG_VARIABLES,
  LOCAL_DEV_SECRETS,
  NOT_READ_BY_THE_API,
  loadConfig,
} from '../src/config';

import { localEnv, productionEnv } from './env';

/**
 * Every variable in `.env.example`, which the repo test `scripts/test/services.test.ts` keeps
 * equal to spec 02 (Repository bootstrap → Environment variables).
 */
const ENV_EXAMPLE = readFileSync(resolve(__dirname, '../../../.env.example'), 'utf8');
const SPEC_VARIABLES = ENV_EXAMPLE.split('\n')
  .map((line) => /^([A-Z][A-Z0-9_]*)=/.exec(line)?.[1])
  .filter((name): name is string => name !== undefined);

function configErrorOf(env: NodeJS.ProcessEnv): ConfigError {
  try {
    loadConfig(env);
  } catch (error) {
    if (error instanceof ConfigError) return error;
    throw error;
  }
  throw new Error('Expected loadConfig to throw a ConfigError.');
}

describe('loadConfig', () => {
  it('accepts a complete local environment and applies defaults', () => {
    const config = loadConfig(localEnv());
    expect(config.APP_ENV).toBe('local');
    expect(config.API_PORT).toBe(4000);
    expect(config.LOG_LEVEL).toBe('error');
    expect(config.OTEL_EXPORTER_OTLP_ENDPOINT).toBeUndefined();
  });

  it('covers every variable in spec 02, either in the schema or as not read by the API', () => {
    expect(SPEC_VARIABLES.length).toBeGreaterThan(50);
    expect([...CONFIG_VARIABLES, ...NOT_READ_BY_THE_API].sort()).toEqual(
      [...SPEC_VARIABLES].sort(),
    );
  });

  it('boots from an unedited copy of .env.example (cp .env.example .env)', () => {
    const config = loadConfig(parseEnv(ENV_EXAMPLE));
    expect(config.APP_ENV).toBe('local');
    expect(config.SESSION_SECRET).toBe(LOCAL_DEV_SECRETS.SESSION_SECRET);
  });

  it('never reads DATABASE_OWNER_URL (migrations only)', () => {
    expect(CONFIG_VARIABLES).not.toContain('DATABASE_OWNER_URL');
    const config = loadConfig(localEnv({ DATABASE_OWNER_URL: 'postgres://o:o@localhost/quad' }));
    expect(Object.keys(config)).not.toContain('DATABASE_OWNER_URL');
  });

  it('refuses a missing DATABASE_URL and names it', () => {
    const error = configErrorOf(localEnv({ DATABASE_URL: undefined }));
    expect(error.message).toContain('DATABASE_URL');
    expect(error.problems).toEqual([{ variable: 'DATABASE_URL', problem: 'is missing' }]);
  });

  it('treats an empty value as missing', () => {
    expect(configErrorOf(localEnv({ REDIS_URL: '' })).message).toContain('REDIS_URL is missing');
  });

  it('lists every problem at once', () => {
    const error = configErrorOf({});
    const variables = error.problems.map((p) => p.variable);
    expect(variables).toEqual(
      expect.arrayContaining([
        'APP_ENV',
        'DATABASE_URL',
        'DATABASE_PLATFORM_URL',
        'REDIS_URL',
        'SESSION_SECRET',
        'LINK_SIGNING_SECRET',
        'PUBLIC_WEB_URL',
        'CONSOLE_URL',
      ]),
    );
  });

  it('refuses malformed values', () => {
    const error = configErrorOf(
      localEnv({
        APP_ENV: 'dev',
        API_PORT: 'eighty',
        DATABASE_URL: 'mysql://x@localhost/quad',
        REDIS_URL: 'localhost:6379',
        PUBLIC_WEB_URL: 'not a url',
        CONSOLE_PASSWORD_LOGIN: 'yes',
      }),
    );
    expect(error.problems.map((p) => p.variable).sort()).toEqual(
      [
        'API_PORT',
        'APP_ENV',
        'CONSOLE_PASSWORD_LOGIN',
        'DATABASE_URL',
        'PUBLIC_WEB_URL',
        'REDIS_URL',
      ].sort(),
    );
  });

  it('parses booleans and numbers', () => {
    const config = loadConfig(
      localEnv({ CONSOLE_PASSWORD_LOGIN: 'true', PAYMENTS_SANDBOX: 'false', API_PORT: '4100' }),
    );
    expect(config.CONSOLE_PASSWORD_LOGIN).toBe(true);
    expect(config.PAYMENTS_SANDBOX).toBe(false);
    expect(config.API_PORT).toBe(4100);
  });

  it('never prints secret values in the error', () => {
    const secret = 'short-but-very-secret';
    const error = configErrorOf(
      productionEnv({ SESSION_SECRET: secret, LINK_SIGNING_SECRET: secret, APP_ENV: 'staging' }),
    );
    expect(error.message).toContain('SESSION_SECRET');
    expect(error.message).not.toContain(secret);
  });

  it('accepts short secrets locally but requires 32 characters outside local', () => {
    expect(() => loadConfig(localEnv({ SESSION_SECRET: 'short' }))).not.toThrow();
    const error = configErrorOf(productionEnv({ SESSION_SECRET: 'short' }));
    expect(error.problems).toEqual([
      { variable: 'SESSION_SECRET', problem: 'must be at least 32 characters outside local' },
    ]);
  });

  it('refuses the published local development secrets outside local', () => {
    expect(() => loadConfig(localEnv(LOCAL_DEV_SECRETS))).not.toThrow();
    const error = configErrorOf(productionEnv(LOCAL_DEV_SECRETS));
    expect(error.problems.map((p) => p.variable).sort()).toEqual([
      'LINK_SIGNING_SECRET',
      'SESSION_SECRET',
    ]);
  });

  it('accepts a complete production environment', () => {
    expect(loadConfig(productionEnv()).APP_ENV).toBe('production');
  });

  it('refuses DEV_FIXED_OTP in production', () => {
    const error = configErrorOf(productionEnv({ DEV_FIXED_OTP: '000000' }));
    expect(error.message).toContain('DEV_FIXED_OTP');
  });

  it('refuses CONSOLE_PASSWORD_LOGIN=true in production', () => {
    const error = configErrorOf(productionEnv({ CONSOLE_PASSWORD_LOGIN: 'true' }));
    expect(error.message).toContain('CONSOLE_PASSWORD_LOGIN');
    expect(() => loadConfig(productionEnv({ CONSOLE_PASSWORD_LOGIN: 'false' }))).not.toThrow();
  });

  it('allows the local-only flags in staging', () => {
    const config = loadConfig(
      productionEnv({
        APP_ENV: 'staging',
        DEV_FIXED_OTP: '000000',
        CONSOLE_PASSWORD_LOGIN: 'true',
      }),
    );
    expect(config.DEV_FIXED_OTP).toBe('000000');
  });
});
