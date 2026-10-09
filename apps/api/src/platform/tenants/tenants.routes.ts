import { PlatformTenantList, PlatformTenantListQuery } from '@quad/contracts';

import { named } from '../../openapi/registry';

import type { ApiRoute } from '../../openapi/registry';

const List = named('PlatformTenantList', PlatformTenantList);

export const platformTenantsRoutes: readonly ApiRoute[] = [
  {
    method: 'get',
    path: '/platform/tenants',
    summary:
      'Console → Schools: every school that is not deleted, by name, with its id, short name, status and colour (any console role)',
    tags: ['platform'],
    request: { query: PlatformTenantListQuery },
    responses: { 200: { description: 'A page of schools', schema: List } },
    errors: [400, 401],
  },
];
