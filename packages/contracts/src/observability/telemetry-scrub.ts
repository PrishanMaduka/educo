/**
 * Removes personal data and credentials from text and span attributes before they leave the
 * process (spec 16: no personal data in telemetry; D21: Sentry with PII scrubbing). Medical and
 * safeguarding details are never put into telemetry on purpose: request bodies, SQL bound values
 * and Redis keys are not recorded at all, so this is the second line of defence for text that
 * slips into messages, URLs and statements.
 */

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
/**
 * Phone numbers: international (`+94 77 000 0001`), `0094…`, a bare `94` followed by nine digits,
 * Sri Lankan local (`077 000 0001`, `0770000001`) and local mobile without the 0 when grouped
 * `7x 000 0000`. A bare nine-digit `7xxxxxxxx` is not caught: it cannot be told apart from an
 * ordinary number.
 */
const PHONE_INTERNATIONAL = /\+\d[\d\s().-]{6,18}\d/g;
const PHONE_LK_PREFIXED = /\b(?:0094[\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{4}|94\d{9})\b/g;
const PHONE_LOCAL = /\b0\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/g;
const PHONE_LOCAL_MOBILE = /\b7\d[\s-]\d{3}[\s-]\d{4}\b/g;
const AUTH_SCHEME = /\b(Bearer|Basic|Token)\s+[A-Za-z0-9._~+/=-]+/gi;
const JWT = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g;
/** The value of every query parameter (`?token=…`, `&code=…`); the names stay for debugging. */
const QUERY_VALUE = /([?&][^=&\s#?]+=)[^&\s#"']*/g;
/**
 * `name=value` where the name says the value is a credential, in free text and cookie strings
 * (`quad_session=…; csrf_token=…`). Values already redacted are left alone.
 */
const SENSITIVE_PAIR =
  /\b([A-Za-z0-9_.-]*(?:session|token|password|passwd|pwd|secret|code|key|auth|sig|otp|cookie)[A-Za-z0-9_.-]*)=(?!\[redacted\])[^\s;&,"'#]+/gi;
/**
 * A path segment that looks like an opaque token (signed links carry them in paths, D25): 32 or
 * more URL-safe characters with at least one digit. UUIDs are kept; they identify records, not
 * people, and are needed to debug.
 */
const PATH_TOKEN = /\/(?=[A-Za-z_-]*\d)[A-Za-z0-9_-]{32,}(?=[/?#\s"']|$)/g;
const UUID = /^\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The text with emails, phone numbers, credentials (auth schemes, JWTs, sensitive `name=value`
 * pairs), query values and path tokens replaced.
 */
export function scrubTelemetryText(text: string): string {
  return text
    .replace(JWT, '[jwt]')
    .replace(AUTH_SCHEME, '$1 [redacted]')
    .replace(QUERY_VALUE, '$1[redacted]')
    .replace(SENSITIVE_PAIR, '$1=[redacted]')
    .replace(PATH_TOKEN, (segment) => (UUID.test(segment) ? segment : '/:token'))
    .replace(EMAIL, '[email]')
    .replace(PHONE_INTERNATIONAL, '[phone]')
    .replace(PHONE_LK_PREFIXED, '[phone]')
    .replace(PHONE_LOCAL, '[phone]')
    .replace(PHONE_LOCAL_MOBILE, '[phone]');
}

/** A URL or path without its query string and fragment, then scrubbed. */
export function scrubTelemetryUrl(url: string): string {
  const end = url.search(/[?#]/);
  return scrubTelemetryText(end === -1 ? url : url.slice(0, end));
}

/** Span attributes that hold a URL or a request target (old and current semantic conventions). */
const URL_ATTRIBUTES: ReadonlySet<string> = new Set([
  'url.full',
  'url.path',
  'http.url',
  'http.target',
  'next.route',
]);
/** Recorded headers can hold cookies and credentials; the query can hold signed-link tokens. */
const DROPPED_ATTRIBUTE = /^(?:http\.(?:request|response)\.header\.|url\.query$)/;

function scrubAttributeValue(key: string, value: unknown): unknown {
  if (typeof value === 'string') {
    return URL_ATTRIBUTES.has(key) ? scrubTelemetryUrl(value) : scrubTelemetryText(value);
  }
  if (Array.isArray(value)) {
    return value.map((item: unknown) =>
      typeof item === 'string' ? scrubTelemetryText(item) : item,
    );
  }
  return value;
}

/**
 * Scrubs OpenTelemetry span attributes in place: drops recorded headers and `url.query`, strips
 * the query from URL attributes, and scrubs every other string value.
 */
export function scrubSpanAttributes(attributes: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(attributes)) {
    if (DROPPED_ATTRIBUTE.test(key)) {
      Reflect.deleteProperty(attributes, key);
    } else {
      attributes[key] = scrubAttributeValue(key, value);
    }
  }
}

/** Something carrying attributes: a span event or a span link. */
interface WithAttributes {
  readonly attributes?: Record<string, unknown>;
}

/** The parts of an OpenTelemetry `ReadableSpan` the scrubber touches. */
export interface ScrubbableSpan {
  name: string;
  readonly status: { message?: string };
  readonly attributes: Record<string, unknown>;
  readonly events: readonly WithAttributes[];
  readonly links: readonly WithAttributes[];
}

/**
 * An OpenTelemetry span processor (structurally a `SpanProcessor`, so this package needs no
 * OpenTelemetry dependency) that scrubs a span when it ends: its name (as a URL, since Next.js and
 * fetch spans put the URL there), its status message, its attributes, and the attributes of its
 * events and links. Register it before the exporting processor.
 */
export class ScrubSpanProcessor {
  onStart(): void {
    // Attributes set after start are scrubbed in onEnd, so nothing happens here.
  }

  onEnd(span: ScrubbableSpan): void {
    span.name = scrubTelemetryUrl(span.name);
    if (span.status.message !== undefined) {
      span.status.message = scrubTelemetryText(span.status.message);
    }
    scrubSpanAttributes(span.attributes);
    for (const item of [...span.events, ...span.links]) {
      if (item.attributes !== undefined) scrubSpanAttributes(item.attributes);
    }
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}
