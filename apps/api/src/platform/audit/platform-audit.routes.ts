import { PlatformAuditLog, PlatformAuditLogQuery } from '@quad/contracts';

import { named } from '../../openapi/registry';

import type { ApiRoute } from '../../openapi/registry';

const Log = named('PlatformAuditLog', PlatformAuditLog);

export const platformAuditRoutes: readonly ApiRoute[] = [
  {
    method: 'get',
    path: '/platform/audit',
    summary:
      'Console → Audit log: every school’s platform_audit entries, newest first, filtered by Quad staff member, school, action and time (any console role). With Accept: text/csv, every filtered entry as a CSV download (the export is recorded; more than 10,000 entries is 422)',
    tags: ['platform'],
    request: { query: PlatformAuditLogQuery.innerType() },
    responses: {
      200: { description: 'A page of the log, or the CSV export', schema: Log, csv: true },
    },
    errors: [400, 401, 422],
  },
];
