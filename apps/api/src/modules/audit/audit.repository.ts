import { Injectable } from '@nestjs/common';
import { and, auditLog, desc, eq, sql } from '@quad/db';

import { instantText, olderThan } from '../../common/pagination/instant-keyset';

import type { InstantKeyset } from '../../common/pagination/instant-keyset';
import type { AuditLogQuery } from '@quad/contracts';
import type { TenantTx } from '@quad/db';

/** The filters of Settings → Audit (spec 08): who, which action, and when. */
export type AuditFilters = Pick<AuditLogQuery, 'actor' | 'action' | 'from' | 'to'>;

/** One `audit_log` entry, with the names its line and its actor show. */
export interface AuditRow {
  readonly id: string;
  readonly at: Date;
  /** `at` with microseconds, for the next page's keyset. */
  readonly keysetAt: string;
  readonly action: string;
  readonly actorUserId: string | null;
  readonly actorName: string | null;
  readonly supportSessionId: string | null;
  readonly targetType: string | null;
  readonly targetId: string | null;
  /** The target member's or role's current name; null for other targets or a deleted role. */
  readonly targetName: string | null;
  readonly meta: unknown;
  readonly ip: string | null;
}

const COLUMNS = {
  id: auditLog.id,
  at: auditLog.at,
  keysetAt: instantText(auditLog.at),
  action: auditLog.action,
  actorUserId: auditLog.actorUserId,
  // Subqueries on the primary keys, inside the same RLS: never another school's member or role.
  actorName: sql<string | null>`(select u.name from users u where u.id = ${auditLog.actorUserId})`,
  supportSessionId: auditLog.supportSessionId,
  targetType: auditLog.targetType,
  targetId: auditLog.targetId,
  targetName: sql<string | null>`case ${auditLog.targetType}
    when 'user' then (select u.name from users u where u.id = ${auditLog.targetId})
    when 'role' then (select r.name from roles r where r.id = ${auditLog.targetId})
  end`,
  meta: auditLog.meta,
  ip: sql<string | null>`host(${auditLog.ip})`,
} as const;

function matching(filters: AuditFilters) {
  return and(
    filters.actor === undefined ? undefined : eq(auditLog.actorUserId, filters.actor),
    filters.action === undefined ? undefined : eq(auditLog.action, filters.action),
    // As text, so an instant keeps its microseconds (a JS Date would drop them).
    filters.from === undefined ? undefined : sql`${auditLog.at} >= ${filters.from}::timestamptz`,
    filters.to === undefined ? undefined : sql`${auditLog.at} < ${filters.to}::timestamptz`,
  );
}

/**
 * The school's audit log, read inside the caller's `withTenant` transaction: RLS keeps every
 * query to the session's school. Newest first, then by id. It loads; it never decides.
 */
@Injectable()
export class AuditRepository {
  /** A page after `after`, with one extra row telling the caller there is more. */
  page(
    tx: TenantTx,
    filters: AuditFilters,
    after: InstantKeyset | null,
    limit: number,
  ): Promise<AuditRow[]> {
    return tx
      .select(COLUMNS)
      .from(auditLog)
      .where(and(matching(filters), olderThan(auditLog.at, auditLog.id, after)))
      .orderBy(desc(auditLog.at), desc(auditLog.id))
      .limit(limit + 1);
  }

  /** Every matching entry, up to `max + 1` (so the caller can tell there are more than `max`). */
  all(tx: TenantTx, filters: AuditFilters, max: number): Promise<AuditRow[]> {
    return tx
      .select(COLUMNS)
      .from(auditLog)
      .where(matching(filters))
      .orderBy(desc(auditLog.at), desc(auditLog.id))
      .limit(max + 1);
  }
}
