import { SignInResult, SupportSessionExit, SupportSessionRedeemInput } from '@quad/contracts';

import { named } from '../../openapi/registry';

import type { ApiRoute } from '../../openapi/registry';

const Redeem = named('SupportSessionRedeemInput', SupportSessionRedeemInput);
const Exit = named('SupportSessionExit', SupportSessionExit);
const Next = named('SignInResult', SignInResult);

/** Staff portal only (tag `staff`), so the parent client never gets them. */
export const supportSessionRoutes: readonly ApiRoute[] = [
  {
    method: 'post',
    path: '/auth/support-session',
    summary:
      'Staff portal, /sign-in/support/{token}: use a support visit’s single-use link from the console and open the school as Quad support; sets the staff cookies until the visit ends. Every bad, used or expired link is 400 invalid_link',
    tags: ['auth', 'staff'],
    request: { body: Redeem },
    responses: { 200: { description: 'The visit is open', schema: Next } },
    errors: [400, 429],
  },
  {
    method: 'post',
    path: '/auth/support-session/end',
    summary:
      'Staff portal, Exit to platform: end this support visit, clear the staff cookies and return the console’s address (the visit’s own cookie; needs X-CSRF-Token)',
    tags: ['auth', 'staff'],
    responses: { 200: { description: 'Where to go next', schema: Exit } },
    errors: [401, 403, 429],
  },
];
