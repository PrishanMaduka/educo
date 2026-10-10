import { createBrowserApi, type ApiClient } from '@quad/client';

import { CONSOLE_CSRF_COOKIES } from './session';

/** The shared browser helpers (`@quad/client`, D50), as the console pages import them. */
export { ApiError, unwrap, unwrapEmpty } from '@quad/client';

export interface ConsoleApiOptions {
  /** For tests; the browser's own by default. */
  fetch?: typeof fetch;
  /** `document.cookie` by default, read on every write. */
  cookies?: () => string;
}

/**
 * The typed API client for the console in the browser: calls go to this origin's
 * `/api/v1/platform/*`, which the app rewrites to the API, with the console cookie, and every
 * write echoes the console's CSRF cookie (D32).
 */
export function createConsoleApi(origin: string, options: ConsoleApiOptions = {}): ApiClient {
  return createBrowserApi(origin, { ...options, csrfCookies: CONSOLE_CSRF_COOKIES });
}

let browserClient: ApiClient | undefined;

/** The page's one client, made on first use (client components only). */
export function consoleApi(): ApiClient {
  browserClient ??= createConsoleApi(window.location.origin);
  return browserClient;
}
