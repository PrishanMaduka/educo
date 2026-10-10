import { Injectable } from '@nestjs/common';
import { and, asc, desc, eq, exists, platformAudit, platformUsers, sql } from '@quad/db';

import { instantText, olderThan } from '../../common/pagination/instant-keyset';

import type { InstantKeyset } from '../../common/pagination/instant-keyset';
import type { PlatformAuditLogQuery } from '@quad/contracts';
import type { PlatformTx } from '@quad/db';

/** The console Audit log's filters (spec 07): Quad staff member, school, action and time. */
export type PlatformAuditFilters = Pick<
  PlatformAuditLogQuery,
  'actor' | 'tenantId' | 'action' | 'from' | 'to'
>;

/** One `platform_audit` entry, with the names its line, actor and school show. */
export interface PlatformAuditRow {
  readonly id: string;
  readonly at: Date;
  /** `at` with microseconds, for the next page's keyset. */
  readonly keysetAt: string;
  readonly action: string;
  readonly actorPlatformUserId: string | null;
  readonly actorName: string | null;
  readonly tenantId: string | null;
  readonly schoolName: string | null;
  /** Copied from a school by a support visit (`record_support_audit` adds the visit's id). */
  readonly viaSupport: boolean;
  readonly targetType: string | null;
  readonly targetId: string | null;
  /** The target school's, Quad staff member's, member's or role's name, when it has one. */
  readonly targetName: string | null;
  readonly meta: unknown;
  readonly ip: string | null;
}

const COLUMNS = {
  id: platformAudit.id,
  at: platformAudit.at,
  keysetAt: instantText(platformAudit.at),
  action: platformAudit.action,
  actorPlatformUserId: platformAudit.actorPlatformUserId,
  actorName: sql<
    string | null
  >`(select p.name from platform_users p where p.id = ${platformAudit.actorPlatformUserId})`,
  tenantId: platformAudit.tenantId,
  schoolName: sql<
    string | null
  >`(select t.name from tenants t where t.id = ${platformAudit.tenantId})`,
  viaSupport: sql<boolean>`(${platformAudit.meta} ->> 'support_session_id') is not null`,
  targetType: platformAudit.targetType,
  targetId: platformAudit.targetId,
  targetName: sql<string | null>`case ${platformAudit.targetType}
    when 'tenant' then (select t.name from tenants t where t.id = ${platformAudit.targetId})
    when 'platform_user' then (select p.name from platform_users p where p.id = ${platformAudit.targetId})
    when 'user' then (select u.name from users u where u.id = ${platformAudit.targetId})
    when 'role' then (select r.name from roles r where r.id = ${platformAudit.targetId})
  end`,
  meta: platformAudit.meta,
  ip: sql<string | null>`host(${platformAudit.ip})`,
} as const;

function matching(filters: PlatformAuditFilters) {
  return and(
    filters.actor === undefined ? undefined : eq(platformAudit.actorPlatformUserId, filters.actor),
    filters.tenantId === undefined ? undefined : eq(platformAudit.tenantId, filters.tenantId),
    filters.action === undefined ? undefined : eq(platformAudit.action, filters.action),
    // As text, so an instant keeps its microseconds (a JS Date would drop them).
    filters.from === undefined
      ? undefined
      : sql`${platformAudit.at} >= ${filters.from}::timestamptz`,
    filters.to === undefined ? undefined : sql`${platformAudit.at} < ${filters.to}::timestamptz`,
  );
}

/**
 * `platform_audit`, read inside the caller's `withPlatform` transaction (D17): every school's
 * console entries, newest first, then by id. It loads; it never decides.
 */
@Injectable()
export class PlatformAuditRepository {
  /** A page after `after`, with one extra row telling the caller there is more. */
  page(
    tx: PlatformTx,
    filters: PlatformAuditFilters,
    after: InstantKeyset | null,
    limit: number,
  ): Promise<PlatformAuditRow[]> {
    return tx
      .select(COLUMNS)
      .from(platformAudit)
      .where(and(matching(filters), olderThan(platformAudit.at, platformAudit.id, after)))
      .orderBy(desc(platformAudit.at), desc(platformAudit.id))
      .limit(limit + 1);
  }

  /** Every matching entry, up to `max + 1` (so the caller can tell there are more than `max`). */
  all(tx: PlatformTx, filters: PlatformAuditFilters, max: number): Promise<PlatformAuditRow[]> {
    return tx
      .select(COLUMNS)
      .from(platformAudit)
      .where(matching(filters))
      .orderBy(desc(platformAudit.at), desc(platformAudit.id))
      .limit(max + 1);
  }

  /**
   * The Quad staff who appear as the actor of an entry, by name: one `exists` probe each on the
   * `actor_platform_user_id` index, never a scan of the whole log.
   */
  people(tx: PlatformTx): Promise<{ id: string; name: string }[]> {
    return tx
      .select({ id: platformUsers.id, name: platformUsers.name })
      .from(platformUsers)
      .where(
        exists(
          tx
            .select({ one: sql`1` })
            .from(platformAudit)
            .where(eq(platformAudit.actorPlatformUserId, platformUsers.id)),
        ),
      )
      .orderBy(asc(platformUsers.name), asc(platformUsers.id));
  }
}
