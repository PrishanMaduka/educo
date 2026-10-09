import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gt, isNull, sessions, sql, users } from '@quad/db';

import { TENANT_DB } from '../../tokens';

import type {
  MembershipKind,
  MembershipStatus,
  SessionKind,
  SessionStage,
  SignInMethod,
} from '@quad/contracts';
import type { AccountTx, QuadTenantDb, SessionLookup, TenantProfile } from '@quad/db';

/** The membership a session points at, as far as the guard needs it. */
export interface SessionMember {
  readonly accountId: string;
  readonly kind: MembershipKind;
  readonly status: MembershipStatus;
  readonly deleted: boolean;
}

/** What the guard checks in the session's school on a cache miss. */
export interface SessionSchool {
  /** Null when the row is not visible: another school's id, or no such membership. */
  readonly member: SessionMember | null;
  readonly profile: TenantProfile | null;
}

/** Where a page of `GET /me/sessions` starts: after this `created_at` (with microseconds) and id. */
export interface SessionKeyset {
  readonly at: string;
  readonly id: string;
}

/** One row of `GET /me/sessions`. */
export interface SessionRow {
  readonly id: string;
  readonly kind: SessionKind;
  readonly deviceName: string | null;
  readonly userAgent: string | null;
  readonly createdAt: Date;
  readonly lastSeenAt: Date;
  /** `created_at` in UTC with microseconds, for the next page's keyset. */
  readonly keysetAt: string;
}

/** Where a staff session is in the sign-in steps, and, once active, its school. */
export interface SessionPlace {
  readonly stage: SessionStage;
  readonly tenantId: string | null;
  readonly userId: string | null;
}

/** A new staff browser session (`POST /auth/password`, the SSO callback). */
export interface NewWebSession extends SessionPlace {
  readonly accountId: string;
  readonly tokenHash: Buffer;
  readonly keepSignedIn: boolean;
  /** The first factor it signed in with, for the `auth.sign_in` audit. */
  readonly signInMethod: SignInMethod;
  readonly ip: string | null;
  readonly userAgent: string | null;
  readonly at: Date;
  readonly expiresAt: Date;
}

/**
 * Every query on `sessions` for the API's own session handling. The account's rows are read and
 * written under `withAccount` (account RLS, D32); the token lookup goes through the
 * `session_by_token` definer, and the school checks through `withTenant`.
 */
@Injectable()
export class SessionRepository {
  constructor(@Inject(TENANT_DB) private readonly db: QuadTenantDb) {}

  /** The session or support visit a cookie hash names (not revoked; expiry is the caller's). */
  lookup(tokenHash: Buffer): Promise<SessionLookup | null> {
    return this.db.definers.sessionByToken(tokenHash);
  }

  /** The school's profile and, when `userId` is given, that membership in it. */
  school(tenantId: string, userId: string | null): Promise<SessionSchool> {
    return this.db.withTenant(tenantId, async (tx) => {
      const profile = await this.db.definers.currentTenantProfile(tx);
      if (userId === null) {
        return { member: null, profile };
      }
      const [row] = await tx
        .select({
          accountId: users.accountId,
          kind: users.kind,
          status: users.status,
          deletedAt: users.deletedAt,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      const member = row
        ? {
            accountId: row.accountId,
            kind: row.kind,
            status: row.status,
            deleted: row.deletedAt !== null,
          }
        : null;
      return { member, profile };
    });
  }

  /** Records activity: the new `last_seen_at` and the idle expiry it gives. */
  async touch(accountId: string, sessionId: string, at: Date, expiresAt: Date): Promise<void> {
    await this.db.withAccount(accountId, (tx) =>
      tx
        .update(sessions)
        .set({ lastSeenAt: at, expiresAt })
        .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt))),
    );
  }

  /**
   * The account's sessions that are neither revoked nor past `expires_at`, newest first, after
   * the `(createdAt, id)` keyset of the previous page. `createdAt` is compared as text with
   * microseconds (a JavaScript Date would drop them). One extra row tells the caller there is a
   * next page.
   */
  listOwn(
    accountId: string,
    page: { readonly limit: number; readonly after: SessionKeyset | null },
    now: Date,
  ): Promise<SessionRow[]> {
    const after = page.after;
    return this.db.withAccount(accountId, (tx) =>
      tx
        .select({
          id: sessions.id,
          kind: sessions.kind,
          deviceName: sessions.deviceName,
          userAgent: sessions.userAgent,
          createdAt: sessions.createdAt,
          lastSeenAt: sessions.lastSeenAt,
          keysetAt: sql<string>`to_char(${sessions.createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
        })
        .from(sessions)
        .where(
          and(
            eq(sessions.accountId, accountId),
            isNull(sessions.revokedAt),
            gt(sessions.expiresAt, now),
            after === null
              ? undefined
              : sql`(${sessions.createdAt}, ${sessions.id}) < (${after.at}::timestamptz, ${after.id}::uuid)`,
          ),
        )
        .orderBy(desc(sessions.createdAt), desc(sessions.id))
        .limit(page.limit + 1),
    );
  }

  /**
   * Revokes one of the account's own sessions. Returns its token hash (null for a mobile
   * session, which has none) so the cache entry can go, or undefined when there is no such live
   * session of this account (another account's id is hidden by RLS).
   */
  async revokeOwn(
    accountId: string,
    sessionId: string,
  ): Promise<{ tokenHash: Buffer | null } | undefined> {
    return this.db.withAccount(accountId, (tx) => this.revokeIn(tx, accountId, sessionId));
  }
  /** Starts a staff browser session (`kind = web`) in the given step; returns its id. */
  async insertIn(tx: AccountTx, session: NewWebSession): Promise<string> {
    const [row] = await tx
      .insert(sessions)
      .values({
        accountId: session.accountId,
        kind: 'web',
        stage: session.stage,
        activeTenantId: session.tenantId,
        activeUserId: session.userId,
        tokenHash: session.tokenHash,
        keepSignedIn: session.keepSignedIn,
        signInMethod: session.signInMethod,
        ip: session.ip,
        userAgent: session.userAgent,
        createdAt: session.at,
        lastSeenAt: session.at,
        expiresAt: session.expiresAt,
      })
      .returning({ id: sessions.id });
    if (row === undefined) throw new Error('The session row was not written.');
    return row.id;
  }

  /**
   * Locks the live session that `tokenHash` still names, before a step moves it on; null when it
   * was revoked or its token has already rotated (a second tab, a replay).
   */
  async lockForStepIn(
    tx: AccountTx,
    sessionId: string,
    tokenHash: Buffer,
  ): Promise<{
    readonly keepSignedIn: boolean;
    readonly signInMethod: SignInMethod | null;
  } | null> {
    const [row] = await tx
      .select({ keepSignedIn: sessions.keepSignedIn, signInMethod: sessions.signInMethod })
      .from(sessions)
      .where(
        and(
          eq(sessions.id, sessionId),
          eq(sessions.tokenHash, tokenHash),
          isNull(sessions.revokedAt),
        ),
      )
      .for('update');
    return row ?? null;
  }

  /**
   * Moves a locked session to its next step with a new token (spec 05: the session id rotates on
   * every step and on Switch school), only while `oldTokenHash` is still its token and it is not
   * revoked; false otherwise. Any role preview ends with the school it was for.
   */
  async rotateIn(
    tx: AccountTx,
    sessionId: string,
    oldTokenHash: Buffer,
    change: SessionPlace & {
      readonly tokenHash: Buffer;
      readonly at: Date;
      readonly expiresAt: Date;
    },
  ): Promise<boolean> {
    const rows = await tx
      .update(sessions)
      .set({
        tokenHash: change.tokenHash,
        stage: change.stage,
        activeTenantId: change.tenantId,
        activeUserId: change.userId,
        previewRoleId: null,
        previewSampleUserId: null,
        lastSeenAt: change.at,
        expiresAt: change.expiresAt,
      })
      .where(
        and(
          eq(sessions.id, sessionId),
          eq(sessions.tokenHash, oldTokenHash),
          isNull(sessions.revokedAt),
        ),
      )
      .returning({ id: sessions.id });
    return rows.length > 0;
  }

  /** Revokes one of the account's sessions; its token hash, or undefined when it was not live. */
  async revokeIn(
    tx: AccountTx,
    accountId: string,
    sessionId: string,
  ): Promise<{ tokenHash: Buffer | null } | undefined> {
    const [row] = await tx
      .update(sessions)
      .set({ revokedAt: sql`now()` })
      .where(
        and(
          eq(sessions.id, sessionId),
          eq(sessions.accountId, accountId),
          isNull(sessions.revokedAt),
        ),
      )
      .returning({ tokenHash: sessions.tokenHash });
    return row;
  }

  /** Revokes every live session of the account (password reset); their cookie hashes. */
  async revokeAllIn(tx: AccountTx, accountId: string): Promise<Buffer[]> {
    const rows = await tx
      .update(sessions)
      .set({ revokedAt: sql`now()` })
      .where(and(eq(sessions.accountId, accountId), isNull(sessions.revokedAt)))
      .returning({ tokenHash: sessions.tokenHash });
    return rows.flatMap((row) => (row.tokenHash === null ? [] : [row.tokenHash]));
  }
}
