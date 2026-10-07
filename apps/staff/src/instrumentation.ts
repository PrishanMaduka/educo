import { SENTRY_DATA_COLLECTION, ScrubSpanProcessor, scrubSentryEvent } from '@quad/contracts/observability';

/** An unset or empty variable (`NAME=` in .env) counts as missing. */
function read(name: string): string | undefined {
  const value = process.env[name];
  return value === undefined || value === '' ? undefined : value;
}

/**
 * Server-side error reporting and tracing (spec 20 → Observability, D28), from runtime variables
 * so one image serves every environment. Each is off, and loads nothing, when unconfigured.
 * Sentry registers no tracer provider and records no spans; traces go only through
 * OpenTelemetry (`@vercel/otel`), with span attributes scrubbed before export.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const dsn = read('SENTRY_DSN');
  if (dsn !== undefined) {
    const Sentry = await import('@sentry/nextjs');
    Sentry.init({
      dsn,
      environment: read('SENTRY_ENVIRONMENT') ?? read('APP_ENV'),
      release: read('SENTRY_RELEASE'),
      enableOpenTelemetrySetup: false,
      tracePropagationTargets: [],
      includeLocalVariables: false,
      dataCollection: SENTRY_DATA_COLLECTION,
      beforeSend: scrubSentryEvent,
    });
  }

  if (read('OTEL_EXPORTER_OTLP_ENDPOINT') !== undefined) {
    const { registerOTel } = await import('@vercel/otel');
    // Every span is kept (staging volume); tail sampling arrives with production in M12.
    registerOTel({
      serviceName: read('OTEL_SERVICE_NAME') ?? 'quad-staff',
      spanProcessors: [new ScrubSpanProcessor(), 'auto'],
    });
  }
}

/** Reports errors thrown while rendering or in route handlers (a no-op when Sentry is off). */
export { captureRequestError as onRequestError } from '@sentry/nextjs';
