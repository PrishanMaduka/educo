import { Inject, Injectable } from '@nestjs/common';

import { AUDIT_EXPORT_MAX_ROWS, tooManyToExport } from '../../common/audit/audit-summary';
import { toCsv } from '../../common/export/csv';
import { decodeCursor, pageOf } from '../../common/pagination/cursor';
import { InstantKeyset } from '../../common/pagination/instant-keyset';
import { PLATFORM_DB } from '../tokens';

import {
  platformAuditCsvHeader,
  platformAuditCsvRow,
  toPlatformAuditEntry,
} from './platform-audit.mapper';
import { PlatformAuditRepository } from './platform-audit.repository';
import { PlatformAuditService } from './platform-audit.service';

import type { PlatformAuditFilters } from './platform-audit.repository';
import type { ConsoleAuth } from '../auth/console-auth';
import type { ConsoleClient } from '../auth/console-sign-in-failures';
import type { PlatformAuditLog, PlatformAuditLogQuery, PlatformAuditPeople } from '@quad/contracts';
import type { QuadPlatformDb } from '@quad/db';

/** The filters a request set, for the export's own entry (unset ones left out). */
function filtersOf(query: PlatformAuditLogQuery): PlatformAuditFilters {
  const { actor, tenantId, action, from, to } = query;
  return {
    ...(actor === undefined ? {} : { actor }),
    ...(tenantId === undefined ? {} : { tenantId }),
    ...(action === undefined ? {} : { action }),
    ...(from === undefined ? {} : { from }),
    ...(to === undefined ? {} : { to }),
  };
}

/**
 * The console's Audit log (spec 07; spec 06 `GET /platform/audit`): `platform_audit` across every
 * school, filtered and paged newest first, or exported as CSV. Any console role reads it; an
 * export is recorded as `audit.exported` in `platform_audit`, in the same transaction.
 */
@Injectable()
export class PlatformAuditLogService {
  constructor(
    @Inject(PLATFORM_DB) private readonly db: QuadPlatformDb,
    private readonly repository: PlatformAuditRepository,
    private readonly audit: PlatformAuditService,
  ) {}

  /** `GET /platform/audit`. */
  list(query: PlatformAuditLogQuery): Promise<PlatformAuditLog> {
    const after = decodeCursor(InstantKeyset, query.cursor);
    return this.db.withPlatform(async (tx) => {
      const rows = await this.repository.page(tx, filtersOf(query), after, query.limit);
      const page = pageOf(rows, query.limit, (last) => ({ at: last.keysetAt, id: last.id }));
      return { items: page.items.map(toPlatformAuditEntry), nextCursor: page.nextCursor };
    });
  }

  /** `GET /platform/audit/people`: the actor filter's choices. */
  people(): Promise<PlatformAuditPeople> {
    return this.db.withPlatform(async (tx) => ({ items: await this.repository.people(tx) }));
  }

  /** `GET /platform/audit` with `Accept: text/csv`: every filtered entry, newest first. */
  export(auth: ConsoleAuth, query: PlatformAuditLogQuery, client: ConsoleClient): Promise<string> {
    const filters = filtersOf(query);
    return this.db.withPlatform(async (tx) => {
      const rows = await this.repository.all(tx, filters, AUDIT_EXPORT_MAX_ROWS);
      if (rows.length > AUDIT_EXPORT_MAX_ROWS) throw tooManyToExport();
      await this.audit.record(tx, {
        actorPlatformUserId: auth.platformUserId,
        action: 'audit.exported',
        target: { type: 'audit_log', id: null },
        ip: client.ip,
        userAgent: client.userAgent,
        meta: { filters, rows: rows.length },
      });
      return toCsv(
        platformAuditCsvHeader(),
        rows.map(toPlatformAuditEntry).map(platformAuditCsvRow),
      );
    });
  }
}
