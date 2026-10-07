import { Global, Inject, Module } from '@nestjs/common';
import { createTenantDb } from '@quad/db';

import { errorForLog } from '../observability/logger';
import { CONFIG, LOGGER, TENANT_DB } from '../tokens';

import type { Config } from '../config';
import type { OnApplicationShutdown } from '@nestjs/common';
import type { QuadTenantDb } from '@quad/db';
import type { Logger } from 'pino';

/**
 * The `quad_app` database handle for the whole API: `withTenant` and the named security-definer
 * calls (D16) on one pool. Connections open on first use; the pool ends on shutdown.
 */
@Global()
@Module({
  providers: [
    {
      provide: TENANT_DB,
      inject: [CONFIG, LOGGER],
      useFactory: (config: Config, logger: Logger): QuadTenantDb =>
        createTenantDb({
          appUrl: config.DATABASE_URL,
          poolMax: config.DATABASE_POOL_MAX,
          onPoolError: (error) => {
            logger.warn({ error: errorForLog(error) }, 'An idle Postgres connection failed');
          },
        }),
    },
  ],
  exports: [TENANT_DB],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(TENANT_DB) private readonly db: QuadTenantDb) {}

  async onApplicationShutdown(): Promise<void> {
    await this.db.close();
  }
}
