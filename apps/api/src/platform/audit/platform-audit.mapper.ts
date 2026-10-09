import { SYSTEM_ACTOR, auditSummary, metaOf, yesNo } from '../../common/audit/audit-summary';
import { formatMessage } from '../../common/delivery/templates/render';

import type { PlatformAuditRow } from './platform-audit.repository';
import type { CsvCell } from '../../common/export/csv';
import type { PlatformAuditActor, PlatformAuditEntry } from '@quad/contracts';

function actorOf(row: PlatformAuditRow): PlatformAuditActor {
  return row.actorPlatformUserId !== null && row.actorName !== null
    ? { type: 'quad', id: row.actorPlatformUserId, name: row.actorName }
    : { type: 'system' };
}

/** One row of `GET /platform/audit`. */
export function toPlatformAuditEntry(row: PlatformAuditRow): PlatformAuditEntry {
  const meta = metaOf(row.meta);
  return {
    id: row.id,
    at: row.at.toISOString(),
    action: row.action,
    summary: auditSummary({
      action: row.action,
      targetType: row.targetType,
      targetName: row.targetName,
      meta,
    }),
    actor: actorOf(row),
    school:
      row.tenantId === null || row.schoolName === null
        ? null
        : { id: row.tenantId, name: row.schoolName },
    viaSupport: row.viaSupport,
    target: row.targetType === null ? null : { type: row.targetType, id: row.targetId },
    meta,
    ip: row.ip,
  };
}

/** The console export's column headings (spec 07 Audit log → Export). */
export function platformAuditCsvHeader(): string[] {
  return [
    formatMessage('audit.csv.when'),
    formatMessage('audit.csv.who'),
    formatMessage('audit.csv.what'),
    formatMessage('audit.csv.school'),
    formatMessage('audit.csv.viaSupport'),
    formatMessage('audit.csv.ip'),
    formatMessage('audit.csv.details'),
  ];
}

/** One line of the console export. */
export function platformAuditCsvRow(entry: PlatformAuditEntry): CsvCell[] {
  return [
    entry.at,
    entry.actor.type === 'quad' ? entry.actor.name : SYSTEM_ACTOR(),
    entry.summary,
    entry.school?.name ?? null,
    yesNo(entry.viaSupport),
    entry.ip,
    JSON.stringify(entry.meta),
  ];
}
