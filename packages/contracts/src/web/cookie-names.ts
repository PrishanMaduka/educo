/**
 * The bare names of Quad's cookies and browser storage keys (D57), without the descriptions.
 * Code that only needs a name imports this file (`@quad/contracts/cookie-names`), so the public
 * pages do not carry the Cookies page's text; `cookies.ts` builds the full registry from these.
 */

/** The prefix a cookie carries outside local: `Secure`, `Path=/`, no `Domain` (spec 05, D32). */
export const HOST_PREFIX = '__Host-';

/** The staff portal session (HttpOnly). */
export const SESSION_COOKIE = 'quad_sid';
/** The staff portal's readable double-submit CSRF value. */
export const CSRF_COOKIE = 'quad_csrf';
/** "Trust this device for 30 days" after two-step (spec 05). */
export const TRUSTED_DEVICE_COOKIE = 'quad_trusted';
/**
 * The remembered school on the sign-in page (spec 05): non-sensitive, readable by the page, and
 * the same name everywhere.
 */
export const LAST_SCHOOL_COOKIE = 'quad_last_school';
/** The console session (HttpOnly, `console.quad-edu.com`). */
export const CONSOLE_SESSION_COOKIE = 'quad_console_sid';
/** The console's own CSRF value: locally the staff portal shares the host `localhost`. */
export const CONSOLE_CSRF_COOKIE = 'quad_console_csrf';

/** Light or dark mode, shared by the public site and the apps. */
export const THEME_STORAGE_KEY = 'quad-theme';
/** The staff portal's folded side menu. */
export const RAIL_STORAGE_KEY = 'quad-rail';
/** The public site's school or parent view. */
export const VIEW_STORAGE_KEY = 'quad-site-view';
/** The cookie banner's remembered choice (Task 13). */
export const COOKIE_CONSENT_STORAGE_KEY = 'quad-cookie-consent';

/** Google Analytics' visitor cookie, set only after Accept (owner, OQ3). */
export const GA_COOKIE = '_ga';
/** Google Analytics' per-property session cookie, `_ga_<id>`, set only after Accept. */
export const GA_SESSION_COOKIE_PATTERN = /^_ga_[A-Z0-9]+$/;

/** Both names a `__Host-` cookie can have: the local one, then the prefixed one. */
export function hostPrefixedNames(name: string): readonly [string, string] {
  return [name, `${HOST_PREFIX}${name}`];
}
