import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gt, lt, otpChallenges, sql } from '@quad/db';
import { OTP_MAX_ATTEMPTS } from '@quad/domain';

import { TENANT_DB } from '../../../tokens';

import type { OtpChannel } from '@quad/contracts';
import type { OpenTx, QuadTenantDb } from '@quad/db';

/** Every code sent for sign-in has this purpose (`otp_challenges.purpose`). */
const SIGN_IN = 'sign_in';

/** A new challenge, its keyed hashes already computed (`OtpHashes`). */
export interface NewChallenge {
  readonly id: string;
  readonly subjectHash: Buffer;
  readonly channel: OtpChannel;
  readonly codeHash: Buffer;
  readonly at: Date;
  readonly expiresAt: Date;
}

/** The challenge an attempt was counted on, to compare its code with. */
export interface AttemptedChallenge {
  readonly id: string;
  readonly codeHash: Buffer;
}

/**
 * Every query on `otp_challenges`, the open table (D32): it is read and written in `withOpen`
 * transactions, with no school and no account, because no one is known until the code is right.
 */
@Injectable()
export class OtpRepository {
  constructor(@Inject(TENANT_DB) private readonly db: QuadTenantDb) {}

  /** Runs `fn` in one open transaction. */
  inOpen<T>(fn: (tx: OpenTx) => Promise<T>): Promise<T> {
    return this.db.withOpen(fn);
  }

  /**
   * Holds the subject's transaction-level advisory lock, so two requests for one number decide
   * their limits one after the other.
   */
  async lockSubjectIn(tx: OpenTx, subjectHash: Buffer): Promise<void> {
    // The first 8 bytes of the keyed hash: a 64-bit lock key that names no one.
    const key = subjectHash.readBigInt64BE(0).toString();
    await tx.execute(sql`select pg_advisory_xact_lock(${key}::bigint)`);
  }

  /** When codes were sent to the subject after `since`, for `otpSendDecision`. */
  async sentSinceIn(tx: OpenTx, subjectHash: Buffer, since: Date): Promise<Date[]> {
    const rows = await tx
      .select({ createdAt: otpChallenges.createdAt })
      .from(otpChallenges)
      .where(
        and(
          eq(otpChallenges.subjectHash, subjectHash),
          eq(otpChallenges.purpose, SIGN_IN),
          gt(otpChallenges.createdAt, since),
        ),
      );
    return rows.map((row) => row.createdAt);
  }

  async insertIn(tx: OpenTx, challenge: NewChallenge): Promise<void> {
    await tx.insert(otpChallenges).values({
      id: challenge.id,
      subjectHash: challenge.subjectHash,
      channel: challenge.channel,
      codeHash: challenge.codeHash,
      purpose: SIGN_IN,
      createdAt: challenge.at,
      expiresAt: challenge.expiresAt,
    });
  }

  /**
   * Counts one attempt on the subject's latest code, if it is still live (not expired, fewer
   * than `OTP_MAX_ATTEMPTS` attempts), before its code is compared, and locks the row until the
   * transaction ends: concurrent guesses are each counted, and only one can use the code.
   */
  async attemptIn(tx: OpenTx, subjectHash: Buffer, now: Date): Promise<AttemptedChallenge | null> {
    const latest = tx
      .select({ id: otpChallenges.id })
      .from(otpChallenges)
      .where(and(eq(otpChallenges.subjectHash, subjectHash), eq(otpChallenges.purpose, SIGN_IN)))
      .orderBy(desc(otpChallenges.createdAt), desc(otpChallenges.id))
      .limit(1);
    const [row] = await tx
      .update(otpChallenges)
      .set({ attempts: sql`${otpChallenges.attempts} + 1` })
      .where(
        and(
          eq(otpChallenges.id, latest),
          lt(otpChallenges.attempts, OTP_MAX_ATTEMPTS),
          gt(otpChallenges.expiresAt, now),
        ),
      )
      .returning({ id: otpChallenges.id, codeHash: otpChallenges.codeHash });
    return row ?? null;
  }

  /** Uses the code up: it expires now (and still counts toward the sending limits). */
  async useIn(tx: OpenTx, challengeId: string, now: Date): Promise<boolean> {
    const rows = await tx
      .update(otpChallenges)
      .set({ expiresAt: now })
      .where(and(eq(otpChallenges.id, challengeId), gt(otpChallenges.expiresAt, now)))
      .returning({ id: otpChallenges.id });
    return rows.length > 0;
  }
}
