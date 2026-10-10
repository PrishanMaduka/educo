import { createBrowserApi, type ApiClient } from '@quad/client';

import { CSRF_COOKIES } from './session';

/** The shared browser helpers (`@quad/client`, D50), as the staff pages import them. */
export { ApiError, unwrap, unwrapEmpty } from '@quad/client';

export interface StaffApiOptions {
  /** For tests; the browser's own by default. */
  fetch?: typeof fetch;
  /** `document.cookie` by default, read on every write. */
  cookies?: () => string;
}

/**
 * The typed API client for the staff pages in the browser. Calls go to this origin's `/api/v1`,
 * which the app rewrites to the API, with the session cookie, and every write echoes the staff
 * CSRF cookie (D32 double submit).
 */
export function createStaffApi(origin: string, options: StaffApiOptions = {}): ApiClient {
  return createBrowserApi(origin, { ...options, csrfCookies: CSRF_COOKIES });
}

let browserClient: ApiClient | undefined;

/** The page's one client, made on first use (client components only). */
export function staffApi(): ApiClient {
  browserClient ??= createStaffApi(window.location.origin);
  return browserClient;
}
