import { Inject, Injectable } from '@nestjs/common';
import { IdSchema, ParentMembershipKind } from '@quad/contracts';
import { sessionExpiry } from '@quad/domain';
import { z } from 'zod';

import { CLOCK, LOGGER, REDIS } from '../../tokens';

import { FamilyRepository } from './family.repository';
import {
  INDEX_SECONDS,
  Instant,
  SESSION_CACHE_SECONDS,
  accountIndexKey,
  cacheSafely,
  familyKey,
  familyMember,
  memberIndexKey,
} from './session-cache';
import { SessionRepository } from './session.repository';

import type { Family } from './family.repository';
import type { BearerAuth } from './request-auth';
import type { Clock } from '../../tokens';
import type { BearerClaims } from '@quad/contracts';
import type { Redis } from 'ioredis';
import type { Logger } from 'pino';

/**
 * What is cached per parent refresh family (D32): its school and membership after the checks
 * passed, and when it ends. A bearer token is accepted only while its claims match this.
 */
const CachedFamily = z.object({
  sessionId: IdSchema,
  accountId: IdSchema,
  stage: z.enum(['choose_school', 'active']),
  tenantId: IdSchema.nullable(),
  userId: IdSchema.nullable(),
  membershipKind: ParentMembershipKind.nullable(),
  createdAt: Instant,
  expiresAt: Instant,
});
type CachedFamily = z.output<typeof CachedFamily>;

/**
 * The parent app's bearer tokens (spec 05; D32): resolves verified claims to a `BearerAuth`
 * through the token's refresh family, with the same 30 s Redis cache and index sets as cookie
 * sessions, so `invalidateMember` and `invalidateAccount` drop families too.
 */
@Injectable()
export class BearerSessions {
  constructor(
    private readonly families: FamilyRepository,
    private readonly schools: SessionRepository,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(CLOCK) private readonly now: Clock,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  /**
   * The parent app's token (spec 05; D32): its refresh family must be live, not past its 60 days
   * (or, while choosing, its 5 minutes), and match the claims exactly: the same account, and
   * for a school token the same school, membership and kind, which must still be an active
   * guardian or relative membership of a school that is not deleted. Null otherwise (401).
   */
  async resolveBearer(claims: BearerClaims): Promise<BearerAuth | null> {
    const family =
      (await this.readFamilyCache(claims.sid)) ?? (await this.loadFamily(claims.acc, claims.sid));
    if (family === null) return null;
    const now = new Date(this.now());
    if (familyExpired(family, now)) {
      await this.invalidateFamily(claims.sid);
      return null;
    }
    return bearerAuthOf(family, claims);
  }

  /** Drops one refresh family's cache entry (refresh reuse, select-school, sign-out). */
  async invalidateFamily(sessionId: string): Promise<void> {
    await cacheSafely(this.logger, 'invalidate', () => this.redis.del(familyKey(sessionId)));
  }

  /** Reads Postgres on a cache miss, checks the school and membership, and caches the result. */
  private async loadFamily(accountId: string, sessionId: string): Promise<CachedFamily | null> {
    const family = await this.families.family(accountId, sessionId);
    if (family === null) return null;
    const membershipKind = await this.liveParentKind(accountId, family);
    if (membershipKind === undefined) return null;
    const cached: CachedFamily = {
      sessionId: family.id,
      accountId,
      stage: family.stage,
      tenantId: family.tenantId,
      userId: family.userId,
      membershipKind,
      createdAt: family.createdAt,
      expiresAt: family.expiresAt,
    };
    await this.writeFamilyCache(cached);
    return cached;
  }

  /**
   * The kind of the family's membership when it is a live guardian or relative membership of
   * the account in a school that is not deleted; null while choosing; undefined when refused.
   */
  private async liveParentKind(
    accountId: string,
    family: Family,
  ): Promise<ParentMembershipKind | null | undefined> {
    if (family.stage === 'choose_school') return null;
    if (family.tenantId === null || family.userId === null) return undefined;
    const { member, profile } = await this.schools.school(family.tenantId, family.userId);
    if (
      member === null ||
      member.accountId !== accountId ||
      member.status !== 'active' ||
      member.deleted ||
      profile === null ||
      profile.status === 'deleted'
    ) {
      return undefined;
    }
    const kind = ParentMembershipKind.safeParse(member.kind);
    return kind.success ? kind.data : undefined;
  }

  private async readFamilyCache(sessionId: string): Promise<CachedFamily | null> {
    const raw = await cacheSafely(this.logger, 'read', () => this.redis.get(familyKey(sessionId)));
    if (typeof raw !== 'string') return null;
    try {
      const parsed = CachedFamily.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  private async writeFamilyCache(family: CachedFamily): Promise<void> {
    const transaction = this.redis
      .multi()
      .set(familyKey(family.sessionId), JSON.stringify(family), 'EX', SESSION_CACHE_SECONDS);
    for (const index of [
      memberIndexKey(family.accountId, family.tenantId),
      accountIndexKey(family.accountId),
    ]) {
      transaction.sadd(index, familyMember(family.sessionId)).expire(index, INDEX_SECONDS);
    }
    await cacheSafely(this.logger, 'write', () => transaction.exec());
  }
}

/** A family ends at its row's expiry, and an active one 60 days after it was created. */
function familyExpired(family: CachedFamily, now: Date): boolean {
  if (now.getTime() >= family.expiresAt.getTime()) return true;
  return (
    family.stage === 'active' &&
    sessionExpiry({ kind: 'refresh_family', createdAt: family.createdAt, now }).expired
  );
}

/** The request's auth when the token's claims match its family exactly; null otherwise. */
function bearerAuthOf(family: CachedFamily, claims: BearerClaims): BearerAuth | null {
  if (family.accountId !== claims.acc) return null;
  const matches =
    claims.scope === 'select_school'
      ? family.stage === 'choose_school'
      : family.stage === 'active' &&
        family.tenantId === claims.tid &&
        family.userId === claims.sub &&
        family.membershipKind === claims.kind;
  if (!matches) return null;
  return {
    kind: 'mobile',
    via: 'bearer',
    sessionId: family.sessionId,
    accountId: family.accountId,
    stage: family.stage,
    tenantId: family.tenantId,
    userId: family.userId,
    membershipKind: family.membershipKind,
  };
}
