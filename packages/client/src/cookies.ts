/**
 * Reading a cookie by name, with no dependencies (`@quad/client/cookies`), so a page that only
 * needs a cookie does not load the API client: the public landing page checks for the session's
 * CSRF cookie before it asks `GET /me` (D57).
 */

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
