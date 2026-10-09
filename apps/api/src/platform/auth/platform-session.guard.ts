import { Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { CsrfError, ForbiddenError, UnauthorizedError } from '../../common/errors';
import {
  PlatformControllerMarker,
  isPlatformPath,
} from '../../common/guards/platform-controller.decorator';
import { PreAuthMarker } from '../../common/guards/pre-auth.decorator';
import { PublicMarker } from '../../common/guards/public.decorator';
import { currentRequestContext } from '../../common/request-context';
import { cookieNames, hashSessionToken, isSessionTokenShape } from '../../common/session/cookies';
import { CSRF_HEADER, CsrfTokens, needsCsrfToken } from '../../common/session/csrf';
import { userAgentOf } from '../../public/auth/sign-in-http';
import { CONFIG } from '../../tokens';

import { attachConsoleAuth } from './console-auth';
import { ConsoleSessions } from './console-sessions.service';
import { DuringConsoleSignInMarker, PlatformRoleMarker } from './platform-roles.decorator';

import type { ConsoleAuth } from './console-auth';
import type { Config } from '../../config';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { PlatformRole, SessionStage } from '@quad/contracts';
import type { FastifyRequest } from 'fastify';

/** What a console route asks for, from its one access marker. */
type Access =
  | { readonly kind: 'public' }
  | { readonly kind: 'step'; readonly stages: readonly SessionStage[] }
  | {
      readonly kind: 'role';
      readonly roles: readonly PlatformRole[];
      readonly duringSignIn: boolean;
    };

/**
 * The console's global guard (spec 05 → Platform console and Platform roles; D28 ruling
 * R-console-realtime). It owns every `@PlatformController()` class, which `AuthGuard` skips, and
 * authenticates them with the console cookie only: a staff `quad_sid` or a parent bearer token
 * never counts here, and the console cookie never counts anywhere else (`AuthGuard` reads only
 * `quad_sid`). Each console route carries exactly one of `@Public()`, `@PreAuth(...)` (a sign-in
 * step) and `@PlatformRole(...)`; a route with none is refused with 403 for everyone (deny by
 * default). `@PlatformRole` needs an active session (or, with `@DuringConsoleSignIn()`, one at a
 * step) and one of its roles: 401 without, 403 for the wrong role. Cookie writes need the console
 * CSRF token. A console route is a `@PlatformController()` class or any path under
 * `/api/v1/platform/`. Elsewhere it only refuses a misplaced `@PlatformRole`, and outside HTTP it
 * refuses only console routes and markers.
 */
@Injectable()
export class PlatformSessionGuard implements CanActivate {
  private readonly cookieName: string;

  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: ConsoleSessions,
    private readonly csrf: CsrfTokens,
    @Inject(CONFIG) config: Config,
  ) {
    this.cookieName = cookieNames(config.APP_ENV).consoleSession;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const roles = this.reflector.getAllAndOverride<readonly PlatformRole[] | undefined>(
      PlatformRoleMarker.KEY,
      targets,
    );
    const markedConsole =
      this.reflector.getAllAndOverride<true | undefined>(PlatformControllerMarker.KEY, [
        context.getClass(),
      ]) === true;
    if (context.getType() !== 'http') {
      // Console routes are HTTP only; anything else is left to its own guards (AuthGuard refuses).
      const duringSignIn = this.reflector.getAllAndOverride<true | undefined>(
        DuringConsoleSignInMarker.KEY,
        targets,
      );
      return !markedConsole && roles === undefined && duringSignIn === undefined;
    }
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    // Console routes by class or by path: a path under /api/v1/platform/ is claimed even without
    // the class marker (consoleRouteProblems also refuses that at startup).
    const isConsole = markedConsole || isPlatformPath(request.routeOptions.url);
    if (!isConsole) {
      // A console role on a school route would otherwise let AuthGuard's staff session through.
      if (roles !== undefined) throw new ForbiddenError();
      return true;
    }
    const access = this.accessOf(context, roles);
    if (access === null) throw new ForbiddenError();
    if (access.kind === 'public') return true;

    const token = request.cookies[this.cookieName];
    const auth = isSessionTokenShape(token)
      ? await this.sessions.authenticate(hashSessionToken(token), {
          ip: request.ip,
          userAgent: userAgentOf(request),
        })
      : null;
    if (auth === null || !atAllowedStage(access, auth)) throw new UnauthorizedError();
    if (access.kind === 'role' && access.roles.length > 0 && !access.roles.includes(auth.role)) {
      throw new ForbiddenError();
    }
    if (
      needsCsrfToken(request.method) &&
      !this.csrf.verify(auth.tokenHash, request.headers[CSRF_HEADER])
    ) {
      throw new CsrfError();
    }
    attachConsoleAuth(request, auth);
    fillRequestContext(auth);
    return true;
  }

  /** The route's one access marker; null when it has none (deny by default). */
  private accessOf(
    context: ExecutionContext,
    roles: readonly PlatformRole[] | undefined,
  ): Access | null {
    const targets = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<true | undefined>(PublicMarker.KEY, targets);
    const stages = this.reflector.getAllAndOverride<readonly SessionStage[] | undefined>(
      PreAuthMarker.KEY,
      targets,
    );
    const markers = [isPublic, stages, roles].filter((marker) => marker !== undefined);
    if (markers.length > 1) {
      // A programming error: Task 12's route walk refuses it before it ships.
      throw new Error('A console route carries more than one access marker.');
    }
    if (isPublic !== undefined) return { kind: 'public' };
    if (stages !== undefined) return { kind: 'step', stages };
    if (roles === undefined) return null;
    const duringSignIn =
      this.reflector.getAllAndOverride<true | undefined>(DuringConsoleSignInMarker.KEY, targets) ===
      true;
    return { kind: 'role', roles, duringSignIn };
  }
}

/** A sign-in step reaches only its own routes; a role route needs an active session. */
function atAllowedStage(access: Exclude<Access, { kind: 'public' }>, auth: ConsoleAuth): boolean {
  if (access.kind === 'step') return access.stages.includes(auth.stage);
  return auth.stage === 'active' || access.duringSignIn;
}

function fillRequestContext(auth: ConsoleAuth): void {
  const context = currentRequestContext();
  if (context === undefined) return;
  context.kind = 'console';
  context.platformUserId = auth.platformUserId;
}
