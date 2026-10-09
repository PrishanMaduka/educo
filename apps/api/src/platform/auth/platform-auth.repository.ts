import { Injectable } from '@nestjs/common';
import { and, eq, isNotNull, isNull, lt, or, platformUsers, sessions } from '@quad/db';

import type { AccountStatus, PlatformRole, SessionStage } from '@quad/contracts';
import type { PlatformTx } from '@quad/db';

/** A console user as the password step reads them (one query, known email or not). */
export interface PasswordUser {
  readonly id: string;
  readonly status: AccountStatus;
  readonly passwordHash: string | null;
  readonly lockedUntil: Date | null;
  readonly totpEnabled: boolean;
}

/** A console user as the authenticator steps read them. */
export interface TotpUser {
  readonly id: string;
  readonly email: string;
  readonly status: AccountStatus;
  readonly lockedUntil: Date | null;
  readonly totpEnabled: boolean;
  readonly totpSecretEnc: string | null;
  readonly totpLastStep: number | null;
}

/** A live console session row and its user, for `ConsoleSessions`. */
export interface ConsoleSessionRow {
  readonly sessionId: string;
  readonly stage: SessionStage;
  readonly lastSeenAt: Date;
  readonly expiresAt: Date;
  readonly platformUserId: string;
  readonly name: string;
  readonly role: PlatformRole;
  readonly status: AccountStatus;
}

/** Where a console session moves: a new token at every step (spec 05). */
export interface SessionMove {
  readonly stage: SessionStage;
  readonly tokenHash: Buffer;
  readonly lastSeenAt: Date;
  readonly expiresAt: Date;
}

/**
 * Every console sign-in query (`platform_users` and the `kind='console'` rows of `sessions`), each
 * inside the caller's `withPlatform` transaction, so the service records `platform_audit` in the
 * same one (D17). It loads and saves; it never decides.
 */
@Injectable()
export class PlatformAuthRepository {
  async userByEmail(tx: PlatformTx, email: string): Promise<PasswordUser | null> {
    const [row] = await tx
      .select({
        id: platformUsers.id,
        status: platformUsers.status,
        passwordHash: platformUsers.passwordHash,
        lockedUntil: platformUsers.lockedUntil,
        totpEnabled: platformUsers.totpEnabled,
      })
      .from(platformUsers)
      .where(eq(platformUsers.email, email));
    return row ?? null;
  }

  async totpUser(tx: PlatformTx, id: string): Promise<TotpUser | null> {
    const [row] = await tx
      .select({
        id: platformUsers.id,
        email: platformUsers.email,
        status: platformUsers.status,
        lockedUntil: platformUsers.lockedUntil,
        totpEnabled: platformUsers.totpEnabled,
        totpSecretEnc: platformUsers.totpSecretEnc,
        totpLastStep: platformUsers.totpLastStep,
      })
      .from(platformUsers)
      .where(eq(platformUsers.id, id));
    return row ?? null;
  }

  /** The unrevoked console session a cookie hash names, with its user; null for any other row. */
  async sessionByToken(tx: PlatformTx, tokenHash: Buffer): Promise<ConsoleSessionRow | null> {
    const [row] = await tx
      .select({
        sessionId: sessions.id,
        stage: sessions.stage,
        lastSeenAt: sessions.lastSeenAt,
        expiresAt: sessions.expiresAt,
        platformUserId: platformUsers.id,
        name: platformUsers.name,
        role: platformUsers.role,
        status: platformUsers.status,
      })
      .from(sessions)
      .innerJoin(platformUsers, eq(platformUsers.id, sessions.platformUserId))
      .where(
        and(
          eq(sessions.tokenHash, tokenHash),
          eq(sessions.kind, 'console'),
          isNotNull(sessions.platformUserId),
          isNull(sessions.revokedAt),
        ),
      );
    return row ?? null;
  }

  async insertSession(
    tx: PlatformTx,
    session: {
      readonly platformUserId: string;
      readonly stage: SessionStage;
      readonly tokenHash: Buffer;
      readonly ip: string;
      readonly userAgent: string | null;
      readonly now: Date;
      readonly expiresAt: Date;
    },
  ): Promise<void> {
    await tx.insert(sessions).values({
      platformUserId: session.platformUserId,
      kind: 'console',
      stage: session.stage,
      tokenHash: session.tokenHash,
      ip: session.ip,
      userAgent: session.userAgent,
      createdAt: session.now,
      lastSeenAt: session.now,
      expiresAt: session.expiresAt,
    });
  }

  /**
   * Moves a live console session on with a new token, only while its cookie still has
   * `tokenHash` (a step cannot be used twice); false when it no longer does.
   */
  async moveSession(
    tx: PlatformTx,
    sessionId: string,
    tokenHash: Buffer,
    move: SessionMove,
  ): Promise<boolean> {
    const moved = await tx
      .update(sessions)
      .set(move)
      .where(
        and(
          eq(sessions.id, sessionId),
          eq(sessions.kind, 'console'),
          eq(sessions.tokenHash, tokenHash),
          isNull(sessions.revokedAt),
        ),
      )
      .returning({ id: sessions.id });
    return moved.length === 1;
  }

  /** Last seen and the new idle expiry: bookkeeping, at most every few minutes. */
  async touchSession(tx: PlatformTx, sessionId: string, now: Date, expiresAt: Date): Promise<void> {
    await tx
      .update(sessions)
      .set({ lastSeenAt: now, expiresAt })
      .where(and(eq(sessions.id, sessionId), eq(sessions.kind, 'console')));
  }

  async revokeSession(tx: PlatformTx, sessionId: string, now: Date): Promise<void> {
    await tx
      .update(sessions)
      .set({ revokedAt: now })
      .where(
        and(eq(sessions.id, sessionId), eq(sessions.kind, 'console'), isNull(sessions.revokedAt)),
      );
  }

  async lockUntil(tx: PlatformTx, id: string, until: Date): Promise<void> {
    await tx.update(platformUsers).set({ lockedUntil: until }).where(eq(platformUsers.id, id));
  }

  async markSignedIn(tx: PlatformTx, id: string, now: Date): Promise<void> {
    await tx.update(platformUsers).set({ lastSignInAt: now }).where(eq(platformUsers.id, id));
  }

  /** Stores a new, unconfirmed authenticator; false once one is on. */
  async savePendingTotp(tx: PlatformTx, id: string, sealed: string): Promise<boolean> {
    const saved = await tx
      .update(platformUsers)
      .set({ totpSecretEnc: sealed, totpLastStep: null })
      .where(and(eq(platformUsers.id, id), eq(platformUsers.totpEnabled, false)))
      .returning({ id: platformUsers.id });
    return saved.length === 1;
  }

  /**
   * Turns on the pending authenticator `sealed` with its first accepted step; false when another
   * request replaced or confirmed it meanwhile.
   */
  async enableTotp(
    tx: PlatformTx,
    id: string,
    sealed: string,
    step: number | null,
  ): Promise<boolean> {
    const enabled = await tx
      .update(platformUsers)
      .set({ totpEnabled: true, totpLastStep: step })
      .where(
        and(
          eq(platformUsers.id, id),
          eq(platformUsers.totpEnabled, false),
          eq(platformUsers.totpSecretEnc, sealed),
        ),
      )
      .returning({ id: platformUsers.id });
    return enabled.length === 1;
  }

  /** Records `step` as used, only if it is later than the last one (so a replay is refused). */
  async acceptTotpStep(tx: PlatformTx, id: string, step: number): Promise<boolean> {
    const accepted = await tx
      .update(platformUsers)
      .set({ totpLastStep: step })
      .where(
        and(
          eq(platformUsers.id, id),
          or(isNull(platformUsers.totpLastStep), lt(platformUsers.totpLastStep, step)),
        ),
      )
      .returning({ id: platformUsers.id });
    return accepted.length === 1;
  }
}
