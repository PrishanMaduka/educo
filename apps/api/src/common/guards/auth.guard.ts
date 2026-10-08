import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { trace } from '@opentelemetry/api';

import { tagSpanWithTenant } from '../../observability/tenant-span-processor';
import { CsrfError, UnauthorizedError } from '../errors';
import { currentRequestContext } from '../request-context';
import { CSRF_HEADER, CsrfTokens, needsCsrfToken } from '../session/csrf';
import { RequestAuthenticator, attachRequestAuth } from '../session/request-auth';

import { AuthenticatedMarker } from './authenticated.decorator';
import { PlatformControllerMarker } from './platform-controller.decorator';
import { PreAuthMarker } from './pre-auth.decorator';
import { PublicMarker } from './public.decorator';

import type { AuthenticatedOptions } from './authenticated.decorator';
import type { RequestAuth } from '../session/request-auth';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { SessionStage } from '@quad/contracts';
import type { FastifyRequest } from 'fastify';

/** What a route asks for, from its one access marker (none: an active session, like `@Can`). */
type Access =
  | { readonly kind: 'public' }
  | { readonly kind: 'pre_auth'; readonly stages: readonly SessionStage[] }
  | { readonly kind: 'active'; readonly alsoAtStages: readonly SessionStage[] };

/**
 * The global guard (spec 05, rulings F02, F09, F39): every route needs an active session unless
 * it is `@Public()`, `@PreAuth(...)` at a matching stage, or in a `@PlatformController()` class
 * (`PlatformSessionGuard` owns those). It then checks the double-submit CSRF token on
 * cookie-authenticated writes (before Task 12's preview guard, ruling F42), and fills the
 * request context and the active span from the session, never from request input.
 *
 * 401 means no session, or one that is revoked or expired, whose membership is deactivated or
 * whose school is deleted. A suspended school is not a 401: `TenantStatusGuard` (Task 12)
 * answers 403 `school_suspended`.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authenticator: RequestAuthenticator,
    private readonly csrf: CsrfTokens,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Deny by default: the API serves HTTP only (sockets authenticate in RealtimeService).
    if (context.getType() !== 'http') return false;
    const platform = this.reflector.getAllAndOverride<true | undefined>(
      PlatformControllerMarker.KEY,
      [context.getClass()],
    );
    if (platform !== undefined) return true;
    const access = this.accessOf(context);
    if (access.kind === 'public') return true;

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const auth = await this.authenticator.fromRequest(request);
    if (auth === null || !allows(access, auth)) {
      throw new UnauthorizedError();
    }
    if (
      needsCsrfToken(request.method) &&
      !this.csrf.verify(auth.tokenHash, request.headers[CSRF_HEADER])
    ) {
      throw new CsrfError();
    }
    attachRequestAuth(request, auth);
    fillRequestContext(auth);
    tagSpanWithTenant(trace.getActiveSpan(), auth.tenantId);
    return true;
  }

  private accessOf(context: ExecutionContext): Access {
    const targets = [context.getHandler(), context.getClass()];
    // Read by key: the decorator-typed overloads assume the marker is always there.
    const isPublic = this.reflector.getAllAndOverride<true | undefined>(PublicMarker.KEY, targets);
    const stages = this.reflector.getAllAndOverride<readonly SessionStage[] | undefined>(
      PreAuthMarker.KEY,
      targets,
    );
    const authenticated = this.reflector.getAllAndOverride<AuthenticatedOptions | undefined>(
      AuthenticatedMarker.KEY,
      targets,
    );
    const markers = [isPublic, stages, authenticated].filter((marker) => marker !== undefined);
    if (markers.length > 1) {
      // A programming error: Task 12's route walk refuses it before it ships.
      throw new Error('A route carries more than one access marker.');
    }
    if (isPublic !== undefined) return { kind: 'public' };
    if (stages !== undefined) return { kind: 'pre_auth', stages };
    return { kind: 'active', alsoAtStages: authenticated?.alsoAtStages ?? [] };
  }
}

/** Whether the session's sign-in stage fits the route. Support visits are always `active`. */
function allows(access: Exclude<Access, { kind: 'public' }>, auth: RequestAuth): boolean {
  if (access.kind === 'pre_auth') {
    return auth.kind === 'web' && access.stages.includes(auth.stage);
  }
  return (
    (auth.stage === 'active' && auth.tenantId !== null) || access.alsoAtStages.includes(auth.stage)
  );
}

function fillRequestContext(auth: RequestAuth): void {
  const context = currentRequestContext();
  if (context === undefined) return;
  context.tenantId = auth.tenantId;
  context.kind = auth.kind;
  context.supportSessionId = auth.supportSessionId;
  if (auth.kind === 'web') {
    context.accountId = auth.accountId;
    context.userId = auth.userId;
    context.previewRoleId = auth.previewRoleId;
  }
}
