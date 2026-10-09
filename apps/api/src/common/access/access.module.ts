import { Global, Module } from '@nestjs/common';
import { APP_GUARD, DiscoveryModule, DiscoveryService } from '@nestjs/core';

import { CanGuard } from '../guards/can.guard';
import { ModuleGuard } from '../guards/module.guard';
import { PreviewReadOnlyGuard } from '../guards/preview-read-only.guard';
import { routeProblems, walkRoutes } from '../guards/route-markers';
import { TenantStatusGuard } from '../guards/tenant-status.guard';

import { PermissionsRepository } from './permissions.repository';
import { PermissionsService } from './permissions.service';

import type { OnModuleInit, Type } from '@nestjs/common';

/**
 * Permissions (spec 05; Task 12): `PermissionsService` and the global guards that run after
 * `AuthGuard` (whose `SessionModule` is imported first), in this order:
 * 1. `TenantStatusGuard`: a suspended school is 403 `school_suspended`;
 * 2. `PreviewReadOnlyGuard`: a write while previewing is 403 `preview_read_only` (after the CSRF
 *    check in `AuthGuard`);
 * 3. `ModuleGuard`: `@Module` outside the plan is 403 `module_not_in_plan`;
 * 4. `CanGuard`: `@Can` and `@Sensitive` are 403 `forbidden` without the keys.
 * Nest runs global guards in the order their providers are registered.
 *
 * It also refuses to start when a route has no access marker, more than one, or a marker in the
 * wrong place (`routeProblems`, fix round 1 M1), so the guards' defaults are never relied on.
 */
@Global()
@Module({
  imports: [DiscoveryModule],
  providers: [
    PermissionsRepository,
    PermissionsService,
    { provide: APP_GUARD, useClass: TenantStatusGuard },
    { provide: APP_GUARD, useClass: PreviewReadOnlyGuard },
    { provide: APP_GUARD, useClass: ModuleGuard },
    { provide: APP_GUARD, useClass: CanGuard },
  ],
  exports: [PermissionsService],
})
export class AccessModule implements OnModuleInit {
  constructor(private readonly discovery: DiscoveryService) {}

  onModuleInit(): void {
    const controllers = this.discovery
      .getControllers()
      .map((wrapper) => wrapper.metatype)
      .filter((metatype): metatype is Type => typeof metatype === 'function');
    const problems = routeProblems(walkRoutes(controllers));
    if (problems.length > 0) {
      throw new Error(`Routes are missing or misusing access markers: ${problems.join('; ')}`);
    }
  }
}
