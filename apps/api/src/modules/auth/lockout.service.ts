import { Inject, Injectable } from '@nestjs/common';
import { LOCKOUT_FAILURES, LOCKOUT_MINUTES, isLockedAt } from '@quad/domain';

import { FailureCounter } from '../../common/lockout/failure-counter';
import { CONFIG, DELIVERY } from '../../tokens';

import { AuthRepository } from './auth.repository';

import type { DeliveryQueue } from '../../common/delivery/delivery.service';
import type { Config } from '../../config';

/**
 * The lockout rule for accounts (spec 05 step 7): `FailureCounter` counts each failed password or
 * two-step code in Redis, and five within 15 minutes set `accounts.locked_until` 15 minutes ahead
 * (which persists the lock) and email the person once. It fails closed (503 `unavailable`) when
 * the counter cannot be read or written; only forgetting the failures may fail quietly.
 */
@Injectable()
export class LockoutService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly counter: FailureCounter,
    @Inject(DELIVERY) private readonly delivery: DeliveryQueue,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  /** True while the account's stored lock holds at `now`. */
  isLocked(account: { readonly lockedUntil: Date | null }, now: Date): boolean {
    return isLockedAt(account.lockedUntil, now);
  }

  /**
   * Checks the counter can be read before a password or code is checked; 503 when it cannot.
   * Sign-in calls it for an unknown email too (with a throwaway id), so both do the same work.
   */
  async assertCounting(accountId: string): Promise<void> {
    await this.counter.assertCounting(accountId);
  }

  /**
   * Counts a failure at `now` (503 when it cannot be counted); locks the account, and emails it,
   * on the fifth in the window.
   */
  async recordFailure(accountId: string, now: Date): Promise<void> {
    const lockedUntil = await this.counter.count(accountId, now);
    if (lockedUntil === null) return;
    const email = await this.repository.lockUntil(accountId, lockedUntil);
    await this.counter.clear(accountId);
    if (email !== null) {
      await this.delivery.queueEmail({
        jobId: `lockout.${accountId}.${lockedUntil.getTime()}`,
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
    await this.counter.clear(accountId);
  }
}
