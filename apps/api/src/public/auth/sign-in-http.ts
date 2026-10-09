import {
  clearLastSchoolCookie,
  clearSessionCookies,
  cookieNames,
  setLastSchoolCookie,
  setSessionCookies,
  setTrustedDeviceCookie,
} from '../../common/session/cookies';

import type { Config } from '../../config';
import type { SignInClient, SignInOutcome } from '../../modules/auth/sign-in.service';
import type { FastifyReply, FastifyRequest } from 'fastify';

type AppEnv = Config['APP_ENV'];

/** A user agent is stored on the session for "your devices"; anything longer is cut. */
const USER_AGENT_MAX = 512;

/**
 * The sign-in facts a request carries: its address, its user agent and the trusted-device
 * cookie. None of them ever names a school.
 */
export function signInClientOf(request: FastifyRequest, appEnv: AppEnv): SignInClient {
  return {
    ip: request.ip,
    userAgent: userAgentOf(request),
    trustedToken: request.cookies[cookieNames(appEnv).trustedDevice],
  };
}

/** The request's user agent as a session stores it (cut to a sane length), or null. */
export function userAgentOf(request: FastifyRequest): string | null {
  const userAgent = request.headers['user-agent'];
  return typeof userAgent === 'string' ? userAgent.slice(0, USER_AGENT_MAX) : null;
}

/** Sets (or clears) the cookies a sign-in step asks for. */
export function applySignInCookies(
  reply: FastifyReply,
  appEnv: AppEnv,
  outcome: Pick<SignInOutcome, 'session' | 'trustedDevice'>,
): void {
  if (outcome.session === 'clear') clearSessionCookies(reply, appEnv);
  else if (outcome.session !== undefined) setSessionCookies(reply, appEnv, outcome.session);
  if (outcome.trustedDevice !== undefined) {
    setTrustedDeviceCookie(reply, appEnv, outcome.trustedDevice);
  }
}

/** "Remember my choice on this device": the school's name (logos arrive in M4), or forget it. */
export function applyLastSchoolCookie(
  reply: FastifyReply,
  appEnv: AppEnv,
  schoolName: string | null,
): void {
  if (schoolName === null) clearLastSchoolCookie(reply, appEnv);
  else setLastSchoolCookie(reply, appEnv, { name: schoolName, logoUrl: null });
}

/**
 * The per-email rate-limit subject: the body's email, trimmed and lower-cased so two spellings
 * are one subject. `@RateLimit` stores only its HMAC (ruling F65). Undefined skips the rule, and
 * validation then answers 400.
 */
export function bodyEmail(request: FastifyRequest): string | undefined {
  const body: unknown = request.body;
  if (typeof body !== 'object' || body === null || !('email' in body)) return undefined;
  return typeof body.email === 'string' ? body.email.trim().toLowerCase() : undefined;
}
