// The e2e stack's pure parts (scripts/e2e-stack.mjs): arguments, the per-run database and Redis
// database, and the environment the API, worker, migrations and seed get. The live checks (start,
// /health/ready, two stacks side by side, the database dropped on exit) are in
// e2e-stack.api.test.ts, which needs the compose services and the built API.
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_STACK_PORT,
  isStackDatabaseName,
  parseStackArgs,
  readEnvExample,
  redisDatabaseFor,
  stackDatabaseName,
  stackEnv,
} from '../e2e-stack.mjs';

describe('parseStackArgs', () => {
  it('defaults to port 4000, the port the web builds send /api/v1 to', () => {
    expect(DEFAULT_STACK_PORT).toBe(4000);
    expect(parseStackArgs([])).toEqual({ port: 4000 });
  });

  it('takes --port <n> and --port=<n>', () => {
    expect(parseStackArgs(['--port', '4001'])).toEqual({ port: 4001 });
    expect(parseStackArgs(['--port=4002'])).toEqual({ port: 4002 });
  });

  it.each([['--port'], ['--port', 'x'], ['--port', '0'], ['--port', '70000'], ['--verbose']])(
    'refuses %j',
    (...argv) => {
      expect(() => parseStackArgs(argv)).toThrow();
    },
  );
});

describe('the per-run databases', () => {
  it('names the Postgres database after the process, so parallel runs never share one', () => {
    expect(stackDatabaseName(4242)).toBe('quad_e2e_4242');
  });

  it('drops only databases with that shape', () => {
    expect(isStackDatabaseName('quad_e2e_4242')).toBe(true);
    for (const name of ['quad', 'quad_test_ab12', 'quad_e2e_', 'quad_e2e_1; drop', 'postgres']) {
      expect(isStackDatabaseName(name), name).toBe(false);
    }
  });

  it('gives each port its own Redis database, never 0 (the developer’s)', () => {
    expect(redisDatabaseFor(4000)).not.toBe(redisDatabaseFor(4001));
    for (let port = 4000; port < 4015; port += 1) {
      const index = redisDatabaseFor(port);
      expect(index).toBeGreaterThanOrEqual(1);
      expect(index).toBeLessThanOrEqual(15);
    }
    expect(new Set(Array.from({ length: 15 }, (_, i) => redisDatabaseFor(4000 + i))).size).toBe(15);
  });
});

describe('stackEnv', () => {
  const example = readEnvExample();
  const env = stackEnv({ port: 4001, pid: 77, example, env: {} });

  it('points every role at the run’s own database, never the main one', () => {
    expect(env.DATABASE_URL).toBe('postgres://quad_app:quad_app@localhost:5432/quad_e2e_77');
    expect(env.DATABASE_PLATFORM_URL).toBe(
      'postgres://quad_platform:quad_platform@localhost:5432/quad_e2e_77',
    );
    expect(env.DATABASE_OWNER_URL).toBe(
      'postgres://quad_owner:quad_owner@localhost:5432/quad_e2e_77',
    );
    expect(env.DATABASE_ADMIN_URL).toBe('postgres://postgres:postgres@localhost:5432/postgres');
  });

  it('runs local, with the fixed code, Mailpit and the port, and its own Redis database', () => {
    expect(env).toMatchObject({
      APP_ENV: 'local',
      DEV_FIXED_OTP: '000000',
      API_PORT: '4001',
      EMAIL_PROVIDER: 'smtp',
      SMTP_URL: 'smtp://localhost:1025',
      SMS_PROVIDER: 'log',
      REDIS_URL: `redis://localhost:6379/${String(redisDatabaseFor(4001))}`,
    });
  });

  it('has no fake-clock variable: expired links come from the signed-token helper', () => {
    expect(Object.keys(env).filter((key) => /CLOCK|NOW|TIME/.test(key))).toEqual([]);
  });

  it('takes the local secrets and seed password from .env.example', () => {
    expect(env.SEED_PASSWORD).toBe(example.SEED_PASSWORD);
    expect(env.LINK_SIGNING_SECRET).toBe(example.LINK_SIGNING_SECRET);
    expect(env.FIELD_ENCRYPTION_KEY).toBe(example.FIELD_ENCRYPTION_KEY);
  });

  it('takes where the services are from the environment (CI), and nothing else', () => {
    const ci = stackEnv({
      port: 4000,
      pid: 5,
      example,
      env: {
        DATABASE_URL: 'postgres://quad_app:quad_app@db.ci:5433/quad',
        DATABASE_ADMIN_URL: 'postgres://postgres:postgres@db.ci:5433/quad',
        REDIS_URL: 'redis://cache.ci:6380',
        SMTP_URL: 'smtp://mail.ci:2525',
        SEED_PASSWORD: 'from-the-shell',
        APP_ENV: 'production',
        DEV_FIXED_OTP: '123456',
      },
    });
    expect(ci).toMatchObject({
      DATABASE_URL: 'postgres://quad_app:quad_app@db.ci:5433/quad_e2e_5',
      DATABASE_ADMIN_URL: 'postgres://postgres:postgres@db.ci:5433/postgres',
      REDIS_URL: `redis://cache.ci:6380/${String(redisDatabaseFor(4000))}`,
      SMTP_URL: 'smtp://mail.ci:2525',
      SEED_PASSWORD: example.SEED_PASSWORD,
      APP_ENV: 'local',
      DEV_FIXED_OTP: '000000',
    });
  });
});
