import {
  QUAD_SUPPORT,
  SYSTEM_ACTOR,
  auditSummary,
  metaOf,
  yesNo,
} from '../../common/audit/audit-summary';
import { formatMessage } from '../../common/delivery/templates/render';

import type { AuditRow } from './audit.repository';
import type { CsvCell } from '../../common/export/csv';
import type { AuditActor, AuditEntry } from '@quad/contracts';

function actorOf(row: AuditRow): AuditActor {
  // A support visit names Quad support, not which Quad staff member (spec 08 marks it; D32).
  if (row.supportSessionId !== null) return { type: 'quad_support' };
  if (row.actorUserId !== null && row.actorName !== null) {
    return { type: 'member', id: row.actorUserId, name: row.actorName };
  }
  return { type: 'system' };
}

/** One row of `GET /audit`. */
export function toAuditEntry(row: AuditRow): AuditEntry {
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
    viaSupport: row.supportSessionId !== null,
    target: row.targetType === null ? null : { type: row.targetType, id: row.targetId },
    meta,
    ip: row.ip,
  };
}

/** How the actor reads in an export. */
export function actorName(actor: AuditActor): string {
  switch (actor.type) {
    case 'member':
      return actor.name;
    case 'quad_support':
      return QUAD_SUPPORT();
    case 'system':
      return SYSTEM_ACTOR();
  }
}

/** The export's column headings (Settings → Audit → Export). */
export function auditCsvHeader(): string[] {
  return [
    formatMessage('audit.csv.when'),
    formatMessage('audit.csv.who'),
    formatMessage('audit.csv.what'),
    formatMessage('audit.csv.viaSupport'),
    formatMessage('audit.csv.ip'),
    formatMessage('audit.csv.details'),
  ];
}

/** One line of the export: the same facts as the list, `meta` as JSON. */
export function auditCsvRow(entry: AuditEntry): CsvCell[] {
  return [
    entry.at,
    actorName(entry.actor),
    entry.summary,
    yesNo(entry.viaSupport),
    entry.ip,
    JSON.stringify(entry.meta),
  ];
}
