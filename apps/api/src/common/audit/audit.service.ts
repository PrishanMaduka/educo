import { Inject, Injectable } from '@nestjs/common';
import { auditLog } from '@quad/db';

import { TENANT_DB } from '../../tokens';

import type { AuditAction, AuditMeta, AuditTarget } from './audit-actions';
import type { SchoolAuth } from '../session/request-auth';
import type { QuadTenantDb, TenantTx } from '@quad/db';

/**
 * Who did it, from the session: a member (`userId`), a Quad support visit (`supportSessionId`
 * and `platformUserId`), or neither for a system job. `ip` is the request's client address.
 */
export interface AuditActor {
  readonly tenantId: string;
  readonly userId: string | null;
  readonly supportSessionId: string | null;
  readonly platformUserId: string | null;
  readonly ip: string | null;
}

/** The transaction the change runs in, and who made it. */
export interface AuditContext extends AuditActor {
  readonly tx: TenantTx;
}

/** The actor of a request in a school. */
export function auditActorOf(school: SchoolAuth, ip: string | null): AuditActor {
  return {
    tenantId: school.tenantId,
    userId: school.userId,
    supportSessionId: school.supportSessionId,
    platformUserId: school.platformUserId,
    ip,
  };
}

/**
 * Writes a school's audit log (spec 05 → Audit). Call it with the `withTenant` transaction that
 * makes the change, so the entry commits or rolls back with it. In a support visit the entry
 * names the Quad staff member and the visit, and `record_support_audit` writes the same action
 * to `platform_audit` in the same transaction (spec 05, dual audit).
 */
@Injectable()
export class AuditService {
  constructor(@Inject(TENANT_DB) private readonly db: QuadTenantDb) {}

  async record(
    ctx: AuditContext,
    action: AuditAction,
    target: AuditTarget | null,
    meta: AuditMeta = {},
  ): Promise<void> {
    const inSupport = ctx.supportSessionId !== null;
    await ctx.tx.insert(auditLog).values({
      tenantId: ctx.tenantId,
      actorUserId: inSupport ? null : ctx.userId,
      actorPlatformUserId: inSupport ? ctx.platformUserId : null,
      supportSessionId: ctx.supportSessionId,
      action,
      targetType: target?.type ?? null,
      targetId: target?.id ?? null,
      meta,
      ip: ctx.ip,
    });
    if (ctx.supportSessionId !== null) {
      await this.db.definers.recordSupportAudit(ctx.tx, {
        supportSessionId: ctx.supportSessionId,
        action,
        targetType: target?.type ?? null,
        targetId: target?.id ?? null,
        meta,
      });
    }
  }
}
