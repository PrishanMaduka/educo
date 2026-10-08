import { Module } from '@nestjs/common';

import { PlatformCoreModule } from './platform-core.module';

/**
 * Everything under `src/platform/**` (the console API), wired into `AppModule` through this one
 * module so that `AppModule` never imports the `quad_platform` handle itself. It exports nothing:
 * `PLATFORM_DB` stays inside the platform modules. Task 10 adds the console modules here.
 */
@Module({ imports: [PlatformCoreModule] })
export class PlatformModule {}
