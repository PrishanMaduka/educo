import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

import { LOCAL_SEED_PASSWORD } from '@quad/contracts';
import { describe, expect, it } from 'vitest';

import {
  ConfigError,
  CONFIG_VARIABLES,
  LOCAL_DEV_SECRETS,
  NOT_READ_BY_THE_API,
  loadConfig,
} from '../src/config';

import { TEST_JWT_KEYS, localEnv, productionEnv } from './env';

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
        'FIELD_ENCRYPTION_KEY',
        'JWT_PRIVATE_KEY',
        'JWT_PUBLIC_KEY',
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

  it('accepts an SNS topic ARN for SES_SNS_TOPIC_ARN and leaves it unset when blank', () => {
    const arn = 'arn:aws:sns:ap-south-1:123456789012:quad-staging-ses-events';
    expect(loadConfig(localEnv({ SES_SNS_TOPIC_ARN: arn })).SES_SNS_TOPIC_ARN).toBe(arn);
    expect(loadConfig(localEnv({ SES_SNS_TOPIC_ARN: '' })).SES_SNS_TOPIC_ARN).toBeUndefined();
  });

  it.each([
    ['arn:aws:sqs:ap-south-1:123456789012:q'],
    ['arn:aws:sns:ap-south-1:12345:quad'],
    ['arn:aws:sns:ap-south-1:123456789012:'],
    ['arn:aws:sns::123456789012:quad'],
    ['quad-staging-ses-events'],
  ])('refuses SES_SNS_TOPIC_ARN=%s', (arn) => {
    expect(configErrorOf(localEnv({ SES_SNS_TOPIC_ARN: arn })).problems).toEqual([
      {
        variable: 'SES_SNS_TOPIC_ARN',
        problem: 'must be an SNS topic ARN (arn:aws:sns:<region>:<account>:<name>)',
      },
    ]);
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
      'FIELD_ENCRYPTION_KEY',
      'JWT_PRIVATE_KEY',
      'JWT_PUBLIC_KEY',
      'LINK_SIGNING_SECRET',
      'SEED_PASSWORD',
      'SESSION_SECRET',
    ]);
  });

  it('reads TRUST_PROXY_HOPS as a small whole number, default 0', () => {
    expect(loadConfig(localEnv()).TRUST_PROXY_HOPS).toBe(0);
    expect(loadConfig(localEnv({ TRUST_PROXY_HOPS: '2' })).TRUST_PROXY_HOPS).toBe(2);
    expect(configErrorOf(localEnv({ TRUST_PROXY_HOPS: '-1' })).problems).toEqual([
      { variable: 'TRUST_PROXY_HOPS', problem: 'must be a whole number from 0 to 10' },
    ]);
  });

  it('refuses the compose database passwords outside local', () => {
    const compose = {
      DATABASE_URL: 'postgres://quad_app:quad_app@db.internal:5432/quad',
      DATABASE_PLATFORM_URL: 'postgres://quad_platform:quad_platform@db.internal:5432/quad',
    };
    expect(() => loadConfig(localEnv(compose))).not.toThrow();
    const error = configErrorOf(productionEnv({ ...compose, APP_ENV: 'staging' }));
    expect(error.problems).toEqual([
      { variable: 'DATABASE_URL', problem: 'uses the local compose password' },
      { variable: 'DATABASE_PLATFORM_URL', problem: 'uses the local compose password' },
    ]);
  });

  it('requires different session and link secrets outside local', () => {
    const same = 's'.repeat(40);
    expect(() =>
      loadConfig(localEnv({ SESSION_SECRET: same, LINK_SIGNING_SECRET: same })),
    ).not.toThrow();
    const error = configErrorOf(productionEnv({ SESSION_SECRET: same, LINK_SIGNING_SECRET: same }));
    expect(error.problems).toEqual([
      { variable: 'LINK_SIGNING_SECRET', problem: 'must differ from SESSION_SECRET' },
    ]);
    expect(error.message).not.toContain(same);
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

  it('accepts OIDC_FAKE_ISSUER_URL locally, as an http(s) URL', () => {
    const url = 'http://127.0.0.1:4455';
    expect(loadConfig(localEnv({ OIDC_FAKE_ISSUER_URL: url })).OIDC_FAKE_ISSUER_URL).toBe(url);
    expect(loadConfig(localEnv()).OIDC_FAKE_ISSUER_URL).toBeUndefined();
    expect(configErrorOf(localEnv({ OIDC_FAKE_ISSUER_URL: 'not a url' })).problems).toEqual([
      { variable: 'OIDC_FAKE_ISSUER_URL', problem: 'must be an http(s) URL' },
    ]);
  });

  it.each(['staging', 'production'])('refuses OIDC_FAKE_ISSUER_URL in %s (D32)', (appEnv) => {
    const error = configErrorOf(
      productionEnv({ APP_ENV: appEnv, OIDC_FAKE_ISSUER_URL: 'http://127.0.0.1:4455' }),
    );
    expect(error.problems).toEqual([
      { variable: 'OIDC_FAKE_ISSUER_URL', problem: 'must not be set outside local' },
    ]);
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

describe('loadConfig: field encryption, token keys and the seed password (M1, D32)', () => {
  const staging = (overrides: Record<string, string | undefined>) =>
    productionEnv({ APP_ENV: 'staging', ...overrides });

  it.each(['FIELD_ENCRYPTION_KEY', 'JWT_PRIVATE_KEY', 'JWT_PUBLIC_KEY'])(
    'requires %s in every environment, local included',
    (variable) => {
      expect(configErrorOf(localEnv({ [variable]: undefined })).problems).toContainEqual({
        variable,
        problem: 'is missing',
      });
      expect(configErrorOf(productionEnv({ [variable]: '' })).problems).toContainEqual({
        variable,
        problem: 'is missing',
      });
    },
  );

  it('refuses a FIELD_ENCRYPTION_KEY under 32 characters, even locally', () => {
    const short = 'k'.repeat(31);
    for (const env of [
      localEnv({ FIELD_ENCRYPTION_KEY: short }),
      staging({ FIELD_ENCRYPTION_KEY: short }),
    ]) {
      const error = configErrorOf(env);
      expect(error.problems).toEqual([
        { variable: 'FIELD_ENCRYPTION_KEY', problem: 'must be at least 32 characters' },
      ]);
      expect(error.message).not.toContain(short);
    }
    expect(
      loadConfig(localEnv({ FIELD_ENCRYPTION_KEY: 'k'.repeat(32) })).FIELD_ENCRYPTION_KEY,
    ).toBe('k'.repeat(32));
  });

  it('accepts the published placeholders locally', () => {
    const config = loadConfig(localEnv(LOCAL_DEV_SECRETS));
    expect(config.FIELD_ENCRYPTION_KEY).toBe(LOCAL_DEV_SECRETS.FIELD_ENCRYPTION_KEY);
    expect(config.SEED_PASSWORD).toBe(LOCAL_DEV_SECRETS.SEED_PASSWORD);
  });

  it.each(['FIELD_ENCRYPTION_KEY', 'SEED_PASSWORD'] as const)(
    'refuses the placeholder %s in staging and production',
    (variable) => {
      for (const env of [staging({}), productionEnv()]) {
        const error = configErrorOf({ ...env, [variable]: LOCAL_DEV_SECRETS[variable] });
        expect(error.problems).toEqual([
          { variable, problem: 'is the published local value; set a real secret' },
        ]);
        expect(error.message).not.toContain(LOCAL_DEV_SECRETS[variable]);
      }
    },
  );

  it('refuses the same seed password placeholder as the seed (one shared constant)', () => {
    expect(LOCAL_DEV_SECRETS.SEED_PASSWORD).toBe(LOCAL_SEED_PASSWORD);
  });

  it('accepts a real seed password in staging, and none at all', () => {
    expect(loadConfig(staging({ SEED_PASSWORD: 'staging-seed-password-1' })).SEED_PASSWORD).toBe(
      'staging-seed-password-1',
    );
    expect(loadConfig(staging({ SEED_PASSWORD: undefined })).SEED_PASSWORD).toBeUndefined();
  });

  it('refuses the published Ed25519 pair in staging, naming both keys', () => {
    const published = {
      JWT_PRIVATE_KEY: LOCAL_DEV_SECRETS.JWT_PRIVATE_KEY,
      JWT_PUBLIC_KEY: LOCAL_DEV_SECRETS.JWT_PUBLIC_KEY,
    };
    expect(() => loadConfig(localEnv(published))).not.toThrow();
    const error = configErrorOf(staging(published));
    expect(error.problems).toEqual([
      { variable: 'JWT_PRIVATE_KEY', problem: 'is the published local value; set a real secret' },
      { variable: 'JWT_PUBLIC_KEY', problem: 'is the published local value; set a real secret' },
    ]);
    expect(error.message).not.toContain('PRIVATE KEY');
  });

  it('refuses the published private key in staging even when it is written differently', () => {
    const oneLine = LOCAL_DEV_SECRETS.JWT_PRIVATE_KEY.trim().replaceAll('\n', '\\n');
    const error = configErrorOf(
      staging({ JWT_PRIVATE_KEY: oneLine, JWT_PUBLIC_KEY: LOCAL_DEV_SECRETS.JWT_PUBLIC_KEY }),
    );
    expect(error.problems.map((p) => p.variable)).toContain('JWT_PRIVATE_KEY');
  });

  it('accepts PEM keys written on one line with \\n escapes (Secrets Manager, .env)', () => {
    const escaped = {
      JWT_PRIVATE_KEY: TEST_JWT_KEYS.JWT_PRIVATE_KEY.replaceAll('\n', '\\n'),
      JWT_PUBLIC_KEY: TEST_JWT_KEYS.JWT_PUBLIC_KEY.replaceAll('\n', '\\n'),
    };
    const config = loadConfig(localEnv(escaped));
    expect(config.JWT_PRIVATE_KEY).toBe(TEST_JWT_KEYS.JWT_PRIVATE_KEY);
    expect(config.JWT_PUBLIC_KEY).toBe(TEST_JWT_KEYS.JWT_PUBLIC_KEY);
  });

  it('refuses a JWT key that is not Ed25519', () => {
    const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const error = configErrorOf(
      localEnv({
        JWT_PRIVATE_KEY: rsa.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
        JWT_PUBLIC_KEY: rsa.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      }),
    );
    expect(error.problems).toEqual([
      { variable: 'JWT_PRIVATE_KEY', problem: 'must be an Ed25519 private key (PKCS#8 PEM)' },
      { variable: 'JWT_PUBLIC_KEY', problem: 'must be an Ed25519 public key (SPKI PEM)' },
    ]);
  });

  it('refuses text that is not a PEM key, without echoing it', () => {
    const error = configErrorOf(localEnv({ JWT_PRIVATE_KEY: 'not-a-key', JWT_PUBLIC_KEY: 'nope' }));
    expect(error.problems).toEqual([
      { variable: 'JWT_PRIVATE_KEY', problem: 'must be an Ed25519 private key (PKCS#8 PEM)' },
      { variable: 'JWT_PUBLIC_KEY', problem: 'must be an Ed25519 public key (SPKI PEM)' },
    ]);
    expect(error.message).not.toContain('not-a-key');
  });

  it('refuses a public key that does not belong to the private key', () => {
    const other = generateKeyPairSync('ed25519');
    const error = configErrorOf(
      localEnv({
        JWT_PUBLIC_KEY: other.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      }),
    );
    expect(error.problems).toEqual([
      { variable: 'JWT_PUBLIC_KEY', problem: 'must be the public half of JWT_PRIVATE_KEY' },
    ]);
  });

  it('keeps KMS_KEY_ID optional until the M12 KMS adapter', () => {
    expect(loadConfig(productionEnv()).KMS_KEY_ID).toBeUndefined();
  });
});
