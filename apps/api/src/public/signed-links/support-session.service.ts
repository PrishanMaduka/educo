import { Inject, Injectable } from '@nestjs/common';

import { AuditService } from '../../common/audit/audit.service';
import { SignedLinks } from '../../common/crypto/signed-links';
import { InvalidLinkError } from '../../common/errors';
import { hashSessionToken, newSessionToken } from '../../common/session/cookies';
import { CsrfTokens } from '../../common/session/csrf';
import { SessionService } from '../../common/session/session.service';
import { CLOCK, TENANT_DB } from '../../tokens';

import type { Clock } from '../../tokens';
import type { QuadTenantDb } from '@quad/db';

/** The staff cookies a redeemed visit gets, ending when the visit does. */
export interface SupportCookies {
  readonly token: string;
  readonly csrf: string;
  readonly maxAgeSeconds: number;
}

/**
 * The staff portal's half of a support visit (spec 05 → Support access; D16, R-support-token).
 *
 * Redeeming: the `support_session` link is verified and used up (`verifyLink`: signature,
 * purpose, 2-minute expiry, single use), a new cookie is made and only its SHA-256 is stored on
 * the visit by `redeem_support_session` (once; never for an ended or expired visit), then the
 * visit is resolved like any cookie, so its school comes from `support_sessions` itself, which
 * must be the school the link names. Only then is `withTenant` opened, to write
 * `support_session.started` in the school's audit log.
 *
 * Ending ("Exit to platform", or Sign out in a visit): `end_support_session` ends the visit the
 * cookie names, once, writing `platform_audit`; the school's `support_session.ended` follows,
 * only when a visit was ended now, in the school that visit belongs to. The cookie's cache entry
 * is dropped, so the old cookie is refused at once.
 */
@Injectable()
export class SupportSessionService {
  constructor(
    private readonly links: SignedLinks,
    private readonly sessions: SessionService,
    private readonly csrf: CsrfTokens,
    private readonly audit: AuditService,
    @Inject(TENANT_DB) private readonly db: QuadTenantDb,
    @Inject(CLOCK) private readonly now: Clock,
  ) {}

  /** `POST /auth/support-session`: every refusal is 400 `invalid_link`, naming no school. */
  async redeem(link: string, ip: string): Promise<SupportCookies> {
    const now = new Date(this.now());
    const payload = await this.links.verifyLink(link, 'support_session', now);
    const token = newSessionToken();
    const tokenHash = hashSessionToken(token);
    const redeemed = await this.db.definers.redeemSupportSession(payload.sub, tokenHash);
    if (redeemed === null) throw new InvalidLinkError();
    const auth = await this.sessions.resolve(tokenHash);
    if (auth?.kind !== 'support' || auth.tenantId !== payload.tid) {
      // The school was deleted meanwhile, or the link and the visit disagree: never leave a
      // redeemed visit behind that nobody can use or end.
      await this.end(tokenHash, ip);
      throw new InvalidLinkError();
    }
    await this.db.withTenant(auth.tenantId, (tx) =>
      this.audit.recordVisitBoundary(
        {
          tx,
          tenantId: auth.tenantId,
          supportSessionId: auth.supportSessionId,
          platformUserId: auth.platformUserId,
          ip,
        },
        'support_session.started',
      ),
    );
    const secondsLeft = Math.floor((auth.expiresAt.getTime() - now.getTime()) / 1000);
    return { token, csrf: this.csrf.tokenFor(tokenHash), maxAgeSeconds: Math.max(secondsLeft, 0) };
  }

  /**
   * Ends the visit whose cookie hashes to `tokenHash`: true when one was ended now, false when
   * there was none to end (already ended, or not a visit's cookie).
   */
  async end(tokenHash: Buffer, ip: string): Promise<boolean> {
    const ended = await this.db.definers.endSupportSession(tokenHash);
    await this.sessions.invalidateToken(tokenHash);
    if (ended === null) return false;
    await this.db.withTenant(ended.tenantId, (tx) =>
      this.audit.recordVisitBoundary(
        {
          tx,
          tenantId: ended.tenantId,
          supportSessionId: ended.supportSessionId,
          platformUserId: ended.platformUserId,
          ip,
        },
        'support_session.ended',
      ),
    );
    return true;
  }
}
