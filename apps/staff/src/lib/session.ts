/**
 * What the staff app knows about the staff session without asking the API (spec 05; D32). The
 * cookies are the API's: `quad_sid` and `quad_csrf` locally, with the `__Host-` prefix elsewhere.
 * Their presence is only a hint for routing; the API checks every request.
 */

const SESSION_COOKIES = ['quad_sid', '__Host-quad_sid'] as const;
const CSRF_COOKIES = ['quad_csrf', '__Host-quad_csrf'] as const;

/** The longest school name the sign-in page repeats from the remembered-school cookie. */
const LAST_SCHOOL_MAX = 120;

/** True when the request carries a staff session cookie (`get` reads one cookie's value). */
export function hasSessionCookie(get: (name: string) => string | undefined): boolean {
  return SESSION_COOKIES.some((name) => (get(name) ?? '') !== '');
}

/** The double-submit CSRF value from `document.cookie`, which every cookie write echoes. */
export function csrfTokenFrom(cookieHeader: string): string | null {
  for (const part of cookieHeader.split(';')) {
    const at = part.indexOf('=');
    const name = part.slice(0, at).trim();
    if ((CSRF_COOKIES as readonly string[]).includes(name)) return part.slice(at + 1).trim();
  }
  return null;
}

/**
 * The school name in `quad_last_school` (URL-encoded JSON `{name, logoUrl}`, set by the API on
 * "Remember my choice"), for "Welcome back to {school}". Only shown: it never picks a school.
 */
export function lastSchoolFrom(value: string | undefined): string | null {
  if (value === undefined || value === '') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeURIComponent(value));
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || !('name' in parsed)) return null;
  const { name } = parsed;
  if (typeof name !== 'string' || name.trim() === '') return null;
  return name.trim().slice(0, LAST_SCHOOL_MAX);
}

/**
 * Where to go after signing in: `?next=` only when it is a path inside the portal (`/app` or
 * below), so a link can never send someone to another site or back round to sign-in.
 */
export function safeNext(raw: unknown): string {
  if (typeof raw !== 'string') return '/app';
  if (!/^\/app(?:[/?#]|$)/.test(raw)) return '/app';
  if (raw.includes('\\') || /(?:^|\/)\.\.?(?:[/?#]|$)/.test(raw)) return '/app';
  return raw;
}

/** `/sign-in?next=<the page asked for>`, for a signed-out visit to the portal. */
export function signInPathFor(pathname: string, search: string): string {
  return `/sign-in?${new URLSearchParams({ next: `${pathname}${search}` }).toString()}`;
}

/**
 * The request header the middleware sets on every portal request to the page asked for (path and
 * query), so the portal layout can send a signed-out visitor back there after sign-in. The
 * middleware always overwrites it, so a browser cannot choose it.
 */
export const PORTAL_PATH_HEADER = 'x-quad-path';

/**
 * Where the portal layout sends a visit whose session the API no longer accepts: sign-in, then
 * back to the page asked for (`PORTAL_PATH_HEADER`), if it is a portal page.
 */
export function signInAgainPath(requested: string | null): string {
  return `/sign-in?${new URLSearchParams({ next: safeNext(requested) }).toString()}`;
}

/** A fixed notice the sign-in page can show above the email step (`?notice=`). */
export type SignInNotice = 'two_step';

/**
 * The sign-in page's `?notice=`: only a known value, so the page shows one of its own fixed
 * sentences and never text from the query. Switch school sends `two_step` when the chosen
 * school needs two-step set up first.
 */
export function signInNoticeFrom(raw: unknown): SignInNotice | null {
  return raw === 'two_step' ? 'two_step' : null;
}
