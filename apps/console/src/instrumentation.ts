import {
  SENTRY_DATA_COLLECTION,
  ScrubSpanProcessor,
  scrubSentryEvent,
} from '@quad/contracts/observability';

import type { Instrumentation } from 'next';

/** An unset or empty variable (`NAME=` in .env) counts as missing. */
function read(name: string): string | undefined {
  const value = process.env[name];
  return value === undefined || value === '' ? undefined : value;
}

/** Sentry and `@vercel/otel` are loaded only when configured; unconfigured, neither module loads. */
const isSentryOn = (): boolean =>
  process.env.NEXT_RUNTIME === 'nodejs' && read('SENTRY_DSN') !== undefined;

async function startSentry(dsn: string): Promise<void> {
  const Sentry = await import('@sentry/nextjs');
  // `tracesSampleRate: 0` keeps `SENTRY_TRACES_SAMPLE_RATE` from turning Sentry tracing on, but
  // makes the SDK add its tracing integrations; they are removed, so only OpenTelemetry traces.
  const withoutPerformance = new Set(
    Sentry.getDefaultIntegrationsWithoutPerformance().map((integration) => integration.name),
  );
  const tracingOnly = new Set(
    Sentry.getDefaultIntegrations({ tracesSampleRate: 0 })
      .map((integration) => integration.name)
      .filter((name) => !withoutPerformance.has(name)),
  );
  Sentry.init({
    dsn,
    environment: read('SENTRY_ENVIRONMENT') ?? read('APP_ENV'),
    release: read('SENTRY_RELEASE'),
    enableOpenTelemetrySetup: false,
    enableRuntimeChannelInjection: false,
    enhanceFetchErrorMessages: 'report-only',
    tracesSampleRate: 0,
    tracePropagationTargets: [],
    integrations: (defaults) =>
      defaults.filter((integration) => !tracingOnly.has(integration.name)),
    includeLocalVariables: false,
    dataCollection: SENTRY_DATA_COLLECTION,
    beforeSend: scrubSentryEvent,
  });
}

/**
 * Server-side error reporting and tracing (spec 20 → Observability, D28), from runtime variables
 * so one image serves every environment. Sentry registers no tracer provider and records no
 * spans; traces go only through OpenTelemetry (`@vercel/otel`), with spans scrubbed before export.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const dsn = read('SENTRY_DSN');
  if (dsn !== undefined) await startSentry(dsn);

  if (read('OTEL_EXPORTER_OTLP_ENDPOINT') !== undefined) {
    const { registerOTel } = await import('@vercel/otel');
    // Every span is kept (staging volume); tail sampling arrives with production in M12.
    registerOTel({
      serviceName: read('OTEL_SERVICE_NAME') ?? 'quad-console',
      spanProcessors: [new ScrubSpanProcessor(), 'auto'],
    });
  }
}

/** Reports errors thrown while rendering or in route handlers; returns at once when Sentry is off. */
export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (!isSentryOn()) return;
  const { captureRequestError } = await import('@sentry/nextjs');
  captureRequestError(...args);
};
