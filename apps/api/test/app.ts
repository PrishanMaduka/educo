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

/**
 * Builds the real app once per test file and closes it afterwards. Requests go through
 * Fastify's `inject`, so no port is opened.
 */
export function useTestApp(
  overrides: Record<string, string | undefined> = {},
  options: CreateAppOptions = {},
): () => NestFastifyApplication {
  let app: NestFastifyApplication | undefined;

  beforeAll(async () => {
    app = await createApp(loadConfig(localEnv(overrides)), {
      logger: pino({ level: 'silent' }),
      ...options,
    });
    await app.getHttpAdapter().getInstance().ready();
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
