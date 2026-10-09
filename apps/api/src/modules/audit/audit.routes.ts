import { AuditLog, AuditLogQuery } from '@quad/contracts';

import { named } from '../../openapi/registry';

import type { ApiRoute } from '../../openapi/registry';

const Log = named('AuditLog', AuditLog);

/** Staff portal only: `audit` and `staff` keep it out of the parent app's client. */
const TAGS = ['audit', 'staff'] as const;

export const auditRoutes: readonly ApiRoute[] = [
  {
    method: 'get',
    path: '/audit',
    summary:
      'Settings → Audit: the school’s audit log, newest first, filtered by person, action and time (settings.view). With Accept: text/csv, every filtered entry as a CSV download (needs sensitive.export_data; the export is audited; more than 10,000 entries is 422)',
    tags: TAGS,
    request: { query: AuditLogQuery.innerType() },
    responses: {
      200: { description: 'A page of the log, or the CSV export', schema: Log, csv: true },
    },
    errors: [400, 401, 403, 422],
  },
];
