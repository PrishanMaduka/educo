import { randomBytes } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { LOCKOUT_WINDOW_MINUTES, lockoutState } from '@quad/domain';

import { errorForLog } from '../../observability/logger';
import { LOGGER, REDIS } from '../../tokens';
import { UnavailableError } from '../errors';

import type { Redis } from 'ioredis';
import type { Logger } from 'pino';

const WINDOW_SECONDS = LOCKOUT_WINDOW_MINUTES * 60;

/**
 * The Redis sorted set of one subject's recent sign-in failures (ruling F13, D32): an account id
 * for staff and parents, `platform:{id}` for a console user (Task 10).
 */
export const lockoutKey = (subject: string): string => `lockout:${subject}`;

/**
 * Counts failed passwords and codes for the lockout rule (spec 05; `lockoutState` decides). Each
 * failure is a member of the sorted set `lockout:{subject}`, scored by its time, which expires 15
 * minutes after the last failure. The caller persists the lock (`accounts.locked_until`,
 * `platform_users.locked_until`).
 *
 * It fails closed: if Redis cannot read or write the counter, sign-in answers 503 `unavailable`
 * (and the API logs `lockout_unavailable`) instead of checking a password or code it could not
 * count. Only forgetting the failures after a success may fail quietly.
 */
@Injectable()
export class FailureCounter {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  /**
   * Checks the counter can be read before a password or code is checked; 503 when it cannot.
   * Sign-in calls it for an unknown email too (with a throwaway subject), so both do the same work.
   */
  async assertCounting(subject: string): Promise<void> {
    await this.orUnavailable(() => this.redis.zcard(lockoutKey(subject)));
  }

  /**
   * Counts a failure at `now` (503 when it cannot be counted). On a failure that trips the rule it
   * returns when the lock ends (the caller persists the lock, then `clear`s); otherwise null.
   */
  async count(subject: string, now: Date): Promise<Date | null> {
    const failures = await this.addFailure(subject, now);
    const state = lockoutState(failures, now);
    return state.locked ? state.lockedUntil : null;
  }

  /** Forgets the failures after a successful step (or a password reset). */
  async clear(subject: string): Promise<void> {
    try {
      await this.redis.del(lockoutKey(subject));
    } catch (error) {
      this.logger.warn(
        { metric: 'lockout_unavailable', error: errorForLog(error) },
        'Lockout failures not forgotten: Redis did not answer',
      );
    }
  }

  /** Adds one failure and returns the failure times still in the window. */
  private async addFailure(subject: string, now: Date): Promise<Date[]> {
    const key = lockoutKey(subject);
    const at = now.getTime();
    const result = await this.orUnavailable(() =>
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
    if (range === undefined || range[0] !== null || !Array.isArray(entries)) {
      this.unavailable(new Error('The lockout counter gave no failures back.'));
    }
    // WITHSCORES alternates member and score.
    return entries
      .filter((_value, index) => index % 2 === 1)
      .map((score) => new Date(Number(score)));
  }

  /** Runs a counter command; a Redis failure becomes 503 `unavailable` (fail closed). */
  private async orUnavailable<T>(command: () => Promise<T>): Promise<T> {
    try {
      return await command();
    } catch (error) {
      this.unavailable(error);
    }
  }

  private unavailable(error: unknown): never {
    this.logger.warn(
      { metric: 'lockout_unavailable', error: errorForLog(error) },
      'Sign-in refused: the lockout counter did not answer',
    );
    throw new UnavailableError();
  }
}
