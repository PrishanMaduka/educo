import { DemoRequestBody } from '@quad/contracts';

import { named } from '../../openapi/registry';

import type { ApiRoute } from '../../openapi/registry';

const Body = named('DemoRequestBody', DemoRequestBody);

export const demoRequestsRoutes: readonly ApiRoute[] = [
  {
    method: 'post',
    path: '/public/demo-requests',
    summary:
      'A school’s demo request or a parent’s "tell my school" request from the landing page, with a Turnstile token (5 an hour per address, 3 a day per email). The same empty 202 for a new or repeated request',
    // The landing page only, never the parent app.
    tags: ['public'],
    request: { body: Body },
    responses: { 202: { description: 'The request was received' } },
    errors: [400, 429, 503],
    // The largest valid body is about 6 KB (two 2,048-character fields and a 1,000-character note).
    bodyLimit: 16 * 1024,
  },
];
