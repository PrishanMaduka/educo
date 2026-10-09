import { Inject, Module } from '@nestjs/common';
import { createPlatformDb } from '@quad/db';

import { errorForLog } from '../observability/logger';
import { CONFIG, LOGGER } from '../tokens';

import { PlatformAuditService } from './audit/platform-audit.service';
import { PLATFORM_DB } from './tokens';

import type { Config } from '../config';
import type { OnApplicationShutdown } from '@nestjs/common';
import type { QuadPlatformDb } from '@quad/db';
import type { Logger } from 'pino';

/**
 * The `quad_platform` handle (`withPlatform`, D17) and `PlatformAuditService`, for the console
 * areas in `src/platform/**` only: not global, so only a module that imports this one can
 * inject `PLATFORM_DB` (and `withPlatform` itself is lint-restricted). The small pool opens on
 * first use.
 */
@Module({
  providers: [
    {
      provide: PLATFORM_DB,
      inject: [CONFIG, LOGGER],
      useFactory: (config: Config, logger: Logger): QuadPlatformDb =>
        createPlatformDb({
          platformUrl: config.DATABASE_PLATFORM_URL,
          poolMax: config.DATABASE_PLATFORM_POOL_MAX,
          onPoolError: (error) => {
            logger.warn(
              { error: errorForLog(error) },
              'An idle platform Postgres connection failed',
            );
          },
        }),
    },
    PlatformAuditService,
  ],
  exports: [PLATFORM_DB, PlatformAuditService],
})
export class PlatformCoreModule implements OnApplicationShutdown {
  constructor(@Inject(PLATFORM_DB) private readonly db: QuadPlatformDb) {}

  async onApplicationShutdown(): Promise<void> {
    await this.db.close();
  }
}
