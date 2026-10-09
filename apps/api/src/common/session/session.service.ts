import { Inject, Injectable } from '@nestjs/common';
import { IdSchema, SessionStage } from '@quad/contracts';
import { sessionExpiry } from '@quad/domain';
import { z } from 'zod';

import { errorForLog } from '../../observability/logger';
import { CLOCK, LOGGER, REDIS } from '../../tokens';
import { NotFoundError } from '../errors';
import { decodeCursor, pageOf } from '../pagination/cursor';

import { SessionRepository } from './session.repository';

import type { PersonAuth, RequestAuth } from './request-auth';
import type { Clock } from '../../tokens';
import type { PageQuery, SessionSummaryList } from '@quad/contracts';
import type { AccountSessionLookup, SupportSessionLookup } from '@quad/db';
import type { Redis } from 'ioredis';
import type { Logger } from 'pino';

/** Spec 05 / D32: a resolved session is cached in Redis for 30 s. */
export const SESSION_CACHE_SECONDS = 30;
/** The index sets outlive the entries they list, so an entry is never left unindexed. */
const INDEX_SECONDS = 2 * SESSION_CACHE_SECONDS;
/** `last_seen_at` is written at most this often per session (the idle timeout is in hours). */
export const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

const KEY_PREFIX = 'quad:session';
const entryKey = (tokenHash: Buffer) => `${KEY_PREFIX}:${tokenHash.toString('hex')}`;
const memberIndexKey = (accountId: string, tenantId: string | null) =>
  `${KEY_PREFIX}:idx:m:${accountId}:${tenantId ?? '-'}`;
const accountIndexKey = (accountId: string) => `${KEY_PREFIX}:idx:a:${accountId}`;

const Instant = z
  .string()
  .datetime()
  .transform((value) => new Date(value));

/**
 * What is cached per cookie hash: the session as `session_by_token` returned it, after the
 * membership and school checks passed, plus the school's `session_hours` for the idle timeout.
 * Expiry is checked on every request against these fields, so a cached entry never outlives it.
 */
const CachedSession = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('web'),
    sessionId: IdSchema,
    accountId: IdSchema,
    stage: SessionStage,
    tenantId: IdSchema.nullable(),
    userId: IdSchema.nullable(),
    previewRoleId: IdSchema.nullable(),
    previewSampleUserId: IdSchema.nullable(),
    supportSessionId: IdSchema.nullable(),
    keepSignedIn: z.boolean(),
    sessionHours: z.number().int().positive().nullable(),
    lastSeenAt: Instant,
    expiresAt: Instant,
  }),
  z.object({
    kind: z.literal('support'),
    supportSessionId: IdSchema,
    platformUserId: IdSchema,
    tenantId: IdSchema,
    expiresAt: Instant,
  }),
]);
type CachedSession = z.output<typeof CachedSession>;

/** A `GET /me/sessions` cursor: the last item's `created_at` (UTC, microseconds) and id. */
const SessionCursor = z.object({
  at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/),
  id: IdSchema,
});

/**
 * Server-side sessions (spec 05; D32): resolves a cookie hash to a `RequestAuth`, with a 30 s
 * Redis cache, and revokes and lists a person's own sessions. A session is refused (null, so a
 * 401) only when it is revoked or expired, its membership is deactivated or gone, or its school
 * is deleted. A suspended school still resolves: `TenantStatusGuard` (Task 12) answers 403.
 *
 * Revocations elsewhere must drop the cache, or the old entry is used for up to 30 s:
 * `invalidateToken` for one cookie, `invalidateMember` after `revoke_member_sessions` or a
 * deactivation (Task 13), `invalidateAccount` after a password reset (Task 7). If Redis is down
 * the cache is skipped and every request reads Postgres.
 */
@Injectable()
export class SessionService {
  constructor(
    private readonly repository: SessionRepository,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(CLOCK) private readonly now: Clock,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  /** The session a cookie hash names, or null when there is none or it has ended. */
  async resolve(tokenHash: Buffer): Promise<RequestAuth | null> {
    const cached = (await this.readCache(tokenHash)) ?? (await this.load(tokenHash));
    if (cached === null) {
      return null;
    }
    const now = new Date(this.now());
    if (this.isExpired(cached, now)) {
      await this.invalidateToken(tokenHash);
      return null;
    }
    // A sign-in step keeps the 15-minute expiry its step gave it (D32); only active ones idle on.
    if (
      cached.kind === 'web' &&
      cached.stage === 'active' &&
      now.getTime() - cached.lastSeenAt.getTime() >= TOUCH_INTERVAL_MS
    ) {
      await this.touch(tokenHash, cached, now);
    }
    return toRequestAuth(cached, tokenHash);
  }

  /** Drops one cookie's cache entry (sign-out, `DELETE /me/sessions/:id`, support exit). */
  async invalidateToken(tokenHash: Buffer): Promise<void> {
    await this.safely('invalidate', () => this.redis.del(entryKey(tokenHash)));
  }

  /**
   * Drops every cached session of `accountId` in `tenantId` (Task 13: after
   * `revoke_member_sessions`, a deactivation or a role change that ends access).
   */
  async invalidateMember(accountId: string, tenantId: string): Promise<void> {
    await this.dropIndexed(memberIndexKey(accountId, tenantId));
  }

  /** Drops every cached session of `accountId`, in every school (password reset, Task 7). */
  async invalidateAccount(accountId: string): Promise<void> {
    await this.dropIndexed(accountIndexKey(accountId));
  }

  /** `GET /me/sessions`: the person's own live sessions, newest first. */
  async listOwn(auth: PersonAuth, query: PageQuery): Promise<SessionSummaryList> {
    const after = decodeCursor(SessionCursor, query.cursor);
    const rows = await this.repository.listOwn(
      auth.accountId,
      { limit: query.limit, after },
      new Date(this.now()),
    );
    const page = pageOf(rows, query.limit, (last) => ({ at: last.keysetAt, id: last.id }));
    return {
      items: page.items.map((row) => ({
        id: row.id,
        kind: row.kind === 'mobile' ? 'mobile' : 'web',
        deviceName: row.deviceName,
        userAgent: row.userAgent,
        createdAt: row.createdAt.toISOString(),
        lastSeenAt: row.lastSeenAt.toISOString(),
        current: row.id === auth.sessionId,
      })),
      nextCursor: page.nextCursor,
    };
  }

  /**
   * `DELETE /me/sessions/:id`: signs one of the person's own devices out, at once (the cache
   * entry goes too). 404 for an id that is not one of their live sessions.
   */
  async revokeOwn(auth: PersonAuth, sessionId: string): Promise<{ readonly current: boolean }> {
    const revoked = await this.repository.revokeOwn(auth.accountId, sessionId);
    if (revoked === undefined) {
      throw new NotFoundError();
    }
    if (revoked.tokenHash !== null) {
      await this.invalidateToken(revoked.tokenHash);
    }
    return { current: sessionId === auth.sessionId };
  }

  private isExpired(session: CachedSession, now: Date): boolean {
    if (session.kind === 'support') {
      return sessionExpiry({ kind: 'support', supportExpiresAt: session.expiresAt, now }).expired;
    }
    const idle = sessionExpiry({
      kind: 'web',
      lastSeenAt: session.lastSeenAt,
      keepSignedIn: session.keepSignedIn,
      ...(session.sessionHours === null ? {} : { sessionHours: session.sessionHours }),
      now,
    });
    return idle.expired || now.getTime() >= session.expiresAt.getTime();
  }

  private async touch(
    tokenHash: Buffer,
    session: Extract<CachedSession, { kind: 'web' }>,
    now: Date,
  ): Promise<void> {
    const { expiresAt } = sessionExpiry({
      kind: 'web',
      lastSeenAt: now,
      keepSignedIn: session.keepSignedIn,
      ...(session.sessionHours === null ? {} : { sessionHours: session.sessionHours }),
      now,
    });
    await this.repository.touch(session.accountId, session.sessionId, now, expiresAt);
    // Dropped rather than rewritten: a rewrite could bring back a session revoked meanwhile.
    await this.invalidateToken(tokenHash);
  }

  /** Reads Postgres on a cache miss, checks the membership and school, and caches the result. */
  private async load(tokenHash: Buffer): Promise<CachedSession | null> {
    const lookup = await this.repository.lookup(tokenHash);
    if (lookup === null) {
      return null;
    }
    const session =
      lookup.kind === 'support' ? await this.loadSupport(lookup) : await this.loadAccount(lookup);
    if (session !== null) {
      await this.writeCache(tokenHash, session);
    }
    return session;
  }

  private async loadSupport(lookup: SupportSessionLookup): Promise<CachedSession | null> {
    const { profile } = await this.repository.school(lookup.tenantId, null);
    if (profile === null || profile.status === 'deleted') {
      return null;
    }
    return {
      kind: 'support',
      supportSessionId: lookup.supportSessionId,
      platformUserId: lookup.platformUserId,
      tenantId: lookup.tenantId,
      expiresAt: lookup.expiresAt,
    };
  }

  private async loadAccount(lookup: AccountSessionLookup): Promise<CachedSession | null> {
    // Mobile sessions use refresh tokens and bearer JWTs (Task 9), never this cookie.
    if (lookup.kind !== 'web') {
      return null;
    }
    // The school counts only once the session is active in it (D32).
    const tenantId = lookup.stage === 'active' ? lookup.activeTenantId : null;
    let sessionHours: number | null = null;
    if (tenantId !== null) {
      const { member, profile } = await this.repository.school(tenantId, lookup.activeUserId);
      const memberLive =
        member !== null &&
        member.accountId === lookup.accountId &&
        member.status === 'active' &&
        !member.deleted;
      if (!memberLive || profile === null || profile.status === 'deleted') {
        return null;
      }
      sessionHours = profile.sessionHours;
    }
    return {
      kind: 'web',
      sessionId: lookup.sessionId,
      accountId: lookup.accountId,
      stage: lookup.stage,
      tenantId,
      userId: tenantId === null ? null : lookup.activeUserId,
      previewRoleId: lookup.previewRoleId,
      previewSampleUserId: lookup.previewSampleUserId,
      supportSessionId: lookup.supportSessionId,
      keepSignedIn: lookup.keepSignedIn,
      sessionHours,
      lastSeenAt: lookup.lastSeenAt,
      expiresAt: lookup.expiresAt,
    };
  }

  private async readCache(tokenHash: Buffer): Promise<CachedSession | null> {
    const raw = await this.safely('read', () => this.redis.get(entryKey(tokenHash)));
    if (typeof raw !== 'string') {
      return null;
    }
    try {
      const parsed = CachedSession.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  private async writeCache(tokenHash: Buffer, session: CachedSession): Promise<void> {
    const key = entryKey(tokenHash);
    const transaction = this.redis
      .multi()
      .set(key, JSON.stringify(session), 'EX', SESSION_CACHE_SECONDS);
    if (session.kind === 'web') {
      const hex = tokenHash.toString('hex');
      for (const index of [
        memberIndexKey(session.accountId, session.tenantId),
        accountIndexKey(session.accountId),
      ]) {
        transaction.sadd(index, hex).expire(index, INDEX_SECONDS);
      }
    }
    await this.safely('write', () => transaction.exec());
  }

  private async dropIndexed(indexKey: string): Promise<void> {
    await this.safely('invalidate', async () => {
      const hashes = await this.redis.smembers(indexKey);
      const keys = hashes.map((hex) => `${KEY_PREFIX}:${hex}`);
      await this.redis.del(indexKey, ...keys);
    });
  }

  /**
   * Runs a cache command; if Redis fails, logs `session_cache_unavailable` and carries on with
   * Postgres. A failed invalidation leaves an entry for at most `SESSION_CACHE_SECONDS`.
   */
  private async safely<T>(operation: string, command: () => Promise<T>): Promise<T | undefined> {
    try {
      return await command();
    } catch (error) {
      this.logger.warn(
        { metric: 'session_cache_unavailable', operation, error: errorForLog(error) },
        'Session cache skipped: Redis did not answer',
      );
      return undefined;
    }
  }
}

function toRequestAuth(session: CachedSession, tokenHash: Buffer): RequestAuth {
  if (session.kind === 'support') {
    return {
      kind: 'support',
      via: 'cookie',
      stage: 'active',
      supportSessionId: session.supportSessionId,
      platformUserId: session.platformUserId,
      tenantId: session.tenantId,
      tokenHash,
    };
  }
  return {
    kind: 'web',
    via: 'cookie',
    sessionId: session.sessionId,
    accountId: session.accountId,
    stage: session.stage,
    tenantId: session.tenantId,
    userId: session.userId,
    previewRoleId: session.previewRoleId,
    previewSampleUserId: session.previewSampleUserId,
    supportSessionId: session.supportSessionId,
    tokenHash,
  };
}
