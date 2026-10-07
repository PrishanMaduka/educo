import { pino } from 'pino';
import { describe, expect, it, vi } from 'vitest';

import { runSentryTest } from '../src/cli/sentry-test';
import { AppErrorFilter } from '../src/common/error.filter';
import { NotFoundError } from '../src/common/errors';
import { loadConfig } from '../src/config';
import { initErrorReporting } from '../src/observability/sentry';

import { localEnv, productionEnv } from './env';

import type { ErrorReporter } from '../src/observability/sentry';
import type { ArgumentsHost } from '@nestjs/common';

function fakeReporter(eventId = 'evt-1'): ErrorReporter & {
  captured: unknown[];
  flushes: number[];
} {
  const captured: unknown[] = [];
  const flushes: number[] = [];
  return {
    captured,
    flushes,
    capture: (error) => {
      captured.push(error);
      return eventId;
    },
    flush: (timeoutMs) => {
      flushes.push(timeoutMs);
      return Promise.resolve(true);
    },
  };
}

/** A Nest host whose response records the status it was given. */
function httpHost(): { host: ArgumentsHost; statuses: number[] } {
  const statuses: number[] = [];
  const reply = {
    status(code: number) {
      statuses.push(code);
      return reply;
    },
    send: () => reply,
  };
  const host = {
    switchToHttp: () => ({ getResponse: () => reply }),
  } as unknown as ArgumentsHost;
  return { host, statuses };
}

describe('initErrorReporting', () => {
  it('is a no-op without SENTRY_DSN', async () => {
    const reporter = initErrorReporting({ APP_ENV: 'local' }, 'api');
    expect(reporter.capture(new Error('ignored'))).toBeUndefined();
    await expect(reporter.flush(10)).resolves.toBe(true);
  });
});

describe('AppErrorFilter error reporting', () => {
  const logger = pino({ level: 'silent' });

  it('reports an unexpected error once', () => {
    const reporter = fakeReporter();
    const { host, statuses } = httpHost();
    const error = new Error('boom');

    new AppErrorFilter(logger, reporter).catch(error, host);

    expect(statuses).toEqual([500]);
    expect(reporter.captured).toEqual([error]);
  });

  it('does not report an expected error', () => {
    const reporter = fakeReporter();
    const { host, statuses } = httpHost();

    new AppErrorFilter(logger, reporter).catch(new NotFoundError(), host);

    expect(statuses).toEqual([404]);
    expect(reporter.captured).toEqual([]);
  });

  it('reports nothing by default', () => {
    const { host, statuses } = httpHost();
    expect(() => {
      new AppErrorFilter(logger).catch(new Error('boom'), host);
    }).not.toThrow();
    expect(statuses).toEqual([500]);
  });
});

describe('runSentryTest', () => {
  it('refuses to send in production', async () => {
    const makeReporter = vi.fn(() => fakeReporter());
    const result = await runSentryTest(
      loadConfig(productionEnv({ SENTRY_DSN: 'https://public@o1.ingest.sentry.io/1' })),
      makeReporter,
    );
    expect(result).toEqual({
      code: 1,
      message: 'The Sentry test error is not sent in production.',
    });
    expect(makeReporter).not.toHaveBeenCalled();
  });

  it('refuses without SENTRY_DSN', async () => {
    const result = await runSentryTest(loadConfig(localEnv()), () => fakeReporter());
    expect(result).toEqual({ code: 1, message: 'SENTRY_DSN is not set.' });
  });

  it('captures a test error, flushes for 5 s and prints the event id', async () => {
    const reporter = fakeReporter('0192a6f41b2c7d3e8f40123456789abc');
    const config = loadConfig(
      productionEnv({ APP_ENV: 'staging', SENTRY_DSN: 'https://public@o1.ingest.sentry.io/1' }),
    );

    const result = await runSentryTest(config, () => reporter);

    expect(reporter.captured).toHaveLength(1);
    expect(String(reporter.captured[0])).toBe('Error: Quad Sentry test error (api, staging)');
    expect(reporter.flushes).toEqual([5_000]);
    expect(result).toEqual({
      code: 0,
      message: 'Sent the Sentry test error 0192a6f41b2c7d3e8f40123456789abc.',
    });
  });

  it('fails when the event could not be delivered in time', async () => {
    const reporter = { ...fakeReporter(), flush: () => Promise.resolve(false) };
    const config = loadConfig(
      productionEnv({ APP_ENV: 'staging', SENTRY_DSN: 'https://public@o1.ingest.sentry.io/1' }),
    );

    const result = await runSentryTest(config, () => reporter);

    expect(result).toEqual({
      code: 1,
      message: 'The Sentry test error was not delivered within 5 s.',
    });
  });
});
