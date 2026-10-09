import { SupportSessionCreateInput, SupportSessionLink, TenantIdParams } from '@quad/contracts';

import { named } from '../../openapi/registry';

import type { ApiRoute } from '../../openapi/registry';

const Input = named('SupportSessionCreateInput', SupportSessionCreateInput);
const Link = named('SupportSessionLink', SupportSessionLink);

export const platformSupportRoutes: readonly ApiRoute[] = [
  {
    method: 'post',
    path: '/platform/tenants/{id}/support-session',
    summary:
      'Console → Open as school admin: with a reason (10 to 500 characters), opens a 60-minute support visit to the school and returns a single-use link into the staff portal that works for 2 minutes (support, admin or owner role; needs X-CSRF-Token)',
    tags: ['platform'],
    request: { params: TenantIdParams, body: Input },
    responses: { 200: { description: 'The single-use link', schema: Link } },
    errors: [400, 401, 403, 404],
  },
];
