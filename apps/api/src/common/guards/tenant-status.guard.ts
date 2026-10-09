import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PermissionsService } from '../access/permissions.service';
import { formatMessage } from '../delivery/templates/render';
import { ForbiddenError } from '../errors';
import { requestAuthOf } from '../session/request-auth';

import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

/** Read by `TenantStatusGuard` (and the route walk). */
export const AllowWhileSuspendedMarker = Reflector.createDecorator<true>();

/**
 * The route still answers in a suspended school. Only `POST /auth/sign-out` carries it (spec 05:
 * a person can always leave); the route walk refuses it anywhere else.
 */
export const AllowWhileSuspended = (): MethodDecorator => AllowWhileSuspendedMarker(true);

/**
 * A suspended school (spec 05, Plan and module guard): every staff and parent request in it, by
 * cookie, support visit or token, answers 403 `school_suspended` with the console's suspend
 * reason as the message (or the default copy), except `@AllowWhileSuspended()` routes. It runs
 * after `AuthGuard`, which still resolves a suspended school's sessions, and only for a request
 * in a school: sign-in steps have none (select-school refuses a suspended school itself), and
 * public, webhook and console routes are never in one.
 */
@Injectable()
export class TenantStatusGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const auth = requestAuthOf(request);
    if (auth === undefined || auth.tenantId === null) return true;
    const allowed = this.reflector.getAllAndOverride<true | undefined>(
      AllowWhileSuspendedMarker.KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowed === true) return true;
    const access = await this.permissions.forRequest(request);
    if (access.status === 'suspended') {
      throw new ForbiddenError(
        'school_suspended',
        access.suspendReason ?? formatMessage('error.schoolSuspended'),
      );
    }
    return true;
  }
}
