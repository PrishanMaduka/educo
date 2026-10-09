import { Inject, Injectable } from '@nestjs/common';
import { uuidv7 } from '@quad/db';
import { firstNameOf, sessionExpiry } from '@quad/domain';

import { AuditService } from '../../../common/audit/audit.service';
import { formatMessage } from '../../../common/delivery/templates/render';
import { ForbiddenError, UnauthorizedError, ValidationError } from '../../../common/errors';
import { BearerSessions } from '../../../common/session/bearer-sessions';
import { FamilyRepository } from '../../../common/session/family.repository';
import { SessionRepository } from '../../../common/session/session.repository';
import { CLOCK, TENANT_DB } from '../../../tokens';
import { AuthRepository } from '../auth.repository';
import { MembershipsService } from '../memberships.service';

import { ParentTokens } from './parent-tokens';

import type { BearerAuth } from '../../../common/session/request-auth';
import type { Clock } from '../../../tokens';
import type { ParentAuthMembership } from '../memberships.service';
import type { SelectSchoolInput, SelectSchoolTokens, TokenPair } from '@quad/contracts';
import type { AccountTx, QuadTenantDb } from '@quad/db';

/** The device a parent signs in on: request facts only, never a source of the tenant. */
export interface TokenClient {
  readonly ip: string;
  readonly userAgent: string | null;
}

/**
 * The parent app's refresh families (spec 05 Parent app steps 4, 5 and 7; D32): a mobile
 * `sessions` row of the account that opens in a school after the code (or waits 5 minutes for
 * the school picker, OQ20), moves to the chosen or switched school, and is revoked on sign-out.
 * Only guardian and relative memberships of the account itself are ever entered (the kind
 * rule). Refreshing is `RefreshService`.
 */
@Injectable()
export class TokenService {
  constructor(
    @Inject(TENANT_DB) private readonly db: QuadTenantDb,
    private readonly repository: AuthRepository,
    private readonly families: FamilyRepository,
    private readonly sessionRows: SessionRepository,
    private readonly bearer: BearerSessions,
    private readonly memberships: MembershipsService,
    private readonly tokens: ParentTokens,
    private readonly audit: AuditService,
    @Inject(CLOCK) private readonly now: Clock,
  ) {}

  /** After the code, with one open school: a new family there and its first pair. */
  async openFamily(
    accountId: string,
    membership: ParentAuthMembership,
    client: TokenClient,
  ): Promise<{ readonly pair: TokenPair; readonly firstName: string }> {
    const now = new Date(this.now());
    const sessionId = uuidv7();
    const refresh = this.tokens.first(sessionId);
    const name = await this.repository.inAccount(accountId, membership.tenantId, async (tx) => {
      const memberName = await this.enterSchoolIn(tx, accountId, membership, client.ip, now, {
        switching: false,
      });
      await this.families.insertFamilyIn(tx, {
        id: sessionId,
        accountId,
        stage: 'active',
        tenantId: membership.tenantId,
        userId: membership.userId,
        refreshHash: refresh.secretHash,
        ip: client.ip,
        userAgent: client.userAgent,
        at: now,
        expiresAt: sessionExpiry({ kind: 'refresh_family', createdAt: now, now }).expiresAt,
      });
      return memberName;
    });
    const accessToken = await this.tokens.accessToken(accountId, membership, sessionId);
    return { pair: { accessToken, refreshToken: refresh.token }, firstName: firstNameOf(name) };
  }

  /**
   * After the code, with several schools (or a lone suspended one): a family waiting 5 minutes
   * for the school picker, and its `select_school` token (OQ20).
   */
  async awaitChoice(accountId: string, client: TokenClient): Promise<string> {
    const now = new Date(this.now());
    const sessionId = uuidv7();
    const { expiresAt } = sessionExpiry({ kind: 'select_school', startedAt: now, now });
    await this.repository.inAccount(accountId, null, (tx) =>
      this.families.insertFamilyIn(tx, {
        id: sessionId,
        accountId,
        stage: 'choose_school',
        tenantId: null,
        userId: null,
        refreshHash: null,
        ip: client.ip,
        userAgent: client.userAgent,
        at: now,
        expiresAt,
      }),
    );
    return this.tokens.selectSchoolToken(accountId, sessionId, expiresAt);
  }

  /**
   * `POST /auth/select-school` with a bearer token. Only one of the account's own guardian or
   * relative memberships, never a staff one, another account's or a suspended school's; a
   * refusal leaves the family as it was. The first choice, with the `select_school` token, opens
   * the family in that school with its first refresh token (OQ20). A switch with a school token
   * (spec 05 "Switch school"; Task 9 fix round 1) moves the family and returns only the new
   * school's access token: the refresh token is not replaced, so no second credential exists,
   * and it refreshes into the new school from then on. The current school is 400.
   */
  async selectSchool(
    auth: BearerAuth,
    input: SelectSchoolInput,
    ip: string,
  ): Promise<SelectSchoolTokens> {
    if (auth.stage === 'active' && auth.tenantId === input.tenantId) {
      throw new ValidationError({ tenantId: formatMessage('error.alreadyInSchool') });
    }
    const memberships = await this.memberships.parentMemberships(auth.accountId);
    const membership = memberships.find((candidate) => candidate.tenantId === input.tenantId);
    if (membership === undefined) {
      throw new ForbiddenError('forbidden', formatMessage('error.notYourSchool'));
    }
    if (membership.suspended) {
      throw new ForbiddenError(
        'school_suspended',
        membership.suspendReason ?? formatMessage('error.schoolSuspended'),
      );
    }
    const now = new Date(this.now());
    const switching = auth.stage === 'active';
    const refreshToken = await this.repository.inAccount(
      auth.accountId,
      membership.tenantId,
      async (tx) => {
        const family = await this.families.lockFamilyIn(tx, auth.sessionId);
        if (family === null || family.stage !== auth.stage || family.tenantId !== auth.tenantId) {
          throw new UnauthorizedError();
        }
        await this.enterSchoolIn(tx, auth.accountId, membership, ip, now, { switching });
        if (!switching) return this.tokens.moveIn(tx, family, membership, now);
        const moved = await this.families.switchSchoolIn(tx, family.id, family.generation, {
          tenantId: membership.tenantId,
          userId: membership.userId,
          at: now,
        });
        if (!moved) throw new UnauthorizedError();
        return null;
      },
    );
    await this.bearer.invalidateFamily(auth.sessionId);
    // A switch keeps the presenting token's expiry (N1): a stolen token cannot be kept alive
    // by switching back and forth. The first choice opens the family with a fresh 15 minutes.
    const accessToken = await this.tokens.accessToken(
      auth.accountId,
      membership,
      auth.sessionId,
      refreshToken === null ? auth.expiresAt : undefined,
    );
    return refreshToken === null ? { accessToken } : { accessToken, refreshToken };
  }

  /**
   * `POST /auth/sign-out` with a bearer token (spec 05 step 7): revokes this device's family,
   * and audits `auth.sign_out` in its school when it is in one.
   */
  async signOut(auth: BearerAuth, ip: string): Promise<void> {
    const { tenantId, userId } = auth;
    await this.repository.inAccount(auth.accountId, tenantId, async (tx) => {
      const revoked = await this.sessionRows.revokeIn(tx, auth.accountId, auth.sessionId);
      if (revoked === undefined || tenantId === null) return;
      await this.audit.record(
        { tx, tenantId, userId, supportSessionId: null, platformUserId: null, ip },
        'auth.sign_out',
        { type: 'session', id: auth.sessionId },
      );
    });
    await this.bearer.invalidateFamily(auth.sessionId);
  }

  /**
   * Enters `membership`'s school in the transaction scoped to the account and that school: the
   * school must be open, the membership there and the account active; the sign-in is recorded
   * on both and audited as `auth.sign_in` with `method: 'otp'`. Returns the member's name.
   */
  private async enterSchoolIn(
    tx: AccountTx,
    accountId: string,
    membership: ParentAuthMembership,
    ip: string,
    now: Date,
    options: { readonly switching: boolean },
  ): Promise<string> {
    const profile = await this.db.definers.currentTenantProfile(tx);
    if (profile === null || profile.status === 'deleted') {
      throw new ForbiddenError('forbidden', formatMessage('error.notYourSchool'));
    }
    if (profile.status === 'suspended') {
      throw new ForbiddenError(
        'school_suspended',
        profile.suspendReason ?? formatMessage('error.schoolSuspended'),
      );
    }
    const name = await this.repository.memberSignedInIn(tx, membership.userId, now);
    const account = await this.repository.accountIn(tx, accountId);
    if (account === null || account.status !== 'active') throw new UnauthorizedError();
    if (name === null) throw new ForbiddenError('forbidden', formatMessage('error.notYourSchool'));
    await this.repository.signedInIn(tx, accountId, now);
    await this.audit.record(
      {
        tx,
        tenantId: membership.tenantId,
        userId: membership.userId,
        supportSessionId: null,
        platformUserId: null,
        ip,
      },
      'auth.sign_in',
      { type: 'user', id: membership.userId },
      { method: 'otp', switchedSchool: options.switching },
    );
    return name;
  }
}
