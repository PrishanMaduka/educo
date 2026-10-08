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
  /** The readable double-submit CSRF value. */
  readonly csrf: string;
}

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
    csrf: `${prefix}quad_csrf`,
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
