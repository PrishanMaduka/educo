import { Injectable } from '@nestjs/common';
import { platformAudit } from '@quad/db';

import type { AuditMeta, AuditTarget, PlatformAuditAction } from '../../common/audit/audit-actions';
import type { PlatformTx } from '@quad/db';

/** One console action (spec 05 → Audit, spec 07 Audit log). */
export interface PlatformAuditEntry {
  /** Null for a scheduled platform job. */
  readonly actorPlatformUserId: string | null;
  readonly action: PlatformAuditAction;
  readonly target: AuditTarget | null;
  /** The school the action was about, if any. */
  readonly tenantId?: string | null;
  readonly ip?: string | null;
  readonly userAgent?: string | null;
  readonly meta?: AuditMeta;
}

/**
 * Writes `platform_audit`. Every write through `withPlatform` records one entry with the
 * transaction that makes it, so both commit or roll back together (spec 02, D17). Only
 * `src/platform/**` and `src/worker/platform-jobs/**` use it.
 */
@Injectable()
export class PlatformAuditService {
  async record(tx: PlatformTx, entry: PlatformAuditEntry): Promise<void> {
    await tx.insert(platformAudit).values({
      actorPlatformUserId: entry.actorPlatformUserId,
      action: entry.action,
      targetType: entry.target?.type ?? null,
      targetId: entry.target?.id ?? null,
      tenantId: entry.tenantId ?? null,
      ip: entry.ip ?? null,
      userAgent: entry.userAgent ?? null,
      meta: entry.meta ?? {},
    });
  }
}
