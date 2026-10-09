import fastifyCookie from '@fastify/cookie';
import { Inject, Injectable, Optional, createParamDecorator } from '@nestjs/common';

import { CONFIG, CONSOLE_SESSIONS } from '../../tokens';
import { AccessTokens } from '../crypto/access-tokens';
import { UnauthorizedError } from '../errors';

import { bearerTokenOf } from './bearer';
import { BearerSessions } from './bearer-sessions';
import { cookieNames, hashSessionToken, isSessionTokenShape } from './cookies';
import { SessionService } from './session.service';

import type { CookieNames } from './cookies';
import type { Config } from '../../config';
import type { ExecutionContext } from '@nestjs/common';
import type { ParentMembershipKind, SessionStage } from '@quad/contracts';
import type { FastifyRequest } from 'fastify';

/**
 * A person's session, from the staff cookie (spec 05). `tenantId` and `userId` are set only once
 * the session is `active` in a school; the earlier sign-in stages have neither.
 */
export interface PersonAuth {
  readonly kind: 'web';
  readonly via: 'cookie';
  readonly sessionId: string;
  readonly accountId: string;
  readonly stage: SessionStage;
  readonly tenantId: string | null;
  /** The membership (`users.id`) in that school. */
  readonly userId: string | null;
  readonly previewRoleId: string | null;
  readonly previewSampleUserId: string | null;
  /**
   * A `sessions` row tied to a support visit (`session_by_token` returns it while the visit is
   * active). The person is still the actor: audits count a visit only with a platform user.
   */
  readonly supportSessionId: string | null;
  /** SHA-256 of the cookie: the CSRF token and the cache are keyed on it. */
  readonly tokenHash: Buffer;
}

/**
 * A Quad support visit (ruling R-support-token): no account and no membership, valid while its
 * `support_sessions` row is active and for this school (spec 05, ruling F09).
 */
export interface SupportAuth {
  readonly kind: 'support';
  readonly via: 'cookie';
  readonly stage: 'active';
  readonly supportSessionId: string;
  readonly platformUserId: string;
  readonly tenantId: string;
  readonly tokenHash: Buffer;
}

/**
 * The parent app's access token (spec 05 Parent app step 5; D32): a refresh family (a mobile
 * `sessions` row) of the account, in a school with a guardian or relative membership there, or
 * still choosing one (the `select_school` token, OQ20). Never a staff membership (the kind rule).
 */
export interface BearerAuth {
  readonly kind: 'mobile';
  readonly via: 'bearer';
  /** The refresh family. */
  readonly sessionId: string;
  readonly accountId: string;
  readonly stage: Extract<SessionStage, 'choose_school' | 'active'>;
  readonly tenantId: string | null;
  /** The membership (`users.id`) in that school. */
  readonly userId: string | null;
  /** Guardian or relative in that school; null while choosing one. */
  readonly membershipKind: ParentMembershipKind | null;
  /** The token's own `exp` (Unix seconds): a switch never gives a later one (fix round 2). */
  readonly expiresAt: number;
}

/** Who is making a request: the staff cookie, a support visit, or the parent app's token. */
export type RequestAuth = PersonAuth | SupportAuth | BearerAuth;

/** A signed-in person (not a support visit), by cookie or by token. */
export type AccountAuth = PersonAuth | BearerAuth;

/** A request that is in a school: what tenant-scoped services and audits need. */
export interface SchoolAuth {
  readonly tenantId: string;
  readonly userId: string | null;
  readonly accountId: string | null;
  readonly supportSessionId: string | null;
  readonly platformUserId: string | null;
}

/** The school a request is in, or 401 when its session has not chosen one. */
export function schoolOf(auth: RequestAuth): SchoolAuth {
  if (auth.kind === 'support') {
    return {
      tenantId: auth.tenantId,
      userId: null,
      accountId: null,
      supportSessionId: auth.supportSessionId,
      platformUserId: auth.platformUserId,
    };
  }
  if (auth.tenantId === null) {
    throw new UnauthorizedError();
  }
  return {
    tenantId: auth.tenantId,
    userId: auth.userId,
    accountId: auth.accountId,
    supportSessionId: auth.kind === 'web' ? auth.supportSessionId : null,
    platformUserId: null,
  };
}

/** Set by `AuthGuard` once per request; a WeakMap keeps the read typed. */
const AUTH_BY_REQUEST = new WeakMap<FastifyRequest, RequestAuth>();

export function attachRequestAuth(request: FastifyRequest, auth: RequestAuth): void {
  AUTH_BY_REQUEST.set(request, auth);
}

export function requestAuthOf(request: FastifyRequest): RequestAuth | undefined {
  return AUTH_BY_REQUEST.get(request);
}

/**
 * The route's `RequestAuth`: `@Auth() auth: RequestAuth`. Only on routes the guard
 * authenticated (`@Authenticated`, `@PreAuth`, `@Can`); elsewhere it answers 401.
 */
export const Auth = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const auth = requestAuthOf(context.switchToHttp().getRequest<FastifyRequest>());
  if (auth === undefined) {
    throw new UnauthorizedError();
  }
  return auth;
});

/**
 * Resolves a console session cookie's hash to its platform user (Task 10 provides it; console
 * sessions are reached only through `withPlatform`, so the lookup lives in `src/platform`).
 */
export interface ConsoleSessionLookup {
  resolve(tokenHash: Buffer): Promise<{ readonly platformUserId: string } | null>;
}

/**
 * Who opened a socket: a school member, a support visit, a console user, a parent (a guardian's
 * token, Task 9), or nobody.
 */
export type SocketIdentity =
  | { readonly kind: 'school'; readonly tenantId: string; readonly userId: string | null }
  | { readonly kind: 'parent'; readonly userId: string }
  | { readonly kind: 'platform'; readonly platformUserId: string }
  | null;

/**
 * Turns the cookie or the parent app's bearer token into a `RequestAuth`, for HTTP requests and
 * for socket handshakes alike. Only a value shaped like a session token, or a bearer token that
 * `AccessTokens` verifies, is looked up.
 */
@Injectable()
export class RequestAuthenticator {
  private readonly names: CookieNames;

  constructor(
    private readonly sessions: SessionService,
    private readonly bearer: BearerSessions,
    private readonly accessTokens: AccessTokens,
    @Inject(CONFIG) config: Config,
    @Optional() @Inject(CONSOLE_SESSIONS) private readonly console?: ConsoleSessionLookup,
  ) {
    this.names = cookieNames(config.APP_ENV);
  }

  /**
   * The request's bearer token when it has an Authorization header (never then the cookie),
   * otherwise its staff session; null when there is none or it has ended.
   */
  fromRequest(request: FastifyRequest): Promise<RequestAuth | null> {
    const token = bearerTokenOf(request.headers.authorization);
    if (token === undefined) return this.fromCookieToken(request.cookies[this.names.session]);
    return token === null ? Promise.resolve(null) : this.fromBearerToken(token);
  }

  /**
   * A socket handshake: the parent app's access token (`auth.token`) when it sends one, else the
   * staff cookie, then the console cookie (Task 10 resolves it). A token counts only for a
   * guardian in a school: a relative (M9b adds their rooms) or a family still choosing gets none.
   */
  async fromHandshake(cookieHeader: string | undefined, token?: unknown): Promise<SocketIdentity> {
    if (token !== undefined) {
      const auth = typeof token === 'string' ? await this.fromBearerToken(token) : null;
      return auth?.membershipKind === 'guardian' && auth.userId !== null
        ? { kind: 'parent', userId: auth.userId }
        : null;
    }
    const cookies = cookieHeader === undefined ? {} : fastifyCookie.parse(cookieHeader);
    const auth = await this.fromCookieToken(cookies[this.names.session]);
    if (auth !== null) {
      return auth.stage === 'active' && auth.tenantId !== null
        ? {
            kind: 'school',
            tenantId: auth.tenantId,
            userId: auth.kind === 'web' ? auth.userId : null,
          }
        : null;
    }
    const consoleToken = cookies[this.names.consoleSession];
    if (this.console === undefined || !isSessionTokenShape(consoleToken)) {
      return null;
    }
    const consoleSession = await this.console.resolve(hashSessionToken(consoleToken));
    return consoleSession === null
      ? null
      : { kind: 'platform', platformUserId: consoleSession.platformUserId };
  }

  private async fromBearerToken(token: string): Promise<BearerAuth | null> {
    const claims = await this.accessTokens.verify(token);
    return claims === null ? null : this.bearer.resolveBearer(claims);
  }

  private async fromCookieToken(token: unknown): Promise<RequestAuth | null> {
    if (!isSessionTokenShape(token)) {
      return null;
    }
    return this.sessions.resolve(hashSessionToken(token));
  }
}
