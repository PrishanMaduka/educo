import {
  Me,
  MePermissions,
  MeUpdateInput,
  PageQuerySchema,
  RolePreviewInput,
  SessionIdParams,
  SessionSummaryList,
  TotpSetupInput,
  TotpSetupResult,
} from '@quad/contracts';

import { named } from '../../openapi/registry';

import type { ApiRoute } from '../../openapi/registry';

const MeSchema = named('Me', Me);
const MeUpdate = named('MeUpdateInput', MeUpdateInput);
const Sessions = named('SessionSummaryList', SessionSummaryList);
const TotpSetup = named('TotpSetupInput', TotpSetupInput);
const TotpSetupDone = named('TotpSetupResult', TotpSetupResult);
const Permissions = named('MePermissions', MePermissions);
const RolePreview = named('RolePreviewInput', RolePreviewInput);

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
    method: 'get',
    path: '/me/permissions',
    summary:
      'What you can do in this school: permission keys, every staff page and how much of it opens, your home page and any role preview',
    // Staff portal only: kept out of the parent app's client.
    tags: ['me', 'staff'],
    responses: { 200: { description: 'Your permissions', schema: Permissions } },
    errors: [401, 403],
  },
  {
    method: 'post',
    path: '/me/role-preview',
    summary:
      'Preview the staff portal as a role, read-only (users.manage; a role for own classes needs a sample person; needs X-CSRF-Token)',
    // Staff portal only: kept out of the parent app's client.
    tags: ['me', 'staff'],
    request: { body: RolePreview },
    responses: { 200: { description: 'Your permissions while previewing', schema: Permissions } },
    errors: [400, 401, 403, 404],
  },
  {
    method: 'delete',
    path: '/me/role-preview',
    summary: 'End the role preview: back to your own view (needs X-CSRF-Token)',
    // Staff portal only: kept out of the parent app's client.
    tags: ['me', 'staff'],
    responses: { 204: { description: 'The preview ended' } },
    errors: [401, 403, 404],
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
  {
    method: 'post',
    path: '/me/totp',
    summary:
      'Set up an authenticator: without a code it starts one, with its code it confirms it and gives the recovery codes (needs X-CSRF-Token)',
    tags: ['me'],
    request: { body: TotpSetup },
    responses: {
      200: { description: 'The otpauth URI, or the recovery codes', schema: TotpSetupDone },
    },
    errors: [400, 401, 403, 409],
  },
];
