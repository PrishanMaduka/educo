import { createApiClient, type ApiClient } from '@quad/client';
import { ErrorBodySchema } from '@quad/contracts';

import { csrfTokenFrom } from './session';

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

export interface StaffApiOptions {
  /** For tests; the browser's own by default. */
  fetch?: typeof fetch;
  /** `document.cookie` by default, read on every write. */
  cookies?: () => string;
}

/**
 * The typed API client for the staff pages in the browser. Calls go to this origin's `/api/v1`,
 * which the app rewrites to the API, with the session cookie, and every write echoes the CSRF
 * cookie (D32 double submit). Sign-in steps before a session exists send none, as the API expects.
 */
export function createStaffApi(origin: string, options: StaffApiOptions = {}): ApiClient {
  const cookies = options.cookies ?? (() => document.cookie);
  const client = createApiClient(origin, {
    credentials: 'same-origin',
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
  });
  client.use({
    onRequest({ request }) {
      if (SAFE_METHODS.has(request.method)) return undefined;
      const token = csrfTokenFrom(cookies());
      if (token !== null) request.headers.set(CSRF_HEADER, token);
      return request;
    },
  });
  return client;
}

let browserClient: ApiClient | undefined;

/** The page's one client, made on first use (client components only). */
export function staffApi(): ApiClient {
  browserClient ??= createStaffApi(window.location.origin);
  return browserClient;
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

/** As `unwrap`, for a route that answers 204 with no body. */
export async function unwrapEmpty(
  call: Promise<{ error?: unknown; response: Response }>,
): Promise<void> {
  const { error, response } = await call;
  if (!response.ok) throw apiErrorOf(error, response);
}
