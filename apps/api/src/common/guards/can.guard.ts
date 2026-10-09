import { Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { sensitivePermissionKey } from '@quad/contracts';
import { HIDDEN_FROM_SUPPORT } from '@quad/domain';

import { TENANT_DB } from '../../tokens';
import { PermissionsService } from '../access/permissions.service';
import { AuditService, auditActorOf } from '../audit/audit.service';
import { ForbiddenError } from '../errors';
import { requestAuthOf, schoolOf } from '../session/request-auth';

import { CanMarker } from './can.decorator';
import { SensitiveMarker } from './sensitive.decorator';

import type { RequestAccess } from '../access/permissions.service';
import type { RequestAuth } from '../session/request-auth';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { PermissionKey, SensitiveKey } from '@quad/contracts';
import type { QuadTenantDb } from '@quad/db';
import type { FastifyRequest } from 'fastify';

/**
 * `@Can(...keys)` and `@Sensitive(key)` (spec 05, Permission matrix and sensitive keys): the
 * request's effective permissions (`PermissionsService`, a preview's while one is on) must hold
 * any one of the `@Can` keys, and for `@Sensitive` also `sensitive.<key>`; a Quad support visit
 * is always refused `safeguarding` and `medical`, whatever it holds. 403 `forbidden` otherwise.
 * Each request `@Sensitive` lets through writes `sensitive.accessed` to the school's audit log
 * (with the dual platform audit in a support visit) before the route runs. A marked route the
 * guard cannot place in a school (a console route, or no session) is refused: deny by default.
 */
@Injectable()
export class CanGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
    private readonly audit: AuditService,
    @Inject(TENANT_DB) private readonly db: QuadTenantDb,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const keys = this.reflector.getAllAndOverride<readonly PermissionKey[] | undefined>(
      CanMarker.KEY,
      targets,
    );
    const sensitive = this.reflector.getAllAndOverride<SensitiveKey | undefined>(
      SensitiveMarker.KEY,
      targets,
    );
    if (keys === undefined && sensitive === undefined) return true;
    if (context.getType() !== 'http') return false;
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const auth = requestAuthOf(request);
    if (auth === undefined || auth.tenantId === null) throw new ForbiddenError();
    const access = await this.permissions.forRequest(request);
    if (keys !== undefined && !keys.some((key) => access.permissions.has(key))) {
      throw new ForbiddenError();
    }
    if (sensitive !== undefined) {
      if (!allowsSensitive(access, sensitive)) throw new ForbiddenError();
      await this.recordAccess(auth, request, sensitive);
    }
    return true;
  }

  private async recordAccess(
    auth: RequestAuth,
    request: FastifyRequest,
    key: SensitiveKey,
  ): Promise<void> {
    const actor = auditActorOf(schoolOf(auth), request.ip);
    await this.db.withTenant(actor.tenantId, (tx) =>
      this.audit.record({ tx, ...actor }, 'sensitive.accessed', null, {
        key,
        method: request.method,
        // The route template, never the URL: ids and query values stay out of the log.
        route: request.routeOptions.url ?? null,
      }),
    );
  }
}

function allowsSensitive(access: RequestAccess, key: SensitiveKey): boolean {
  if (access.support && HIDDEN_FROM_SUPPORT.includes(key)) return false;
  return access.permissions.has(sensitivePermissionKey(key));
}
