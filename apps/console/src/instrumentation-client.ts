import { SENTRY_DATA_COLLECTION, scrubSentryEvent } from '@quad/contracts/observability';

/** Integrations the browser SDK would add that record spans or sessions; tracing is server-side. */
const DROPPED_INTEGRATIONS: ReadonlySet<string> = new Set(['BrowserTracing', 'Replay']);

// Inlined at build time (spec 02 "Web public (build time)"). Off, and not even loaded, when empty.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn !== undefined && dsn !== '') {
  void import('@sentry/nextjs').then((Sentry) => {
    Sentry.init({
      dsn,
      environment: process.env.NEXT_PUBLIC_APP_ENV,
      tracePropagationTargets: [],
      dataCollection: SENTRY_DATA_COLLECTION,
      integrations: (defaults) =>
        defaults.filter((integration) => !DROPPED_INTEGRATIONS.has(integration.name)),
      beforeSend: scrubSentryEvent,
    });
  });
}
