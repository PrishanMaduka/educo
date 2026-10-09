import { Module } from '@nestjs/common';

import { PlatformCoreModule } from '../platform-core.module';
import { PlatformTenantsModule } from '../tenants/tenants.module';

import { SupportController } from './support.controller';
import { SupportRepository } from './support.repository';
import { SupportService } from './support.service';

/** Support visits, the console half (spec 05 → Support access): opening one. */
@Module({
  imports: [PlatformCoreModule, PlatformTenantsModule],
  controllers: [SupportController],
  providers: [SupportService, SupportRepository],
})
export class PlatformSupportModule {}
