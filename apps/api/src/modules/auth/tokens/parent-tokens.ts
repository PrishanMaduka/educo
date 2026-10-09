import { createHash } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { sessionExpiry } from '@quad/domain';

import { AccessTokens } from '../../../common/crypto/access-tokens';
import { UnauthorizedError } from '../../../common/errors';
import { FamilyRepository } from '../../../common/session/family.repository';
import { CONFIG } from '../../../tokens';

import { RefreshTokens } from './refresh-token';

import type { IssuedRefreshToken, PresentedRefreshToken } from './refresh-token';
import type { LockedFamily } from '../../../common/session/family.repository';
import type { Config } from '../../../config';
import type { ParentMembershipKind } from '@quad/contracts';
import type { AccountTx } from '@quad/db';

/** What a school access token names: a guardian or relative membership in one school. */
export interface TokenMembership {
  readonly tenantId: string;
  readonly userId: string;
  readonly kind: ParentMembershipKind;
  readonly roleNames: readonly string[];
}

/**
 * The roles hash in a school token (`rh`, spec 05): the membership's role names, sorted and
 * hashed, so a role change shows in the next token. Not a secret.
 */
export function rolesHashOf(roleNames: readonly string[]): string {
  return createHash('sha256')
    .update(JSON.stringify([...roleNames].sort()))
    .digest('base64url')
    .slice(0, 22);
}

/**
 * Issues the parent app's tokens (D32): refresh tokens (`RefreshTokens`) and the moves of a
 * family to its next generation, and school access tokens (`AccessTokens`).
 */
@Injectable()
export class ParentTokens {
  private readonly refreshTokens: RefreshTokens;

  constructor(
    private readonly families: FamilyRepository,
    private readonly accessTokens: AccessTokens,
    @Inject(CONFIG) config: Config,
  ) {
    this.refreshTokens = new RefreshTokens(config.SESSION_SECRET);
  }

  /** A new family's first refresh token (generation 0). */
  first(sessionId: string): IssuedRefreshToken {
    return this.refreshTokens.issue(sessionId, 0);
  }

  read(refreshToken: string): PresentedRefreshToken {
    return this.refreshTokens.read(refreshToken);
  }

  /**
   * Moves the locked family into `membership`'s school at its next generation with a new secret
   * (a refresh, or a school chosen or switched); returns the new refresh token. Its 60 days still
   * count from the family's creation.
   */
  async moveIn(
    tx: AccountTx,
    family: LockedFamily,
    membership: Pick<TokenMembership, 'tenantId' | 'userId'>,
    now: Date,
  ): Promise<string> {
    const generation = family.generation + 1;
    const next = this.refreshTokens.issue(family.id, generation);
    const moved = await this.families.moveFamilyIn(tx, family.id, family.generation, {
      tenantId: membership.tenantId,
      userId: membership.userId,
      generation,
      refreshHash: next.secretHash,
      at: now,
      expiresAt: sessionExpiry({ kind: 'refresh_family', createdAt: family.createdAt, now })
        .expiresAt,
    });
    if (!moved) throw new UnauthorizedError();
    return next.token;
  }

  /** The 15-minute access token for `membership` in the family `sessionId`. */
  accessToken(accountId: string, membership: TokenMembership, sessionId: string): Promise<string> {
    return this.accessTokens.signTenant({
      membershipId: membership.userId,
      accountId,
      tenantId: membership.tenantId,
      kind: membership.kind,
      rolesHash: rolesHashOf(membership.roleNames),
      sessionId,
    });
  }

  /** The 5-minute token that only chooses a school (OQ20). */
  selectSchoolToken(accountId: string, sessionId: string, expiresAt: Date): Promise<string> {
    return this.accessTokens.signSelectSchool(accountId, sessionId, expiresAt);
  }
}
