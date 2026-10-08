import fastifyCookie from '@fastify/cookie';
import { Inject, Injectable, Optional, createParamDecorator } from '@nestjs/common';

import { CONFIG, CONSOLE_SESSIONS } from '../../tokens';
import { UnauthorizedError } from '../errors';

import { cookieNames, hashSessionToken, isSessionTokenShape } from './cookies';
import { SessionService } from './session.service';

import type { CookieNames } from './cookies';
import type { Config } from '../../config';
import type { ExecutionContext } from '@nestjs/common';
import type { SessionStage } from '@quad/contracts';
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

/** Who is making a request. Task 9 adds the parent app's bearer token. */
export type RequestAuth = PersonAuth | SupportAuth;

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
    supportSessionId: auth.supportSessionId,
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

/** Who opened a socket: a school member, a support visit, a console user, or nobody. */
export type SocketIdentity =
  | { readonly kind: 'school'; readonly tenantId: string; readonly userId: string | null }
  | { readonly kind: 'platform'; readonly platformUserId: string }
  | null;

/**
 * Turns the cookie (or, from Task 9, a bearer token) into a `RequestAuth`, for HTTP requests and
 * for socket handshakes alike. Only a value shaped like a session token is looked up.
 */
@Injectable()
export class RequestAuthenticator {
  private readonly names: CookieNames;

  constructor(
    private readonly sessions: SessionService,
    @Inject(CONFIG) config: Config,
    @Optional() @Inject(CONSOLE_SESSIONS) private readonly console?: ConsoleSessionLookup,
  ) {
    this.names = cookieNames(config.APP_ENV);
  }

  /** The request's staff session, or null with no cookie or one that has ended. */
  fromRequest(request: FastifyRequest): Promise<RequestAuth | null> {
    return this.fromCookieToken(request.cookies[this.names.session]);
  }

  /** A socket handshake: the staff cookie, then the console cookie (Task 10 resolves it). */
  async fromHandshake(cookieHeader: string | undefined): Promise<SocketIdentity> {
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

  private async fromCookieToken(token: unknown): Promise<RequestAuth | null> {
    if (!isSessionTokenShape(token)) {
      return null;
    }
    return this.sessions.resolve(hashSessionToken(token));
  }
}
