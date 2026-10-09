import { Module } from '@nestjs/common';

import { PlatformCoreModule } from '../platform-core.module';

import { TenantsController } from './tenants.controller';
import { TenantsRepository } from './tenants.repository';
import { TenantsService } from './tenants.service';

/**
 * The console's schools (spec 07): the list in M1. `TenantsRepository` is exported for support
 * visits, which open only on a school that still exists.
 */
@Module({
  imports: [PlatformCoreModule],
  controllers: [TenantsController],
  providers: [TenantsService, TenantsRepository],
  exports: [TenantsRepository],
})
export class PlatformTenantsModule {}
