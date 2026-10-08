import {
  Me,
  MeUpdateInput,
  PageQuerySchema,
  SessionIdParams,
  SessionSummaryList,
} from '@quad/contracts';

import { named } from '../../openapi/registry';

import type { ApiRoute } from '../../openapi/registry';

const MeSchema = named('Me', Me);
const MeUpdate = named('MeUpdateInput', MeUpdateInput);
const Sessions = named('SessionSummaryList', SessionSummaryList);

export const meRoutes: readonly ApiRoute[] = [
  {
    method: 'get',
    path: '/me',
    summary: 'The signed-in person, their school and brand, other schools, banners and greeting',
    tags: ['me'],
    responses: { 200: { description: 'The signed-in person', schema: MeSchema } },
    errors: [401],
  },
  {
    method: 'patch',
    path: '/me',
    summary: 'Change your name, theme or locale in this school (needs X-CSRF-Token)',
    tags: ['me'],
    request: { body: MeUpdate },
    responses: { 200: { description: 'The signed-in person, updated', schema: MeSchema } },
    errors: [400, 401, 403],
  },
  {
    method: 'get',
    path: '/me/sessions',
    summary: 'Your signed-in devices, newest first',
    tags: ['me'],
    request: { query: PageQuerySchema },
    responses: { 200: { description: 'A page of your sessions', schema: Sessions } },
    errors: [400, 401, 403],
  },
  {
    method: 'delete',
    path: '/me/sessions/{id}',
    summary: 'Sign one of your devices out (needs X-CSRF-Token)',
    tags: ['me'],
    request: { params: SessionIdParams },
    responses: { 204: { description: 'Signed out' } },
    errors: [400, 401, 403, 404],
  },
];
