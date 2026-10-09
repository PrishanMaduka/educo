import { Inject, Injectable } from '@nestjs/common';

import { AuditService } from '../../common/audit/audit.service';
import { ForbiddenError } from '../../common/errors';
import { SessionRepository } from '../../common/session/session.repository';
import { SessionService } from '../../common/session/session.service';
import { CONFIG, PASSWORD_RESETS, TENANT_DB } from '../../tokens';

import { AuthRepository } from './auth.repository';
import { passwordResetJobIds } from './password-reset-requests';

import type { PasswordResetRequests } from './password-reset-requests';
import type { RequestAuth } from '../../common/session/request-auth';
import type { Config } from '../../config';
import type { IdentifyResult, SignInMethod } from '@quad/contracts';
import type { QuadTenantDb } from '@quad/db';

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
    private readonly audit: AuditService,
    @Inject(PASSWORD_RESETS) private readonly passwordResets: PasswordResetRequests,
    @Inject(CONFIG) config: Config,
  ) {
    this.resetJobId = passwordResetJobIds(config.SESSION_SECRET);
  }

  private readonly resetJobId: (email: string) => string;

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
   * `POST /auth/password/forgot`: queues exactly one job for the address, known or not, keyed by
   * the HMAC of the email, and looks nothing up; the worker finds the account and sends the link
   * (OQ8: no school in it). The caller answers 202 either way.
   */
  async forgot(email: string): Promise<void> {
    await this.passwordResets.request({ jobId: this.resetJobId(email), email });
  }
}
