import { Global, Inject, Module } from '@nestjs/common';
import { Redis } from 'ioredis';

import { errorForLog } from '../observability/logger';
import { CONFIG, LOGGER, REDIS } from '../tokens';

import type { Config } from '../config';
import type { OnApplicationShutdown } from '@nestjs/common';
import type { Logger } from 'pino';

/** How long a command waits for Redis (connecting included) before it fails. */
const TIMEOUT_MS = 2000;

/**
 * The API's one Redis connection, for rate limits, queuing jobs and (from Task 6) the session
 * cache. It connects on first use, so the API starts, and routes that need no Redis answer,
 * while Redis is down. A command fails after one reconnect attempt or `TIMEOUT_MS` instead of
 * waiting in the offline queue, so callers can fail open or answer 500 at once.
 */
export function createApiRedis(url: string, logger: Logger): Redis {
  const redis = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: TIMEOUT_MS,
    commandTimeout: TIMEOUT_MS,
  });
  redis.on('error', (error) => {
    logger.warn({ error: errorForLog(error) }, 'Redis connection error');
  });
  return redis;
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [CONFIG, LOGGER],
      useFactory: (config: Config, logger: Logger): Redis =>
        createApiRedis(config.REDIS_URL, logger),
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  /** After `beforeApplicationShutdown`, where queues sharing this connection close. */
  async onApplicationShutdown(): Promise<void> {
    if (this.redis.status === 'ready') {
      await this.redis.quit();
    } else {
      this.redis.disconnect();
    }
  }
}
