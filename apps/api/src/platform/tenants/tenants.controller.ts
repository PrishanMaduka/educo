import { Controller, Get, Query } from '@nestjs/common';
import { PlatformTenantListQuery } from '@quad/contracts';

import { PlatformController } from '../../common/guards/platform-controller.decorator';
import { ZodValidationPipe } from '../../common/zod.pipe';
import { PlatformRole } from '../auth/platform-roles.decorator';

import { TenantsService } from './tenants.service';

import type { PlatformTenantList } from '@quad/contracts';

/** The console's school list (spec 06 → Platform `GET /platform/tenants`): any console role. */
@PlatformController()
@Controller('platform/tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get()
  @PlatformRole()
  list(
    @Query(new ZodValidationPipe(PlatformTenantListQuery)) query: PlatformTenantListQuery,
  ): Promise<PlatformTenantList> {
    return this.tenants.list(query);
  }
}
