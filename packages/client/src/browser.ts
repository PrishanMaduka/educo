import { ErrorBodySchema } from '@quad/contracts';

import { createApiClient, type ApiClient } from './fetcher';

/**
 * The typed client as the staff portal and the console use it in the browser (spec 06, D32):
 * calls to this origin's `/api/v1` with the session cookie, every write echoing the app's CSRF
 * cookie, and API refusals as `ApiError`. Shared by both web apps (D50).
 */

/** The header a page echoes the CSRF cookie in (the API's `CSRF_HEADER`). */
const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** An API error answer, `{ code, message, fields? }` (spec 06), with its status. */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly fields: Readonly<Record<string, string>>,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * The value of the first of `names` in a `Cookie`-style header (`document.cookie`), or null.
 * Each app names its own cookies: locally the portal and the console share `localhost`.
 */
export function cookieValue(cookieHeader: string, names: readonly string[]): string | null {
  for (const part of cookieHeader.split(';')) {
    const at = part.indexOf('=');
    if (at === -1) continue;
    if (names.includes(part.slice(0, at).trim())) return part.slice(at + 1).trim();
  }
  return null;
}

export interface BrowserApiOptions {
  /** The app's double-submit CSRF cookie names (local, then `__Host-`). */
  csrfCookies: readonly string[];
  /** For tests; the browser's own by default. */
  fetch?: typeof fetch;
  /** `document.cookie` by default, read on every write. */
  cookies?: () => string;
}

/**
 * A typed client for `origin` (the page's own, which rewrites `/api/v1` to the API) that sends
 * the session cookie and echoes the CSRF cookie on writes. Sign-in steps before a session exists
 * send none, as the API expects.
 */
export function createBrowserApi(origin: string, options: BrowserApiOptions): ApiClient {
  const cookies = options.cookies ?? (() => document.cookie);
  const client = createApiClient(origin, {
    credentials: 'same-origin',
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
  });
  client.use({
    onRequest({ request }) {
      if (SAFE_METHODS.has(request.method)) return undefined;
      const token = cookieValue(cookies(), options.csrfCookies);
      if (token !== null) request.headers.set(CSRF_HEADER, token);
      return request;
    },
  });
  return client;
}

/** The API's error body as an `ApiError`; a body that is not one (a proxy's page) is `internal`. */
function apiErrorOf(error: unknown, response: Response): ApiError {
  const body = ErrorBodySchema.safeParse(error);
  if (!body.success) return new ApiError('internal', response.status, {}, response.statusText);
  return new ApiError(body.data.code, response.status, body.data.fields ?? {}, body.data.message);
}

/** The data of a successful call, or an `ApiError` with the API's code and field messages. */
export async function unwrap<T>(
  call: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  const { data, error, response } = await call;
  if (!response.ok) throw apiErrorOf(error, response);
  if (data === undefined) throw new ApiError('internal', response.status, {}, 'No answer body');
  return data;
}

/** As `unwrap`, for a route that answers 204 with no body (or whose body the caller reads). */
export async function unwrapEmpty(
  call: Promise<{ error?: unknown; response: Response }>,
): Promise<void> {
  const { error, response } = await call;
  if (!response.ok) throw apiErrorOf(error, response);
}

/** The API's message for one field of a `validation` answer, if it named that field. */
export function fieldError(error: unknown, field: string): string | undefined {
  return error instanceof ApiError && error.code === 'validation' ? error.fields[field] : undefined;
}

/** True for a `validation` answer that named a field, which the field itself shows. */
export function isFieldError(error: unknown): boolean {
  return (
    error instanceof ApiError && error.code === 'validation' && Object.keys(error.fields).length > 0
  );
}

/** The file name an export answer gives (`Content-Disposition`), or `fallback`. */
export function filenameFrom(response: Response, fallback: string): string {
  const header = response.headers.get('content-disposition') ?? '';
  return /filename="([^"]+)"/.exec(header)?.[1] ?? fallback;
}
