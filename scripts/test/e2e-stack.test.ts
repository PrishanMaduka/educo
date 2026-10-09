// The e2e stack's pure parts (scripts/e2e-stack.mjs): arguments, the per-run database and Redis
// database, and the environment the API, worker, migrations and seed get. The live checks (start,
// /health/ready, two stacks side by side, the database dropped on exit) are in
// e2e-stack.api.test.ts, which needs the compose services and the built API.
import { EventEmitter } from 'node:events';

import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_STACK_PORT,
  createStack,
  isStackDatabaseName,
  newStackDatabaseName,
  parseStackArgs,
  readEnvExample,
  redisDatabaseFor,
  stackDatabaseName,
  stackEnv,
  superviseStack,
} from '../e2e-stack.mjs';

/** A promise with its resolve handle, to hold a step open while the test acts. */
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** Lets pending promise callbacks run. */
const settle = () => new Promise((done) => setTimeout(done, 0));

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

  it('takes ports 4000 to 4014 only, one per Redis database, and says why it refuses others', () => {
    expect(parseStackArgs(['--port', '4014'])).toEqual({ port: 4014 });
    for (const port of ['3999', '4015', '4900']) {
      expect(() => parseStackArgs(['--port', port])).toThrow(/ports 4000 to 4014.*Redis database/);
    }
  });
});

describe('the per-run databases', () => {
  it('names the Postgres database after the process and 8 random hex digits', () => {
    expect(stackDatabaseName(4242, '0a1b2c3d')).toBe('quad_e2e_4242_0a1b2c3d');
    const name = newStackDatabaseName(4242);
    expect(name).toMatch(/^quad_e2e_4242_[0-9a-f]{8}$/);
    // A reused pid (a container restart) never names an earlier run's database.
    expect(newStackDatabaseName(4242)).not.toBe(name);
  });

  it('touches only databases with exactly that shape', () => {
    expect(isStackDatabaseName('quad_e2e_4242_0a1b2c3d')).toBe(true);
    for (const name of [
      'quad',
      'quad_test_ab12',
      'quad_e2e_',
      'quad_e2e_4242',
      'quad_e2e_4242_0A1B2C3D',
      'quad_e2e_4242_0a1b2c3',
      'quad_e2e_4242_0a1b2c3d4',
      'quad_e2e_1_0a1b2c3d; drop',
      'postgres',
    ]) {
      expect(isStackDatabaseName(name), name).toBe(false);
    }
    expect(() => stackDatabaseName(1, 'xyz')).toThrow();
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
  const env = stackEnv({ port: 4001, database: 'quad_e2e_77_0a1b2c3d', example, env: {} });

  it('points every role at the run’s own database, never the main one', () => {
    expect(env.DATABASE_URL).toBe(
      'postgres://quad_app:quad_app@localhost:5432/quad_e2e_77_0a1b2c3d',
    );
    expect(env.DATABASE_PLATFORM_URL).toBe(
      'postgres://quad_platform:quad_platform@localhost:5432/quad_e2e_77_0a1b2c3d',
    );
    expect(env.DATABASE_OWNER_URL).toBe(
      'postgres://quad_owner:quad_owner@localhost:5432/quad_e2e_77_0a1b2c3d',
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

  it('trusts one proxy hop, the web app’s rewrite, so each journey can be its own client', () => {
    expect(env.TRUST_PROXY_HOPS).toBe('1');
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
      database: 'quad_e2e_5_0a1b2c3d',
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
      DATABASE_URL: 'postgres://quad_app:quad_app@db.ci:5433/quad_e2e_5_0a1b2c3d',
      DATABASE_ADMIN_URL: 'postgres://postgres:postgres@db.ci:5433/postgres',
      REDIS_URL: `redis://cache.ci:6380/${String(redisDatabaseFor(4000))}`,
      SMTP_URL: 'smtp://mail.ci:2525',
      SEED_PASSWORD: example.SEED_PASSWORD,
      APP_ENV: 'local',
      DEV_FIXED_OTP: '000000',
    });
  });
});

describe('stackEnv and TLS Redis', () => {
  it('refuses rediss://: the stack speaks plain Redis to empty its database', () => {
    expect(() =>
      stackEnv({
        port: 4000,
        database: 'quad_e2e_5_0a1b2c3d',
        example: readEnvExample(),
        env: { REDIS_URL: 'rediss://cache.example:6380' },
      }),
    ).toThrow(/rediss:\/\/ .*not supported/);
  });
});

describe('createStack start and stop', () => {
  /** A stack whose admin SQL the test answers by hand, with the file and port checks passed. */
  function heldStack() {
    const statements: string[] = [];
    const steps: Array<ReturnType<typeof deferred>> = [];
    const admin = vi.fn((_url: string, sql: string[]) => {
      statements.push(...sql);
      const step = deferred();
      steps.push(step);
      return step.promise;
    });
    const stack = createStack({
      port: 4013,
      env: {},
      deps: { admin, preflight: () => Promise.resolve(), emptyRedis: () => Promise.resolve() },
    });
    return { stack, statements, steps, admin };
  }

  it('waits for an in-flight create before dropping, so a signal during start-up leaks nothing', async () => {
    const { stack, statements, steps } = heldStack();
    const started = stack.start().catch((error: unknown) => error);
    await settle();
    // The first admin statement creates: no stale-name pre-drop that could hit another run.
    expect(statements[0]).toBe(`create database ${stack.database} owner quad_owner`);

    const stopped = stack.stop();
    await settle();
    // The create has not answered yet, so no drop has been sent.
    expect(statements.some((sql) => sql.startsWith('drop'))).toBe(false);

    steps[0]?.resolve();
    await settle();
    expect(statements.at(-1)).toBe(`drop database if exists ${stack.database} with (force)`);
    steps.at(-1)?.resolve();
    await stopped;
    expect(await started).toEqual(new Error('Stopped while starting.'));
  });

  it('creates nothing and drops nothing when stopped before the create', async () => {
    const { stack, admin } = heldStack();
    const stopped = stack.stop();
    await expect(stack.start()).rejects.toThrow('Stopped while starting.');
    await stopped;
    expect(admin).not.toHaveBeenCalled();
  });
});

describe('superviseStack', () => {
  function supervised() {
    const proc = new EventEmitter();
    const stopping = deferred();
    const stack = {
      database: 'quad_e2e_1_0a1b2c3d',
      stop: vi.fn(() => stopping.promise),
      onUnexpectedExit: vi.fn(),
    };
    const exit = vi.fn();
    const lines: string[] = [];
    superviseStack({ stack, proc, log: (line: string) => lines.push(line), exit });
    return { proc, stopping, stack, exit, lines };
  }

  it('stays installed for a second uncaught error during stop, which cannot skip the drop', async () => {
    const { proc, stopping, stack, exit, lines } = supervised();
    proc.emit('uncaughtException', new Error('first'));
    expect(proc.listenerCount('uncaughtException')).toBe(1);
    proc.emit('uncaughtException', new Error('second'));
    proc.emit('unhandledRejection', new Error('third'));
    await settle();
    expect(stack.stop).toHaveBeenCalledTimes(1);
    expect(exit).not.toHaveBeenCalled();

    stopping.resolve();
    await settle();
    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1);
    expect(lines).toEqual(['first', 'second', 'third']);
  });

  it('exits once with the first signal’s code, however many signals arrive', async () => {
    const { proc, stopping, stack, exit } = supervised();
    proc.emit('SIGTERM');
    proc.emit('SIGINT');
    expect(proc.listenerCount('SIGINT')).toBe(1);
    stopping.resolve();
    await settle();
    expect(stack.stop).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(143);
  });
});
