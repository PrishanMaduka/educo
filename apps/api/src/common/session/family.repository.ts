import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, sessions } from '@quad/db';

import { TENANT_DB } from '../../tokens';

import type { SessionStage } from '@quad/contracts';
import type { AccountTx, QuadTenantDb } from '@quad/db';

/** Where a parent's refresh family stands (D32): choosing a school, or in one. */
export type FamilyStage = Extract<SessionStage, 'choose_school' | 'active'>;

/** A live parent refresh family (`kind = mobile`, not revoked). */
export interface Family {
  readonly id: string;
  readonly stage: FamilyStage;
  readonly tenantId: string | null;
  readonly userId: string | null;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

/** A family locked for a change, with its refresh state. */
export interface LockedFamily extends Family {
  readonly generation: number;
  /** SHA-256 of the current refresh secret; null while choosing a school. */
  readonly refreshHash: Buffer | null;
}

/** A new parent refresh family (`POST /auth/otp/verify`). */
export interface NewFamily {
  readonly id: string;
  readonly accountId: string;
  readonly stage: FamilyStage;
  readonly tenantId: string | null;
  readonly userId: string | null;
  readonly refreshHash: Buffer | null;
  readonly ip: string | null;
  readonly userAgent: string | null;
  readonly at: Date;
  readonly expiresAt: Date;
}

/** A family's next state: in a school, at a new generation with a new secret. */
export interface FamilyMove {
  readonly tenantId: string;
  readonly userId: string;
  readonly generation: number;
  readonly refreshHash: Buffer;
  readonly at: Date;
  readonly expiresAt: Date;
}

const isFamilyStage = (stage: SessionStage): stage is FamilyStage =>
  stage === 'choose_school' || stage === 'active';

/**
 * The parent app's refresh families (D32): `sessions` rows with `kind = 'mobile'` and no cookie
 * hash, read and written under `withAccount` (account RLS), so only the account's own family is
 * ever seen. The token lookup before the account is known is the `refresh_family` definer.
 */
@Injectable()
export class FamilyRepository {
  constructor(@Inject(TENANT_DB) private readonly db: QuadTenantDb) {}

  /** The account's live refresh family `sessionId`, or null (revoked, unknown, not mobile). */
  async family(accountId: string, sessionId: string): Promise<Family | null> {
    const [row] = await this.db.withAccount(accountId, (tx) =>
      tx
        .select(FAMILY_COLUMNS)
        .from(sessions)
        .where(
          and(eq(sessions.id, sessionId), eq(sessions.kind, 'mobile'), isNull(sessions.revokedAt)),
        )
        .limit(1),
    );
    return row === undefined ? null : familyOf(row);
  }

  /**
   * Locks the live refresh family `sessionId` for a change (select-school, refresh), so two
   * concurrent changes run one after the other and the second sees the first's generation.
   */
  async lockFamilyIn(tx: AccountTx, sessionId: string): Promise<LockedFamily | null> {
    const [row] = await tx
      .select({
        ...FAMILY_COLUMNS,
        generation: sessions.refreshGeneration,
        refreshHash: sessions.refreshHash,
      })
      .from(sessions)
      .where(
        and(eq(sessions.id, sessionId), eq(sessions.kind, 'mobile'), isNull(sessions.revokedAt)),
      )
      .for('update');
    if (row === undefined) return null;
    const family = familyOf(row);
    return family === null
      ? null
      : { ...family, generation: row.generation, refreshHash: row.refreshHash };
  }

  /** Starts a parent refresh family (`kind = mobile`, no cookie). */
  async insertFamilyIn(tx: AccountTx, family: NewFamily): Promise<void> {
    await tx.insert(sessions).values({
      id: family.id,
      accountId: family.accountId,
      kind: 'mobile',
      stage: family.stage,
      activeTenantId: family.tenantId,
      activeUserId: family.userId,
      refreshHash: family.refreshHash,
      refreshGeneration: 0,
      ip: family.ip,
      userAgent: family.userAgent,
      createdAt: family.at,
      lastSeenAt: family.at,
      expiresAt: family.expiresAt,
    });
  }

  /**
   * Moves a locked family to its next generation (a refresh, or a school chosen or switched),
   * only while it is still at `fromGeneration` and not revoked; false otherwise. With the row
   * lock this never fails, and the condition keeps two rotations from both succeeding anyway.
   */
  async moveFamilyIn(
    tx: AccountTx,
    sessionId: string,
    fromGeneration: number,
    move: FamilyMove,
  ): Promise<boolean> {
    const rows = await tx
      .update(sessions)
      .set({
        stage: 'active',
        activeTenantId: move.tenantId,
        activeUserId: move.userId,
        refreshGeneration: move.generation,
        refreshHash: move.refreshHash,
        lastSeenAt: move.at,
        expiresAt: move.expiresAt,
      })
      .where(
        and(
          eq(sessions.id, sessionId),
          eq(sessions.kind, 'mobile'),
          eq(sessions.refreshGeneration, fromGeneration),
          isNull(sessions.revokedAt),
        ),
      )
      .returning({ id: sessions.id });
    return rows.length > 0;
  }
}

const FAMILY_COLUMNS = {
  id: sessions.id,
  stage: sessions.stage,
  tenantId: sessions.activeTenantId,
  userId: sessions.activeUserId,
  createdAt: sessions.createdAt,
  expiresAt: sessions.expiresAt,
};

/** A family row as the token code sees it; null at a stage a family never has. */
function familyOf(row: {
  readonly id: string;
  readonly stage: SessionStage;
  readonly tenantId: string | null;
  readonly userId: string | null;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}): Family | null {
  const { stage } = row;
  return isFamilyStage(stage) ? { ...row, stage } : null;
}
