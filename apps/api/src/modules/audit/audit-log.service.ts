import { Inject, Injectable } from '@nestjs/common';

import { AUDIT_EXPORT_MAX_ROWS, tooManyToExport } from '../../common/audit/audit-summary';
import { AuditService, auditActorOf } from '../../common/audit/audit.service';
import { formatMessage } from '../../common/delivery/templates/render';
import { ForbiddenError } from '../../common/errors';
import { toCsv } from '../../common/export/csv';
import { decodeCursor, pageOf } from '../../common/pagination/cursor';
import { InstantKeyset } from '../../common/pagination/instant-keyset';
import { schoolOf } from '../../common/session/request-auth';
import { TENANT_DB } from '../../tokens';

import { auditCsvHeader, auditCsvRow, toAuditEntry } from './audit.mapper';
import { AuditRepository } from './audit.repository';

import type { AuditFilters } from './audit.repository';
import type { RequestAccess } from '../../common/access/permissions.service';
import type { RequestAuth } from '../../common/session/request-auth';
import type { AuditLog, AuditLogQuery } from '@quad/contracts';
import type { QuadTenantDb } from '@quad/db';

/** The filters a request set, for the export's own audit entry (unset ones left out). */
function filtersOf(query: AuditLogQuery): AuditFilters {
  const { actor, action, from, to } = query;
  return {
    ...(actor === undefined ? {} : { actor }),
    ...(action === undefined ? {} : { action }),
    ...(from === undefined ? {} : { from }),
    ...(to === undefined ? {} : { to }),
  };
}

/**
 * Settings → Audit (spec 08; spec 06 `GET /audit`): the school's log, filtered and paged newest
 * first, or exported as CSV. An export needs `sensitive.export_data` (the entries name people)
 * and is itself audited as `audit.exported`, in the same transaction as the read.
 */
@Injectable()
export class AuditLogService {
  constructor(
    @Inject(TENANT_DB) private readonly db: QuadTenantDb,
    private readonly repository: AuditRepository,
    private readonly audit: AuditService,
  ) {}

  /** `GET /audit`. */
  list(auth: RequestAuth, query: AuditLogQuery): Promise<AuditLog> {
    const { tenantId } = schoolOf(auth);
    const after = decodeCursor(InstantKeyset, query.cursor);
    return this.db.withTenant(tenantId, async (tx) => {
      const rows = await this.repository.page(tx, filtersOf(query), after, query.limit);
      const page = pageOf(rows, query.limit, (last) => ({ at: last.keysetAt, id: last.id }));
      return { items: page.items.map(toAuditEntry), nextCursor: page.nextCursor };
    });
  }

  /** `GET /audit` with `Accept: text/csv`: every filtered entry, newest first. */
  export(
    auth: RequestAuth,
    access: RequestAccess,
    query: AuditLogQuery,
    ip: string,
  ): Promise<string> {
    if (!access.permissions.has('sensitive.export_data')) {
      throw new ForbiddenError('forbidden', formatMessage('error.audit.exportNeedsPermission'));
    }
    const actor = auditActorOf(schoolOf(auth), ip);
    const filters = filtersOf(query);
    return this.db.withTenant(actor.tenantId, async (tx) => {
      const rows = await this.repository.all(tx, filters, AUDIT_EXPORT_MAX_ROWS);
      if (rows.length > AUDIT_EXPORT_MAX_ROWS) {
        throw tooManyToExport();
      }
      await this.audit.record(
        { tx, ...actor },
        'audit.exported',
        { type: 'audit_log', id: null },
        { filters, rows: rows.length },
      );
      return toCsv(auditCsvHeader(), rows.map(toAuditEntry).map(auditCsvRow));
    });
  }
}
