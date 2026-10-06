import { z } from 'zod';

import type { ApiRoute } from './registry';

export const openApiRoutes: readonly ApiRoute[] = [
  {
    method: 'get',
    path: '/openapi.json',
    summary: 'This OpenAPI document',
    tags: ['meta'],
    responses: {
      200: { description: 'The OpenAPI 3.1 document', schema: z.record(z.string(), z.unknown()) },
    },
  },
];
