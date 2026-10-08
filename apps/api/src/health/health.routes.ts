import { HealthLive, HealthReady } from '@quad/contracts';

import { named } from '../openapi/registry';

import type { ApiRoute } from '../openapi/registry';

const Live = named('HealthLive', HealthLive);
const Ready = named('HealthReady', HealthReady);

export const healthRoutes: readonly ApiRoute[] = [
  {
    method: 'get',
    path: '/health/live',
    summary: 'The process is up',
    tags: ['health'],
    responses: { 200: { description: 'Up', schema: Live } },
  },
  {
    method: 'get',
    path: '/health/ready',
    summary: 'Postgres and Redis answer',
    tags: ['health'],
    responses: {
      200: { description: 'Ready to serve traffic', schema: Ready },
      503: { description: 'A dependency is down; the body names it', schema: Ready },
    },
  },
];
