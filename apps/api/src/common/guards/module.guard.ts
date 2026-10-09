import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PermissionsService } from '../access/permissions.service';
import { formatMessage } from '../delivery/templates/render';
import { ForbiddenError } from '../errors';
import { requestAuthOf } from '../session/request-auth';

import { PlanModuleMarker } from './module.decorator';

import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { PlanModule } from '@quad/contracts';
import type { FastifyRequest } from 'fastify';

/**
 * `@Module(m)` (spec 05, Plan and module guard): 403 `module_not_in_plan` when the school's plan
 * lacks `m`. It runs before `CanGuard`, so a module outside the plan says so rather than
 * `forbidden` (the permission keys of such a module are dropped anyway). A route without a school
 * (or a console route, which `AuthGuard` never authenticates) is refused: deny by default.
 */
@Injectable()
export class ModuleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const module = this.reflector.getAllAndOverride<PlanModule | undefined>(PlanModuleMarker.KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (module === undefined) return true;
    if (context.getType() !== 'http') return false;
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const auth = requestAuthOf(request);
    if (auth === undefined || auth.tenantId === null) throw new ForbiddenError();
    const access = await this.permissions.forRequest(request);
    if (!access.planModules.includes(module)) {
      throw new ForbiddenError('module_not_in_plan', formatMessage('error.moduleNotInPlan'));
    }
    return true;
  }
}
