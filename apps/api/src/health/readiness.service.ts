import { Inject, Injectable } from '@nestjs/common';
import { pingDatabase } from '@quad/db';

import { CONFIG } from '../tokens';

import { pingRedis } from './redis-ping';

import type { Config } from '../config';
import type { HealthReady } from '@quad/contracts';

/** Each dependency gets at most this long; a load balancer probe must answer quickly. */
const CHECK_TIMEOUT_MS = 1000;

@Injectable()
export class ReadinessService {
  constructor(@Inject(CONFIG) private readonly config: Config) {}

  async check(): Promise<HealthReady> {
    const [db, redis] = await Promise.all([
      pingDatabase(this.config.DATABASE_URL, CHECK_TIMEOUT_MS),
      pingRedis(this.config.REDIS_URL, CHECK_TIMEOUT_MS),
    ]);
    return {
      status: db && redis ? 'ok' : 'down',
      db: db ? 'ok' : 'down',
      redis: redis ? 'ok' : 'down',
    };
  }
}
