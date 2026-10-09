import {
  InviteAcceptInput,
  InviteDetails,
  InviteTokenParams,
  SignInResult,
  StaffInviteInput,
  StaffInviteResult,
  StaffList,
  StaffListQuery,
  StaffMember,
  StaffUpdateInput,
  UserIdParams,
} from '@quad/contracts';

import { named } from '../../openapi/registry';

import type { ApiRoute } from '../../openapi/registry';

const Member = named('StaffMember', StaffMember);
const Members = named('StaffList', StaffList);
const Invite = named('StaffInviteInput', StaffInviteInput);
const Invited = named('StaffInviteResult', StaffInviteResult);
const Update = named('StaffUpdateInput', StaffUpdateInput);
const Details = named('InviteDetails', InviteDetails);
const Accept = named('InviteAcceptInput', InviteAcceptInput);

/** Staff portal only: the `staff` tag keeps these out of the parent app's client. */
const TAGS = ['users', 'staff'] as const;

/** A row action on one member of staff (`users.manage`; needs X-CSRF-Token). */
function rowAction(path: string, summary: string, status: 202 | 204, errors: readonly number[]) {
  return {
    method: 'post',
    path: `/users/{id}/${path}`,
    summary,
    tags: TAGS,
    request: { params: UserIdParams },
    responses: { [status]: { description: summary } },
    errors,
  } as const satisfies ApiRoute;
}

export const usersRoutes: readonly ApiRoute[] = [
  {
    method: 'get',
    path: '/users',
    summary:
      'Staff accounts with role, status, two-step and last sign-in, and the summary (users.manage)',
    tags: TAGS,
    request: { query: StaffListQuery },
    responses: { 200: { description: 'A page of staff', schema: Members } },
    errors: [400, 401, 403],
  },
  {
    method: 'post',
    path: '/users/invite',
    summary:
      'Invite 1 to 50 people by email with a role; an address already here is 422 already_member (needs X-CSRF-Token)',
    tags: TAGS,
    request: { body: Invite },
    responses: { 201: { description: 'The invited members', schema: Invited } },
    errors: [400, 401, 403, 404, 422],
  },
  {
    method: 'patch',
    path: '/users/{id}',
    summary:
      'Change a member’s role, or deactivate or reactivate them; never yourself, never the last admin (needs X-CSRF-Token)',
    tags: TAGS,
    request: { params: UserIdParams, body: Update },
    responses: { 200: { description: 'The member', schema: Member } },
    errors: [400, 401, 403, 404, 422],
  },
  rowAction(
    'remind-two-step',
    'Email the member to turn on two-step sign-in (409 when it is on)',
    202,
    [400, 401, 403, 404, 409, 422],
  ),
  rowAction(
    'reset-password',
    'Email the member a single-use link to choose a new password',
    202,
    [400, 401, 403, 404, 422],
  ),
  rowAction(
    'sign-out-everywhere',
    'Sign the member out of every device in this school',
    204,
    [400, 401, 403, 404],
  ),
  rowAction(
    'resend-invite',
    'Send a pending invitation again with a new link; the old link stops working',
    202,
    [400, 401, 403, 404, 422],
  ),
  {
    method: 'get',
    path: '/auth/invites/{token}',
    summary:
      'A staff invitation: the school, the name, the masked address and whether a password is needed (signed link)',
    // Staff invitations only for now: kept out of the parent app's client.
    tags: ['auth', 'staff'],
    request: { params: InviteTokenParams },
    responses: { 200: { description: 'The invitation', schema: Details } },
    errors: [400, 429],
  },
  {
    method: 'post',
    path: '/auth/invites/{token}/accept',
    summary:
      'Accept a staff invitation: a new account chooses its password and is signed in; an existing account must be signed in (signed link)',
    tags: ['auth', 'staff'],
    request: { params: InviteTokenParams, body: Accept },
    responses: { 200: { description: 'The next sign-in step', schema: SignInResult } },
    errors: [400, 401, 403, 429],
  },
];
