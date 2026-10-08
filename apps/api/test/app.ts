import { Writable } from 'node:stream';

import pino from 'pino';
import { afterAll, beforeAll } from 'vitest';

import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { createLogger } from '../src/observability/logger';

import { localEnv } from './env';

import type { CreateAppOptions } from '../src/app';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { Logger } from 'pino';

export interface TestAppOptions extends CreateAppOptions {
  /** Listen on a random port of 127.0.0.1, for clients that need a real socket (WebSocket). */
  readonly listen?: boolean;
}

type EnvOverrides = Record<string, string | undefined>;

/**
 * Builds the real app once per test file and closes it afterwards. Requests go through
 * Fastify's `inject`, so no port is opened unless `listen` is set. `overrides` may be a function
 * when the values only exist once an earlier `beforeAll` has run (a fresh test database).
 */
export function useTestApp(
  overrides: EnvOverrides | (() => EnvOverrides) = {},
  { listen = false, ...options }: TestAppOptions = {},
): () => NestFastifyApplication {
  let app: NestFastifyApplication | undefined;

  beforeAll(async () => {
    const env = typeof overrides === 'function' ? overrides() : overrides;
    app = await createApp(loadConfig(localEnv(env)), {
      logger: pino({ level: 'silent' }),
      ...options,
    });
    if (listen) {
      await app.listen(0, '127.0.0.1');
    } else {
      await app.getHttpAdapter().getInstance().ready();
    }
  });

  afterAll(async () => {
    await app?.close();
  });

  return () => {
    if (!app) throw new Error('The test app is not ready; read it inside a test or hook.');
    return app;
  };
}

/** Closed local ports, so readiness checks fail fast without any service running. */
export const CLOSED_PORTS = {
  DATABASE_URL: 'postgres://quad_app:quad_app@127.0.0.1:1/quad',
  REDIS_URL: 'redis://127.0.0.1:2',
};

/** A real app logger at `info` whose JSON lines are collected for assertions. */
export function captureLogs(): { lines: Record<string, unknown>[]; logger: Logger } {
  const lines: Record<string, unknown>[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      lines.push(JSON.parse(chunk.toString()) as Record<string, unknown>);
      callback();
    },
  });
  return { lines, logger: createLogger({ LOG_LEVEL: 'info' }, 'api', stream) };
}
