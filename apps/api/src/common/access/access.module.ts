import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { CanGuard } from '../guards/can.guard';
import { ModuleGuard } from '../guards/module.guard';
import { PreviewReadOnlyGuard } from '../guards/preview-read-only.guard';
import { TenantStatusGuard } from '../guards/tenant-status.guard';

import { PermissionsRepository } from './permissions.repository';
import { PermissionsService } from './permissions.service';

/**
 * Permissions (spec 05; Task 12): `PermissionsService` and the global guards that run after
 * `AuthGuard` (whose `SessionModule` is imported first), in this order:
 * 1. `TenantStatusGuard`: a suspended school is 403 `school_suspended`;
 * 2. `PreviewReadOnlyGuard`: a write while previewing is 403 `preview_read_only` (after the CSRF
 *    check in `AuthGuard`);
 * 3. `ModuleGuard`: `@Module` outside the plan is 403 `module_not_in_plan`;
 * 4. `CanGuard`: `@Can` and `@Sensitive` are 403 `forbidden` without the keys.
 * Nest runs global guards in the order their providers are registered.
 */
@Global()
@Module({
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
export class AccessModule {}
