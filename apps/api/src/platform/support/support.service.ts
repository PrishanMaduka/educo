import { Inject, Injectable } from '@nestjs/common';
import { supportVisitExpiresAt } from '@quad/domain';

import { SignedLinks } from '../../common/crypto/signed-links';
import { NotFoundError } from '../../common/errors';
import { CLOCK, CONFIG } from '../../tokens';
import { PlatformAuditService } from '../audit/platform-audit.service';
import { TenantsRepository } from '../tenants/tenants.repository';
import { PLATFORM_DB } from '../tokens';

import { SupportRepository } from './support.repository';

import type { Config } from '../../config';
import type { Clock } from '../../tokens';
import type { ConsoleAuth } from '../auth/console-auth';
import type { ConsoleClient } from '../auth/console-sign-in-failures';
import type { SupportSessionCreateInput, SupportSessionLink } from '@quad/contracts';
import type { QuadPlatformDb } from '@quad/db';

/** Where the staff portal redeems the link (`apps/staff` `/sign-in/support/[token]`). */
const LINK_PATH = '/sign-in/support/';

/**
 * "Open as school admin" (spec 05 → Support access; spec 06 `POST /platform/tenants/:id/support-
 * session`). Opens a reasoned visit to a school that still exists, lasting 60 minutes from now,
 * records `support_session.started` (with the reason, the console user's address and browser) in
 * `platform_audit` in the same transaction, and signs a single-use `support_session` link (2
 * minutes) naming the school and the visit. No `sessions` row is written (R-support-token): the
 * staff portal's redemption stores the cookie's hash on the visit itself.
 */
@Injectable()
export class SupportService {
  constructor(
    @Inject(PLATFORM_DB) private readonly db: QuadPlatformDb,
    private readonly tenants: TenantsRepository,
    private readonly repository: SupportRepository,
    private readonly audit: PlatformAuditService,
    private readonly links: SignedLinks,
    @Inject(CONFIG) private readonly config: Config,
    @Inject(CLOCK) private readonly now: Clock,
  ) {}

  async open(
    auth: ConsoleAuth,
    tenantId: string,
    input: SupportSessionCreateInput,
    client: ConsoleClient,
  ): Promise<SupportSessionLink> {
    const now = new Date(this.now());
    const visit = await this.db.withPlatform(async (tx) => {
      const school = await this.tenants.liveTenantId(tx, tenantId);
      if (school === null) throw new NotFoundError();
      const id = await this.repository.insert(tx, {
        platformUserId: auth.platformUserId,
        tenantId: school,
        reason: input.reason,
        startedAt: now,
        expiresAt: supportVisitExpiresAt(now),
      });
      await this.audit.record(tx, {
        actorPlatformUserId: auth.platformUserId,
        action: 'support_session.started',
        target: { type: 'support_session', id },
        tenantId: school,
        ip: client.ip,
        userAgent: client.userAgent,
        meta: { reason: input.reason },
      });
      return { id, tenantId: school };
    });
    // `tid` is the school row the database returned, never the path's id as typed.
    const token = this.links.signLink(
      { purpose: 'support_session', tid: visit.tenantId, sub: visit.id },
      now,
    );
    return { url: new URL(`${LINK_PATH}${token}`, this.config.PUBLIC_WEB_URL).href };
  }
}
