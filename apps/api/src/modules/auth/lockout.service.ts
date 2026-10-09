import { randomBytes } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import {
  LOCKOUT_FAILURES,
  LOCKOUT_MINUTES,
  LOCKOUT_WINDOW_MINUTES,
  isLockedAt,
  lockoutState,
} from '@quad/domain';

import { errorForLog } from '../../observability/logger';
import { CONFIG, DELIVERY, LOGGER, REDIS } from '../../tokens';

import { AuthRepository } from './auth.repository';

import type { DeliveryQueue } from '../../common/delivery/delivery.service';
import type { Config } from '../../config';
import type { Redis } from 'ioredis';
import type { Logger } from 'pino';

const WINDOW_SECONDS = LOCKOUT_WINDOW_MINUTES * 60;

/** The Redis sorted set of an account's recent failures (ruling F13, D32). */
export const lockoutKey = (accountId: string): string => `lockout:${accountId}`;

/**
 * The lockout rule (spec 05 step 7; `lockoutState` decides). Each failed password or two-step
 * code is a member of the sorted set `lockout:{accountId}`, scored by its time, which expires 15
 * minutes after the last failure. Five within 15 minutes set `accounts.locked_until` 15 minutes
 * ahead (which persists the lock), clear the set and email the person once.
 *
 * If Redis does not answer, failures are not counted and the API logs `lockout_unavailable`
 * (fail open, like the rate limits); a lock already stored on the account still holds.
 */
@Injectable()
export class LockoutService {
  constructor(
    private readonly repository: AuthRepository,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(DELIVERY) private readonly delivery: DeliveryQueue,
    @Inject(CONFIG) private readonly config: Config,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  /** True while the account's stored lock holds at `now`. */
  isLocked(account: { readonly lockedUntil: Date | null }, now: Date): boolean {
    return isLockedAt(account.lockedUntil, now);
  }

  /** Counts a failure at `now`; locks the account (and emails it) on the fifth in the window. */
  async recordFailure(accountId: string, now: Date): Promise<void> {
    const failures = await this.addFailure(accountId, now);
    if (failures === null) return;
    const state = lockoutState(failures, now);
    if (!state.locked || state.lockedUntil === null) return;
    const email = await this.repository.lockUntil(accountId, state.lockedUntil);
    await this.safely(() => this.redis.del(lockoutKey(accountId)));
    if (email !== null) {
      await this.delivery.queueEmail({
        jobId: `lockout.${accountId}.${state.lockedUntil.getTime()}`,
        to: email,
        template: 'lockout',
        params: {
          attempts: LOCKOUT_FAILURES,
          minutes: LOCKOUT_MINUTES,
          link: new URL('/sign-in/forgot', this.config.PUBLIC_WEB_URL).href,
        },
      });
    }
  }

  /** Forgets the failures after a successful step (or a password reset). */
  async clear(accountId: string): Promise<void> {
    await this.safely(() => this.redis.del(lockoutKey(accountId)));
  }

  /** Adds one failure and returns the failure times still in the window; null without Redis. */
  private async addFailure(accountId: string, now: Date): Promise<Date[] | null> {
    const key = lockoutKey(accountId);
    const at = now.getTime();
    const result = await this.safely(() =>
      this.redis
        .multi()
        // A random suffix keeps two failures in the same millisecond apart.
        .zadd(key, at, `${at}:${randomBytes(6).toString('hex')}`)
        .zremrangebyscore(key, '-inf', at - WINDOW_SECONDS * 1000)
        .expire(key, WINDOW_SECONDS)
        .zrange(key, '0', '-1', 'WITHSCORES')
        .exec(),
    );
    const [, , , range] = result ?? [];
    const entries = range?.[1];
    if (range === undefined || range[0] !== null || !Array.isArray(entries)) return null;
    // WITHSCORES alternates member and score.
    return entries
      .filter((_value, index) => index % 2 === 1)
      .map((score) => new Date(Number(score)));
  }

  private async safely<T>(command: () => Promise<T>): Promise<T | undefined> {
    try {
      return await command();
    } catch (error) {
      this.logger.warn(
        { metric: 'lockout_unavailable', error: errorForLog(error) },
        'Lockout counting skipped: Redis did not answer',
      );
      return undefined;
    }
  }
}
