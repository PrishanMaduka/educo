import { scrubSentryEvent } from '@quad/contracts/observability';
import * as Sentry from '@sentry/node';
import { describe, expect, it, vi } from 'vitest';

import { initErrorReporting } from '../src/observability/sentry';

vi.mock('@sentry/node', async (importOriginal) => {
  const actual = await importOriginal<typeof Sentry>();
  return {
    ...actual,
    init: vi.fn(),
    captureException: vi.fn(() => 'evt-1'),
    flush: vi.fn(() => Promise.resolve(true)),
  };
});

const DSN = 'https://public@o1.ingest.sentry.io/1';

describe('initErrorReporting with a DSN', () => {
  it('starts Sentry without tracing, with the scrubber and minimal data collection', async () => {
    const reporter = initErrorReporting(
      { APP_ENV: 'staging', SENTRY_DSN: DSN, SENTRY_RELEASE: '1.2.3' },
      'worker',
    );

    expect(Sentry.init).toHaveBeenCalledTimes(1);
    const options = vi.mocked(Sentry.init).mock.calls[0]?.[0];
    expect(options).toMatchObject({
      dsn: DSN,
      environment: 'staging',
      release: '1.2.3',
      enableOpenTelemetrySetup: false,
      tracesSampleRate: 0,
      tracePropagationTargets: [],
      includeLocalVariables: false,
      beforeSend: scrubSentryEvent,
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpBodies: [],
        urlQueryParams: false,
        databaseQueryData: false,
        stackFrameVariables: false,
      },
    });
    const names = (options?.defaultIntegrations || []).map((integration) => integration.name);
    expect(names).not.toContain('Postgres');
    expect(names).not.toContain('Redis');
    expect(names).not.toContain('Fastify');
    expect(names).toContain('OnUncaughtException');

    expect(reporter.capture(new Error('boom'))).toBe('evt-1');
    await expect(reporter.flush(100)).resolves.toBe(true);
  });

  it('prefers SENTRY_ENVIRONMENT over APP_ENV', () => {
    vi.mocked(Sentry.init).mockClear();
    initErrorReporting(
      { APP_ENV: 'staging', SENTRY_DSN: DSN, SENTRY_ENVIRONMENT: 'staging-blue' },
      'api',
    );
    expect(vi.mocked(Sentry.init).mock.calls[0]?.[0]).toMatchObject({
      environment: 'staging-blue',
    });
  });
});
