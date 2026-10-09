import { createHash, randomBytes } from 'node:crypto';

import type { Config } from '../../config';
import type { CookieSerializeOptions } from '@fastify/cookie';
import type { FastifyReply } from 'fastify';

type AppEnv = Config['APP_ENV'];

/** Spec 05: the cookie holds 32 random bytes; the database keeps only their SHA-256. */
export const SESSION_TOKEN_BYTES = 32;
/** 32 bytes in base64url without padding. */
const SESSION_TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

export interface CookieNames {
  /** The staff portal session (`quad-edu.com`). */
  readonly session: string;
  /** The console session (`console.quad-edu.com`, Task 10). */
  readonly consoleSession: string;
  /**
   * The console's readable double-submit CSRF value. Its own name: locally the staff portal and
   * the console share the host `localhost` (cookies ignore the port), so one name would let each
   * app overwrite the other's.
   */
  readonly consoleCsrf: string;
  /** The readable double-submit CSRF value. */
  readonly csrf: string;
  /** "Trust this device for 30 days" after two-step (spec 05). */
  readonly trustedDevice: string;
}

/**
 * The remembered school on the sign-in page (spec 05): non-sensitive (its name and logo URL, no
 * id), readable by the page, and the same name everywhere.
 */
export const LAST_SCHOOL_COOKIE = 'quad_last_school';
/** How long the remembered school stays: a school year. */
const LAST_SCHOOL_SECONDS = 365 * 24 * 60 * 60;

/**
 * The cookie names (spec 05, D32). Outside local they carry the `__Host-` prefix, which the
 * browser accepts only with `Secure`, `Path=/` and no `Domain`, so no subdomain can set or shadow
 * them. Locally the API runs on plain http, so they drop the prefix and `Secure`.
 */
export function cookieNames(appEnv: AppEnv): CookieNames {
  const prefix = appEnv === 'local' ? '' : '__Host-';
  return {
    session: `${prefix}quad_sid`,
    consoleSession: `${prefix}quad_console_sid`,
    consoleCsrf: `${prefix}quad_console_csrf`,
    csrf: `${prefix}quad_csrf`,
    trustedDevice: `${prefix}quad_trusted`,
  };
}

/** A new opaque session token for a cookie. */
export function newSessionToken(): string {
  return randomBytes(SESSION_TOKEN_BYTES).toString('base64url');
}

/** True for a value shaped like `newSessionToken()`; anything else is never looked up. */
export function isSessionTokenShape(value: unknown): value is string {
  return typeof value === 'string' && SESSION_TOKEN_SHAPE.test(value);
}

/** What `sessions.token_hash` and `support_sessions.token_hash` store for a token. */
export function hashSessionToken(token: string): Buffer {
  return createHash('sha256').update(token).digest();
}

/** HttpOnly session cookie: `Secure` and `SameSite=Lax` (spec 05), `Secure` dropped locally. */
export function sessionCookieOptions(
  appEnv: AppEnv,
  maxAgeSeconds?: number,
): CookieSerializeOptions {
  return {
    httpOnly: true,
    secure: appEnv !== 'local',
    sameSite: 'lax',
    path: '/',
    ...(maxAgeSeconds === undefined ? {} : { maxAge: maxAgeSeconds }),
  };
}

/** The CSRF cookie: like the session cookie but readable by the page, which echoes it. */
export function csrfCookieOptions(appEnv: AppEnv, maxAgeSeconds?: number): CookieSerializeOptions {
  return { ...sessionCookieOptions(appEnv, maxAgeSeconds), httpOnly: false };
}

/**
 * Sets the staff session cookie and its CSRF cookie together (sign-in, Task 7). Without
 * `maxAgeSeconds` both end with the browser session.
 */
export function setSessionCookies(
  reply: FastifyReply,
  appEnv: AppEnv,
  cookies: { readonly token: string; readonly csrf: string; readonly maxAgeSeconds?: number },
): void {
  const names = cookieNames(appEnv);
  void reply.setCookie(
    names.session,
    cookies.token,
    sessionCookieOptions(appEnv, cookies.maxAgeSeconds),
  );
  void reply.setCookie(names.csrf, cookies.csrf, csrfCookieOptions(appEnv, cookies.maxAgeSeconds));
}

/** Clears both staff cookies (sign-out, or the current device signed out from `/me/sessions`). */
export function clearSessionCookies(reply: FastifyReply, appEnv: AppEnv): void {
  const names = cookieNames(appEnv);
  void reply.clearCookie(names.session, sessionCookieOptions(appEnv));
  void reply.clearCookie(names.csrf, csrfCookieOptions(appEnv));
}

/**
 * Sets the console session cookie and its CSRF cookie together (console sign-in, Task 10). Both
 * end with the browser session; the server ends the session after 8 hours idle (spec 05).
 */
export function setConsoleSessionCookies(
  reply: FastifyReply,
  appEnv: AppEnv,
  cookies: { readonly token: string; readonly csrf: string },
): void {
  const names = cookieNames(appEnv);
  void reply.setCookie(names.consoleSession, cookies.token, sessionCookieOptions(appEnv));
  void reply.setCookie(names.consoleCsrf, cookies.csrf, csrfCookieOptions(appEnv));
}

/** Clears both console cookies (console sign-out). */
export function clearConsoleSessionCookies(reply: FastifyReply, appEnv: AppEnv): void {
  const names = cookieNames(appEnv);
  void reply.clearCookie(names.consoleSession, sessionCookieOptions(appEnv));
  void reply.clearCookie(names.consoleCsrf, csrfCookieOptions(appEnv));
}

/** Sets the HttpOnly trusted-device cookie (`trusted_devices` keeps only its SHA-256). */
export function setTrustedDeviceCookie(
  reply: FastifyReply,
  appEnv: AppEnv,
  cookie: { readonly token: string; readonly maxAgeSeconds: number },
): void {
  void reply.setCookie(
    cookieNames(appEnv).trustedDevice,
    cookie.token,
    sessionCookieOptions(appEnv, cookie.maxAgeSeconds),
  );
}

/** Remembers the chosen school on this device for the sign-in page's "Welcome back". */
export function setLastSchoolCookie(
  reply: FastifyReply,
  appEnv: AppEnv,
  school: { readonly name: string; readonly logoUrl: string | null },
): void {
  void reply.setCookie(
    LAST_SCHOOL_COOKIE,
    encodeURIComponent(JSON.stringify({ name: school.name, logoUrl: school.logoUrl })),
    csrfCookieOptions(appEnv, LAST_SCHOOL_SECONDS),
  );
}

/** Forgets the remembered school ("Remember my choice" left off). */
export function clearLastSchoolCookie(reply: FastifyReply, appEnv: AppEnv): void {
  void reply.clearCookie(LAST_SCHOOL_COOKIE, csrfCookieOptions(appEnv));
}
