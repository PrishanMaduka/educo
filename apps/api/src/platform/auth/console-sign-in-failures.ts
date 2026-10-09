import { Inject, Injectable } from '@nestjs/common';

import { UnavailableError } from '../../common/errors';
import { FailureCounter } from '../../common/lockout/failure-counter';
import { PlatformAuditService } from '../audit/platform-audit.service';
import { PLATFORM_DB } from '../tokens';

import { PlatformAuthRepository } from './platform-auth.repository';

import type { QuadPlatformDb } from '@quad/db';

/** Request facts a console sign-in records: never a source of anything it decides. */
export interface ConsoleClient {
  readonly ip: string;
  readonly userAgent: string | null;
}

/**
 * Why a console sign-in was refused, in `platform_audit.meta.reason` (never the email, password
 * or code): no such user, a deactivated or locked one, a wrong password or code, or a lockout
 * counter that could not answer.
 */
export type ConsoleFailureReason =
  'unknown_email' | 'deactivated' | 'locked' | 'wrong_password' | 'wrong_code' | 'unavailable';

/** The lockout subject of a console user, apart from accounts' (`FailureCounter`). */
export const lockoutSubject = (platformUserId: string): string => `platform:${platformUserId}`;

/**
 * Every refused console sign-in, written to `platform_audit` as `auth.sign_in_failed` before the
 * refusal answers (fix round 1, I2): wrong passwords and codes also count toward the lockout
 * (persisting a lock they trip in the same transaction), and a counter that cannot answer is
 * audited as `unavailable` before the 503. Failures have no actor: nobody is signed in yet.
 */
@Injectable()
export class ConsoleSignInFailures {
  constructor(
    @Inject(PLATFORM_DB) private readonly db: QuadPlatformDb,
    private readonly repository: PlatformAuthRepository,
    private readonly audit: PlatformAuditService,
    private readonly counter: FailureCounter,
  ) {}

  /** Reads the counter before a password or code is checked; 503 (audited) when it cannot. */
  async assertCounting(
    subject: string,
    userId: string | null,
    client: ConsoleClient,
  ): Promise<void> {
    await this.orAudited(userId, client, () => this.counter.assertCounting(subject));
  }

  /** A wrong password or code: counted (a lock it trips is persisted) and audited. */
  async counted(
    subject: string,
    userId: string | null,
    reason: ConsoleFailureReason,
    client: ConsoleClient,
    now: Date,
  ): Promise<void> {
    const lockedUntil = await this.orAudited(userId, client, () =>
      this.counter.count(subject, now),
    );
    await this.db.withPlatform(async (tx) => {
      if (lockedUntil !== null && userId !== null) {
        await this.repository.lockUntil(tx, userId, lockedUntil);
      }
      await this.audit.record(tx, {
        actorPlatformUserId: null,
        action: 'auth.sign_in_failed',
        target: userId === null ? null : { type: 'platform_user', id: userId },
        ip: client.ip,
        userAgent: client.userAgent,
        meta: {
          reason,
          ...(lockedUntil === null ? {} : { lockedUntil: lockedUntil.toISOString() }),
        },
      });
    });
    if (lockedUntil !== null) await this.counter.clear(subject);
  }

  /**
   * A refusal that is not counted (a locked or deactivated user): audited only. With
   * `endingSession`, that sign-in step session is revoked in the same transaction, so a retry
   * finds no session and is not audited again.
   */
  async refused(
    userId: string | null,
    reason: ConsoleFailureReason,
    client: ConsoleClient,
    endingSession?: { readonly id: string; readonly now: Date },
  ): Promise<void> {
    await this.db.withPlatform(async (tx) => {
      if (endingSession !== undefined) {
        await this.repository.revokeSession(tx, endingSession.id, endingSession.now);
      }
      await this.audit.record(tx, {
        actorPlatformUserId: null,
        action: 'auth.sign_in_failed',
        target: userId === null ? null : { type: 'platform_user', id: userId },
        ip: client.ip,
        userAgent: client.userAgent,
        meta: { reason },
      });
    });
  }

  /** Forgets the failures once every factor has passed. */
  async clear(subject: string): Promise<void> {
    await this.counter.clear(subject);
  }

  /** Runs a counter command; its 503 is audited as `unavailable` first. */
  private async orAudited<T>(
    userId: string | null,
    client: ConsoleClient,
    command: () => Promise<T>,
  ): Promise<T> {
    try {
      return await command();
    } catch (error) {
      if (error instanceof UnavailableError) await this.refused(userId, 'unavailable', client);
      throw error;
    }
  }
}
