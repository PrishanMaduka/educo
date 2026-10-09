import { Module } from '@nestjs/common';

import { PlatformAuthModule } from './auth/platform-auth.module';
import { PlatformCoreModule } from './platform-core.module';

/**
 * Everything under `src/platform/**` (the console API), wired into `AppModule` through this one
 * module so that `AppModule` never imports the `quad_platform` handle itself. It exports nothing:
 * `PLATFORM_DB` stays inside the platform modules. Console areas are added here (Task 10: sign-in).
 */
@Module({ imports: [PlatformCoreModule, PlatformAuthModule] })
export class PlatformModule {}
