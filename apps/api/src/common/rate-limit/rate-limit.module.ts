import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { CONFIG, REDIS } from '../../tokens';

import { RateLimitInterceptor } from './rate-limit.interceptor';
import { RateLimitService } from './rate-limit.service';

import type { Config } from '../../config';
import type { Redis } from 'ioredis';

/**
 * Redis rate limits (spec 06): `RateLimitService` for counting in services (Task 7's per-email
 * limits use the decorator instead), and the global interceptor that applies the limits to
 * every route. Needs the global `RedisModule`.
 */
@Global()
@Module({
  providers: [
    {
      provide: RateLimitService,
      inject: [REDIS, CONFIG],
      useFactory: (redis: Redis, config: Config): RateLimitService =>
        new RateLimitService(redis, config.SESSION_SECRET),
    },
    { provide: APP_INTERCEPTOR, useClass: RateLimitInterceptor },
  ],
  exports: [RateLimitService],
})
export class RateLimitModule {}
