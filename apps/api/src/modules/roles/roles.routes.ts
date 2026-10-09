import {
  Role,
  RoleCreateInput,
  RoleIdParams,
  RoleList,
  RolePermissionsInput,
  RoleUpdateInput,
} from '@quad/contracts';

import { named } from '../../openapi/registry';

import type { ApiRoute } from '../../openapi/registry';

const RoleSchema = named('Role', Role);
const Roles = named('RoleList', RoleList);
const Create = named('RoleCreateInput', RoleCreateInput);
const Update = named('RoleUpdateInput', RoleUpdateInput);
const Permissions = named('RolePermissionsInput', RolePermissionsInput);

/** Staff portal only: the `staff` tag keeps these out of the parent app's client. */
const TAGS = ['roles', 'staff'] as const;

export const rolesRoutes: readonly ApiRoute[] = [
  {
    method: 'get',
    path: '/roles',
    summary:
      'Every role of the school with its members, pages, home page and matrix (users.manage or settings.view)',
    tags: TAGS,
    responses: { 200: { description: 'The roles', schema: Roles } },
    errors: [401, 403],
  },
  {
    method: 'post',
    path: '/roles',
    summary:
      "Create a custom role from another role's permissions, or from none (users.manage; needs X-CSRF-Token)",
    tags: TAGS,
    request: { body: Create },
    responses: { 201: { description: 'The new role', schema: RoleSchema } },
    errors: [400, 401, 403],
  },
  {
    method: 'patch',
    path: '/roles/{id}',
    summary:
      "Change a custom role's name, description, colour or scope; a built-in role is 422 system_role_locked (needs X-CSRF-Token)",
    tags: TAGS,
    request: { params: RoleIdParams, body: Update },
    responses: { 200: { description: 'The role', schema: RoleSchema } },
    errors: [400, 401, 403, 404, 422],
  },
  {
    method: 'delete',
    path: '/roles/{id}',
    summary:
      'Delete a custom role nobody holds or previews (409 in_use otherwise; needs X-CSRF-Token)',
    tags: TAGS,
    request: { params: RoleIdParams },
    responses: { 204: { description: 'The role is deleted' } },
    errors: [400, 401, 403, 404, 409, 422],
  },
  {
    method: 'put',
    path: '/roles/{id}/permissions',
    summary:
      "Replace a custom role's matrix and sensitive keys: rows in the plan only, keys you hold yourself (needs X-CSRF-Token)",
    tags: TAGS,
    request: { params: RoleIdParams, body: Permissions },
    responses: { 200: { description: 'The role', schema: RoleSchema } },
    errors: [400, 401, 403, 404, 422],
  },
];
