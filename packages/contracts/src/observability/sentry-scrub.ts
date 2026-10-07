import { scrubTelemetryText, scrubTelemetryUrl } from './telemetry-scrub';

/**
 * The parts of a Sentry event (`ErrorEvent` in `@sentry/core`) the scrubber reads. Structural, so
 * the API (`@sentry/node`) and the web apps (`@sentry/nextjs`) share it without this package
 * depending on Sentry.
 */
export interface ScrubbableEvent {
  request?: {
    url?: string;
    data?: unknown;
    cookies?: unknown;
    query_string?: unknown;
    headers?: Record<string, string>;
  };
  user?: { id?: string | number };
}

/** The only request header kept: it says which browser or app failed, not who. */
const KEPT_HEADER = 'user-agent';

/**
 * Sentry's `dataCollection` option for every Quad app. Sentry 11 collects everything by default
 * (it replaced `sendDefaultPii`), so each category is switched off here: no user fields,
 * cookies, bodies, query values, SQL data, job arguments, AI prompts or local variables, and only
 * the `user-agent` request header. `scrubSentryEvent` still runs on every event as a backstop.
 */
export const SENTRY_DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: { request: { allow: [KEPT_HEADER] }, response: false },
  httpBodies: [],
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
};

/**
 * Keys never rewritten: stack frames (file names and line numbers), the SDK's own metadata and
 * ids. Everything else is walked and its strings scrubbed.
 */
const SKIPPED_KEYS: ReadonlySet<string> = new Set([
  'stacktrace',
  'debug_meta',
  'sdk',
  'modules',
  'event_id',
  'trace',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Replaces, in place, every string under `value` with its scrubbed form. */
function scrubStrings(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach((item: unknown, index) => {
      if (typeof item === 'string') value[index] = scrubTelemetryText(item);
      else scrubStrings(item);
    });
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, item] of Object.entries(value)) {
    if (SKIPPED_KEYS.has(key)) continue;
    if (typeof item === 'string') value[key] = scrubTelemetryText(item);
    else scrubStrings(item);
  }
}

function removeAllBut(record: object, kept: (key: string) => boolean): void {
  for (const key of Object.keys(record)) {
    if (!kept(key)) Reflect.deleteProperty(record, key);
  }
}

/**
 * Sentry's `beforeSend` for every Quad app (D21, spec 16). In place, it:
 * - deletes the request body, cookies and query string, and keeps only the `user-agent` header;
 * - drops the query and fragment from the request URL;
 * - reduces the user to `{ id }` (or removes it when there is no id);
 * - scrubs emails, phone numbers, credentials, query values and path tokens from every other
 *   string (messages, exception values, breadcrumbs, extras, contexts, tags).
 */
export function scrubSentryEvent<T extends ScrubbableEvent>(event: T): T {
  const { request, user } = event;
  if (request !== undefined) {
    delete request.data;
    delete request.cookies;
    delete request.query_string;
    if (request.headers !== undefined) {
      removeAllBut(request.headers, (name) => name.toLowerCase() === KEPT_HEADER);
    }
    if (request.url !== undefined) request.url = scrubTelemetryUrl(request.url);
  }
  if (user !== undefined) {
    if (user.id === undefined) delete event.user;
    else removeAllBut(user, (key) => key === 'id');
  }
  scrubStrings(event);
  return event;
}
