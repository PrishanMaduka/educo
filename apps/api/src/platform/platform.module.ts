import { Module } from '@nestjs/common';

import { PlatformAuditModule } from './audit/platform-audit.module';
import { PlatformAuthModule } from './auth/platform-auth.module';
import { PlatformCoreModule } from './platform-core.module';
import { PlatformSupportModule } from './support/support.module';
import { PlatformTenantsModule } from './tenants/tenants.module';

/**
 * Everything under `src/platform/**` (the console API), wired into `AppModule` through this one
 * module so that `AppModule` never imports the `quad_platform` handle itself. It exports nothing:
 * `PLATFORM_DB` stays inside the platform modules. Console areas are added here (Task 10: sign-in; Task 15: the Audit log; Task 16: the school
 * list and support visits).
 */
@Module({
  imports: [
    PlatformCoreModule,
    PlatformAuthModule,
    PlatformAuditModule,
    PlatformTenantsModule,
    PlatformSupportModule,
  ],
})
export class PlatformModule {}
