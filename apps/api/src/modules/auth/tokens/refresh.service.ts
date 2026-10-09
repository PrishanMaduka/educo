import { Inject, Injectable } from '@nestjs/common';
import { refreshOutcome } from '@quad/domain';

import { AuditService } from '../../../common/audit/audit.service';
import { RateLimitedError, UnauthorizedError } from '../../../common/errors';
import { RateLimitService } from '../../../common/rate-limit/rate-limit.service';
import { BearerSessions } from '../../../common/session/bearer-sessions';
import { FamilyRepository } from '../../../common/session/family.repository';
import { SessionRepository } from '../../../common/session/session.repository';
import { errorForLog } from '../../../observability/logger';
import { CLOCK, LOGGER, TENANT_DB } from '../../../tokens';
import { AuthRepository } from '../auth.repository';
import { isParentKind } from '../memberships.service';

import { ParentTokens } from './parent-tokens';
import { isCurrentSecret } from './refresh-token';

import type { TokenMembership } from './parent-tokens';
import type { LockedFamily } from '../../../common/session/family.repository';
import type { Clock } from '../../../tokens';
import type { TokenPair } from '@quad/contracts';
import type { AccountTx, QuadTenantDb } from '@quad/db';
import type { Logger } from 'pino';

/**
 * Refreshes per family (Task 9 fix round 1): the route is outside the per-IP sign-in bucket,
 * so a family that refreshes in a loop is held to 10 a minute instead. A healthy app refreshes
 * once per 15-minute access token.
 */
export const REFRESH_FAMILY_LIMIT = { limit: 10, windowSeconds: 60 } as const;

/** How a refresh ended inside its transaction (the 401 is thrown only after the commit). */
type RefreshResult =
  | { readonly outcome: 'rotated'; readonly token: string; readonly membership: TokenMembership }
  | { readonly outcome: 'reused'; readonly family: LockedFamily }
  | { readonly outcome: 'refused' };

/**
 * `POST /auth/refresh` (spec 05 Parent app step 5; D32): a matching generation rotates, an older
 * one revokes the whole family, and a family lives 60 days from its creation.
 */
@Injectable()
export class RefreshService {
  constructor(
    @Inject(TENANT_DB) private readonly db: QuadTenantDb,
    private readonly repository: AuthRepository,
    private readonly families: FamilyRepository,
    private readonly sessionRows: SessionRepository,
    private readonly bearer: BearerSessions,
    private readonly tokens: ParentTokens,
    private readonly audit: AuditService,
    private readonly limits: RateLimitService,
    @Inject(CLOCK) private readonly now: Clock,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  /**
   * The family is found by its id (`refresh_family`, the only lookup before the account is
   * known) and locked, so two refreshes run one after the other. `refreshOutcome` decides:
   * rotate (while the membership is still live), refuse, or reuse, which revokes the whole family
   * and is audited in its school after the commit; both of the last two answer 401.
   */
  async refresh(refreshToken: string): Promise<TokenPair> {
    const presented = this.tokens.read(refreshToken);
    // A forged token never reaches the limit or the database: its family id is not trusted.
    if (!presented.issued) throw new UnauthorizedError();
    await this.countRefresh(presented.sessionId);
    const owner = await this.db.definers.refreshFamily(presented.sessionId);
    if (owner === null) throw new UnauthorizedError();
    const now = new Date(this.now());
    const result = await this.repository.inAccount(
      owner.accountId,
      owner.tenantId,
      async (tx): Promise<RefreshResult> => {
        const family = await this.families.lockFamilyIn(tx, presented.sessionId);
        if (family?.stage !== 'active' || family.tenantId !== owner.tenantId) {
          return { outcome: 'refused' };
        }
        const outcome = refreshOutcome({
          currentGeneration: family.generation,
          presentedGeneration: presented.generation,
          secretIsCurrent: isCurrentSecret(family.refreshHash, presented.secretHash),
          issued: presented.issued,
          familyCreatedAt: family.createdAt,
          now,
        });
        if (outcome === 'reuse') {
          await this.sessionRows.revokeIn(tx, owner.accountId, family.id);
          return { outcome: 'reused', family };
        }
        if (outcome === 'refuse') return { outcome: 'refused' };
        const membership = await this.liveMembershipIn(tx, owner.accountId, family);
        if (membership === null) return { outcome: 'refused' };
        const token = await this.tokens.moveIn(tx, family, membership, now);
        return { outcome: 'rotated', token, membership };
      },
    );
    if (result.outcome === 'reused') {
      await this.bearer.invalidateFamily(presented.sessionId);
      this.logger.warn(
        { metric: 'refresh_token_reused' },
        'A rotated-out refresh token came back; its family is revoked',
      );
      await this.auditReuse(owner.accountId, result.family);
    }
    if (result.outcome !== 'rotated') throw new UnauthorizedError();
    const accessToken = await this.tokens.accessToken(
      owner.accountId,
      result.membership,
      presented.sessionId,
    );
    return { accessToken, refreshToken: result.token };
  }

  /**
   * Counts one refresh of the family (`REFRESH_FAMILY_LIMIT`, keyed by the family id from a
   * token whose MAC was checked); 429 with `Retry-After` past it. Redis trouble fails open with
   * the metric `rate_limit_unavailable`, like every rate limit (D32).
   */
  private async countRefresh(sessionId: string): Promise<void> {
    let result: { allowed: boolean; retryAfter: number };
    try {
      result = await this.limits.hit(
        `refresh:${sessionId}`,
        REFRESH_FAMILY_LIMIT.limit,
        REFRESH_FAMILY_LIMIT.windowSeconds,
        this.now(),
      );
    } catch (error) {
      this.logger.warn(
        { metric: 'rate_limit_unavailable', error: errorForLog(error) },
        'Refresh limit skipped: Redis did not answer',
      );
      return;
    }
    if (!result.allowed) throw new RateLimitedError(result.retryAfter);
  }

  /** The family's membership while it is still the account's live guardian or relative one. */
  private async liveMembershipIn(
    tx: AccountTx,
    accountId: string,
    family: LockedFamily,
  ): Promise<TokenMembership | null> {
    if (family.tenantId === null || family.userId === null) return null;
    const member = await this.repository.tokenMemberIn(tx, family.userId);
    const profile = await this.db.definers.currentTenantProfile(tx);
    if (
      member === null ||
      member.accountId !== accountId ||
      member.status !== 'active' ||
      member.deleted ||
      !isParentKind(member.kind) ||
      profile === null ||
      profile.status === 'deleted'
    ) {
      return null;
    }
    return {
      tenantId: family.tenantId,
      userId: family.userId,
      kind: member.kind,
      roleNames: member.roleNames,
    };
  }

  /**
   * Audits a reuse as `auth.sign_in_failed` (reason `refresh_reused`) in the family's school,
   * after the revocation has committed: a failed audit is logged and never undoes it.
   */
  private async auditReuse(accountId: string, family: LockedFamily): Promise<void> {
    const { tenantId, userId } = family;
    if (tenantId === null) return;
    try {
      await this.repository.inAccount(accountId, tenantId, (tx) =>
        this.audit.record(
          { tx, tenantId, userId, supportSessionId: null, platformUserId: null, ip: null },
          'auth.sign_in_failed',
          { type: 'session', id: family.id },
          { reason: 'refresh_reused' },
        ),
      );
    } catch (error) {
      this.logger.warn(
        { metric: 'refresh_reuse_audit_failed', error: errorForLog(error) },
        'A refresh token reuse could not be audited',
      );
    }
  }
}
