import { Inject, Injectable } from '@nestjs/common';

import { AuditService } from '../../common/audit/audit.service';
import { TENANT_DB } from '../../tokens';

import { MembershipsService } from './memberships.service';

import type { AuditAction, AuditMeta } from '../../common/audit/audit-actions';
import type { QuadTenantDb } from '@quad/db';

/**
 * Audits an account-level event (a failed sign-in, a password reset, a new authenticator) in
 * every school where the account is active staff, one `withTenant` per school (OQ11), each row
 * naming the person's membership there. An account with no staff school is audited nowhere.
 */
@Injectable()
export class AccountAudit {
  constructor(
    @Inject(TENANT_DB) private readonly db: QuadTenantDb,
    private readonly memberships: MembershipsService,
    private readonly audit: AuditService,
  ) {}

  async recordInStaffSchools(
    accountId: string,
    ip: string,
    action: AuditAction,
    meta: AuditMeta = {},
  ): Promise<void> {
    const memberships = await this.memberships.staffMemberships(accountId);
    for (const membership of memberships) {
      await this.db.withTenant(membership.tenantId, (tx) =>
        this.audit.record(
          {
            tx,
            tenantId: membership.tenantId,
            userId: membership.userId,
            supportSessionId: null,
            platformUserId: null,
            ip,
          },
          action,
          { type: 'account', id: accountId },
          meta,
        ),
      );
    }
  }
}
