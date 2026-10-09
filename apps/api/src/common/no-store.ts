import { API_PREFIX_PATTERN } from './api-prefix';

/**
 * Routes whose answers may carry a sign-in step, a TOTP secret or recovery codes: `/auth/*`,
 * `/platform/auth/*` and `/me/totp` (and anything under it). `createApp` sends them with
 * `Cache-Control: no-store` (Task 10 fix round 1, M3).
 */
const NO_STORE_ROUTE = new RegExp(`^${API_PREFIX_PATTERN}/(?:auth/|platform/auth/|me/totp(?:/|$))`);

export function isNoStoreRoute(url: string | undefined): boolean {
  return url !== undefined && NO_STORE_ROUTE.test(url);
}
