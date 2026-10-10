import { safeReturnPath } from '@quad/client';
import { CONSOLE_CSRF_COOKIE, hostPrefixedNames } from '@quad/contracts/cookie-names';

/**
 * What the console knows about its session without asking the API (spec 05; D32). The console's
 * cookies are the API's own (`quad_console_sid`, `quad_console_csrf`, with `__Host-` outside
 * local), `SameSite=Strict`, so a page never decides on them: the signed-in pages ask
 * `GET /platform/me` in the browser (D50).
 */

/**
 * The console's double-submit CSRF cookie: locally the staff portal shares the host. Named in the
 * cookie registry (D57).
 */
export const CONSOLE_CSRF_COOKIES: readonly string[] = hostPrefixedNames(CONSOLE_CSRF_COOKIE);

const SIGN_IN = /^\/sign-in(?:[/?#]|$)/;

/**
 * Where to go after signing in: `?next=` only when it is a path on this site (`safeReturnPath`:
 * no control character, backslash or dot segment, and the same origin once parsed), and never
 * sign-in itself; the overview otherwise.
 */
export function safeNext(raw: unknown): string {
  return safeReturnPath(raw, { allow: (path) => !SIGN_IN.test(path), fallback: '/' });
}

/** `/sign-in?next=<the page asked for>`, for a visit the API no longer accepts. */
export function signInPathFor(pathname: string, search: string): string {
  return `/sign-in?${new URLSearchParams({ next: `${pathname}${search}` }).toString()}`;
}
