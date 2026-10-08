import { Inject, Injectable } from '@nestjs/common';
import { pingDatabase } from '@quad/db';

import { CONFIG } from '../tokens';

import { pingRedis } from './redis-ping';

import type { Config } from '../config';
import type { HealthReady } from '@quad/contracts';

/** Each dependency gets at most this long; a load balancer probe must answer quickly. */
const CHECK_TIMEOUT_MS = 1000;
/**
 * Every check opens fresh connections, so a burst of probes (or anyone hitting the public
 * route) must not multiply them: results are reused this long, and concurrent callers share
 * the check in flight.
 */
const RESULT_TTL_MS = 2000;

@Injectable()
export class ReadinessService {
  private inFlight: Promise<HealthReady> | undefined;
  private cached: { readonly result: HealthReady; readonly at: number } | undefined;

  constructor(@Inject(CONFIG) private readonly config: Config) {}

  check(): Promise<HealthReady> {
    if (this.cached && Date.now() - this.cached.at < RESULT_TTL_MS) {
      return Promise.resolve(this.cached.result);
    }
    this.inFlight ??= this.runChecks().finally(() => {
      this.inFlight = undefined;
    });
    return this.inFlight;
  }

  private async runChecks(): Promise<HealthReady> {
    const [db, redis] = await Promise.all([
      pingDatabase(this.config.DATABASE_URL, CHECK_TIMEOUT_MS),
      pingRedis(this.config.REDIS_URL, CHECK_TIMEOUT_MS),
    ]);
    const result: HealthReady = {
      status: db && redis ? 'ok' : 'down',
      db: db ? 'ok' : 'down',
      redis: redis ? 'ok' : 'down',
    };
    this.cached = { result, at: Date.now() };
    return result;
  }
}
