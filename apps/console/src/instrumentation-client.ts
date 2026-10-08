import { SENTRY_DATA_COLLECTION, scrubSentryEvent } from '@quad/contracts/observability';

/**
 * Integrations the browser SDK would add that are not wanted: tracing and replay (tracing is
 * server-side), and console breadcrumbs, since console messages can echo what people typed.
 */
const DROPPED_INTEGRATIONS: ReadonlySet<string> = new Set(['BrowserTracing', 'Replay', 'Console']);

// Inlined at build time (spec 02 "Web public (build time)"). Off, and not even loaded, when empty.
// No release is set: browser releases arrive with source map upload (D28).
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn !== undefined && dsn !== '') {
  void import('@sentry/nextjs').then((Sentry) => {
    Sentry.init({
      dsn,
      environment: process.env.NEXT_PUBLIC_APP_ENV,
      tracePropagationTargets: [],
      enhanceFetchErrorMessages: 'report-only',
      dataCollection: SENTRY_DATA_COLLECTION,
      integrations: (defaults) =>
        defaults.filter((integration) => !DROPPED_INTEGRATIONS.has(integration.name)),
      beforeSend: scrubSentryEvent,
    });
  });
}
