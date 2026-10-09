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
 * makes the change, so the entry commits or rolls back with it. In a support visit (a
 * `platformUserId` with its `supportSessionId`) the entry names the Quad staff member and the visit, and `record_support_audit` writes the same action
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
    // A support visit is a Quad staff member acting through a visit; anyone else is the member
    // (or a system job), so a row always names who acted.
    if (ctx.platformUserId !== null && ctx.supportSessionId === null) {
      throw new Error('A Quad staff member acts in a school only through a support visit.');
    }
    const support =
      ctx.platformUserId === null || ctx.supportSessionId === null
        ? null
        : { platformUserId: ctx.platformUserId, supportSessionId: ctx.supportSessionId };
    await this.insert(ctx, support, action, target, meta);
    if (support !== null) {
      await this.db.definers.recordSupportAudit(ctx.tx, {
        supportSessionId: support.supportSessionId,
        action,
        targetType: target?.type ?? null,
        targetId: target?.id ?? null,
        meta,
      });
    }
  }

  /**
   * The school's entry for a support visit starting (its link redeemed) or ending ("Exit to
   * platform", sign-out): it names the Quad staff member and the visit like any support entry,
   * but writes no `platform_audit` copy, because the console's own entry already records it once
   * (`support_session.started` when the link is made, `support_session.ended` by
   * `end_support_session`). The visit may already have ended, so `record_support_audit` would
   * refuse it anyway.
   */
  async recordVisitBoundary(
    ctx: Omit<AuditContext, 'userId'> & {
      readonly supportSessionId: string;
      readonly platformUserId: string;
    },
    action: Extract<AuditAction, 'support_session.started' | 'support_session.ended'>,
  ): Promise<void> {
    await this.insert(
      { ...ctx, userId: null },
      { platformUserId: ctx.platformUserId, supportSessionId: ctx.supportSessionId },
      action,
      { type: 'support_session', id: ctx.supportSessionId },
      {},
    );
  }

  private async insert(
    ctx: AuditContext,
    support: { readonly platformUserId: string; readonly supportSessionId: string } | null,
    action: AuditAction,
    target: AuditTarget | null,
    meta: AuditMeta,
  ): Promise<void> {
    await ctx.tx.insert(auditLog).values({
      tenantId: ctx.tenantId,
      actorUserId: support === null ? ctx.userId : null,
      actorPlatformUserId: support?.platformUserId ?? null,
      supportSessionId: support?.supportSessionId ?? null,
      action,
      targetType: target?.type ?? null,
      targetId: target?.id ?? null,
      meta,
      ip: ctx.ip,
    });
  }
}
