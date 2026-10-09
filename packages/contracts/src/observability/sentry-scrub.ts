import { dropPostgresErrorDetails, scrubTelemetryText, scrubTelemetryUrl } from './telemetry-scrub';

/**
 * The parts of a Sentry event (`ErrorEvent` in `@sentry/core`) the scrubber reads. Structural, so
 * the API (`@sentry/node`) and the web apps (`@sentry/nextjs`) share it without this package
 * depending on Sentry.
 */
export interface ScrubbableEvent {
  request?: { url?: string; method?: string; headers?: Record<string, string> };
  user?: { id?: string | number };
  exception?: { values?: { stacktrace?: { frames?: { vars?: unknown }[] } }[] };
}

/** The request fields kept; the body, cookies, query string and `env` (client IP) go. */
const KEPT_REQUEST_FIELDS: ReadonlySet<string> = new Set(['url', 'method', 'headers']);

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

/** The `contexts.trace` keys that hold only hex ids and are sent unscrubbed. */
const TRACE_ID_KEYS = new Set(['trace_id', 'span_id', 'parent_span_id']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Replaces, in place, every string under `value` with its scrubbed form, except under the keys
 * `skip` names at this level.
 */
function scrubStrings(value: unknown, skip: (key: string) => boolean = () => false): void {
  if (Array.isArray(value)) {
    value.forEach((item: unknown, index) => {
      if (typeof item === 'string') value[index] = scrubTelemetryText(item);
      else scrubStrings(item);
    });
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, item] of Object.entries(value)) {
    if (skip(key)) continue;
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
 * - reduces the request to its URL (without query or fragment), method and `user-agent` header,
 *   so the body, cookies, query string and client address go;
 * - reduces the user to `{ id }` (or removes it when there is no id);
 * - deletes local variables from stack frames;
 * - drops `detail` and `where` from any Postgres error in the event (row values, statement text);
 * - scrubs emails, phone numbers, credentials, query values and path tokens from every other
 *   string (messages, exception values, stack frames, breadcrumbs, extras, contexts, tags),
 *   except the ids in `contexts.trace` (`trace_id`, `span_id`, `parent_span_id`).
 */
export function scrubSentryEvent<T extends ScrubbableEvent>(event: T): T {
  const { request, user, exception } = event;
  if (request !== undefined) {
    removeAllBut(request, (key) => KEPT_REQUEST_FIELDS.has(key));
    if (request.headers !== undefined) {
      removeAllBut(request.headers, (name) => name.toLowerCase() === KEPT_HEADER);
    }
    if (request.url !== undefined) request.url = scrubTelemetryUrl(request.url);
  }
  if (user !== undefined) {
    if (user.id === undefined) delete event.user;
    else removeAllBut(user, (key) => key === 'id');
  }
  for (const value of exception?.values ?? []) {
    for (const frame of value.stacktrace?.frames ?? []) delete frame.vars;
  }
  dropPostgresErrorDetails(event);
  scrubStrings(event, (key) => key === 'contexts');
  const contexts: unknown = Reflect.get(event, 'contexts');
  scrubStrings(contexts, (key) => key === 'trace');
  // Only the ids are exempt (hex ids can look like phone numbers); the rest of the trace context
  // (description, data, status) can carry URLs and text, so it is scrubbed like everything else.
  if (isRecord(contexts)) scrubStrings(contexts.trace, (key) => TRACE_ID_KEYS.has(key));
  return event;
}
