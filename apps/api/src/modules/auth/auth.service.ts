import { createHash } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { SIGNED_LINK_RULES } from '@quad/domain';

import { AuditService } from '../../common/audit/audit.service';
import { SignedLinks } from '../../common/crypto/signed-links';
import { ForbiddenError } from '../../common/errors';
import { SessionRepository } from '../../common/session/session.repository';
import { SessionService } from '../../common/session/session.service';
import { CLOCK, CONFIG, DELIVERY, TENANT_DB } from '../../tokens';

import { AuthRepository } from './auth.repository';

import type { DeliveryQueue } from '../../common/delivery/delivery.service';
import type { RequestAuth } from '../../common/session/request-auth';
import type { Config } from '../../config';
import type { Clock } from '../../tokens';
import type { IdentifyResult, SignInMethod } from '@quad/contracts';
import type { QuadTenantDb } from '@quad/db';

/** The reset link's lifetime in minutes, for the email (spec 05 step 6: 30 minutes). */
const RESET_LINK_MINUTES = (SIGNED_LINK_RULES.password_reset.ttlSeconds ?? 0) / 60;

/**
 * The tenant-less staff auth routes that are not a sign-in step: identify, sign out and Forgot
 * password (spec 05 steps 1 and 6). None of them says whether an account exists.
 */
@Injectable()
export class AuthService {
  constructor(
    @Inject(TENANT_DB) private readonly db: QuadTenantDb,
    private readonly repository: AuthRepository,
    private readonly sessionRows: SessionRepository,
    private readonly sessions: SessionService,
    private readonly links: SignedLinks,
    private readonly audit: AuditService,
    @Inject(DELIVERY) private readonly delivery: DeliveryQueue,
    @Inject(CONFIG) private readonly config: Config,
    @Inject(CLOCK) private readonly now: Clock,
  ) {}

  /**
   * `POST /auth/identify`: the SSO buttons for the email's domain, then password. It reads the
   * schools' SSO settings only, never the account, so every address at one domain gets the same
   * answer (spec 05 step 1, Review Focus #1).
   */
  async identify(email: string): Promise<IdentifyResult> {
    const domain = email.slice(email.lastIndexOf('@') + 1);
    const sso = await this.db.definers.ssoMethodsForDomain(domain);
    const methods: SignInMethod[] = [
      ...(sso.google ? (['sso:google'] as const) : []),
      ...(sso.microsoft ? (['sso:microsoft'] as const) : []),
      'password',
    ];
    return { methods };
  }

  /**
   * `POST /auth/sign-out`: revokes this session, which is the person's session for every school
   * (spec 05), and audits `auth.sign_out` in the school it was in. A support visit leaves through
   * its own exit (Task 16).
   */
  async signOut(auth: RequestAuth, ip: string): Promise<void> {
    if (auth.kind !== 'web') throw new ForbiddenError();
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
    await this.sessions.invalidateToken(auth.tokenHash);
  }

  /**
   * `POST /auth/password/forgot`: for an active account, queues a single-use reset link with no
   * school in it (OQ8). The caller answers 202 either way.
   */
  async forgot(email: string): Promise<void> {
    const found = await this.db.definers.accountByIdentifier({ email });
    if (found === null || found.status !== 'active') return;
    const account = await this.repository.account(found.id);
    if (account === null || account.email === null) return;
    const token = this.links.signLink(
      { purpose: 'password_reset', tid: null, sub: found.id },
      new Date(this.now()),
    );
    await this.delivery.queueEmail({
      // The job id is in logs, so it carries a digest of the token, never the token.
      jobId: `password-reset.${createHash('sha256').update(token).digest('hex').slice(0, 40)}`,
      to: account.email,
      template: 'password_reset',
      params: {
        link: new URL(`/sign-in/reset/${token}`, this.config.PUBLIC_WEB_URL).href,
        minutes: RESET_LINK_MINUTES,
      },
    });
  }
}
