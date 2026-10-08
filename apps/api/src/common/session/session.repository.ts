import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gt, isNull, sessions, sql, users } from '@quad/db';

import { TENANT_DB } from '../../tokens';

import type { MembershipStatus, SessionKind } from '@quad/contracts';
import type { QuadTenantDb, SessionLookup, TenantProfile } from '@quad/db';

/** The membership a session points at, as far as the guard needs it. */
export interface SessionMember {
  readonly accountId: string;
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
        .select({ accountId: users.accountId, status: users.status, deletedAt: users.deletedAt })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      const member = row
        ? { accountId: row.accountId, status: row.status, deleted: row.deletedAt !== null }
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
    const [row] = await this.db.withAccount(accountId, (tx) =>
      tx
        .update(sessions)
        .set({ revokedAt: sql`now()` })
        .where(
          and(
            eq(sessions.id, sessionId),
            eq(sessions.accountId, accountId),
            isNull(sessions.revokedAt),
          ),
        )
        .returning({ tokenHash: sessions.tokenHash }),
    );
    return row;
  }
}
