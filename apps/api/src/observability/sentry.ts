import { SENTRY_DATA_COLLECTION, scrubSentryEvent } from '@quad/contracts/observability';
import * as Sentry from '@sentry/node';

import type { Config } from '../config';

export interface ErrorReporter {
  /** Reports an unexpected error; returns the Sentry event id, or undefined when reporting is off. */
  capture(error: unknown): string | undefined;
  /** Waits up to `timeoutMs` for queued events to be sent; resolves false on timeout. */
  flush(timeoutMs: number): Promise<boolean>;
}

export const NO_OP_REPORTER: ErrorReporter = {
  capture: () => undefined,
  flush: () => Promise.resolve(true),
};

type ErrorReportingConfig = Pick<
  Config,
  'SENTRY_DSN' | 'SENTRY_ENVIRONMENT' | 'SENTRY_RELEASE' | 'APP_ENV'
>;

/**
 * Framework error hooks Sentry would add. `AppErrorFilter` is the one place that decides what is
 * unexpected and reports it, so these stay off.
 */
const FRAMEWORK_INTEGRATIONS: ReadonlySet<string> = new Set([
  'Express',
  'Fastify',
  'Hapi',
  'Hono',
  'Koa',
]);

/**
 * Starts Sentry error reporting for the API or the worker (spec 20 → Errors, D21), or returns a
 * no-op reporter when `SENTRY_DSN` is unset, so tests and local runs send nothing.
 *
 * Traces go only through OpenTelemetry (`startTracing`): the SDK registers no tracer provider
 * (`enableOpenTelemetrySetup: false`, Sentry 11's form of `skipOpenTelemetrySetup`), adds none of
 * its tracing integrations, creates no HTTP spans and adds no trace headers to outgoing requests.
 * `tracesSampleRate: 0` also stops `SENTRY_TRACES_SAMPLE_RATE` from turning tracing on. Every
 * event passes through `scrubSentryEvent`. `overrides.transport` is for tests (an in-memory
 * transport, so nothing is sent).
 */
export function initErrorReporting(
  config: ErrorReportingConfig,
  service: 'api' | 'worker',
  overrides: Pick<Sentry.NodeOptions, 'transport'> = {},
): ErrorReporter {
  if (config.SENTRY_DSN === undefined) {
    return NO_OP_REPORTER;
  }
  Sentry.init({
    dsn: config.SENTRY_DSN,
    environment: config.SENTRY_ENVIRONMENT ?? config.APP_ENV,
    release: config.SENTRY_RELEASE,
    initialScope: { tags: { service } },
    enableOpenTelemetrySetup: false,
    // No load-time module rewriting: OpenTelemetry's instrumentations own pg, ioredis and Fastify.
    enableRuntimeChannelInjection: false,
    // Hostnames are added to fetch errors only in the report, never to the error the code sees.
    enhanceFetchErrorMessages: 'report-only',
    tracesSampleRate: 0,
    tracePropagationTargets: [],
    defaultIntegrations: Sentry.getDefaultIntegrationsWithoutPerformance().filter(
      (integration) => !FRAMEWORK_INTEGRATIONS.has(integration.name),
    ),
    integrations: [
      Sentry.httpIntegration({ spans: false, tracePropagation: false }),
      Sentry.nativeNodeFetchIntegration({ spans: false, tracePropagation: false }),
    ],
    includeLocalVariables: false,
    dataCollection: SENTRY_DATA_COLLECTION,
    beforeSend: scrubSentryEvent,
    ...overrides,
  });
  return {
    capture: (error) => Sentry.captureException(error),
    flush: (timeoutMs) => Sentry.flush(timeoutMs),
  };
}

/** How long a process that failed to start waits for its error report to be sent. */
const FATAL_FLUSH_MS = 2_000;

/**
 * Reports an error that stops the process (a startup failure) and waits briefly for it to be
 * sent. Does nothing when the failure came before error reporting started; never throws, so the
 * caller can always go on to print the error and exit.
 */
export async function reportFatalError(
  reporter: ErrorReporter | undefined,
  error: unknown,
): Promise<void> {
  if (reporter === undefined) return;
  reporter.capture(error);
  await reporter.flush(FATAL_FLUSH_MS).catch(() => false);
}
