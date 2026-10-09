import {
  PlatformMe,
  PlatformNoInput,
  PlatformPasswordSignInInput,
  PlatformSignInResult,
  PlatformTotpSetup,
  PlatformTotpVerifyInput,
} from '@quad/contracts';

import { named } from '../../openapi/registry';

import type { ApiRoute } from '../../openapi/registry';

const Password = named('PlatformPasswordSignInInput', PlatformPasswordSignInInput);
const Next = named('PlatformSignInResult', PlatformSignInResult);
const Setup = named('PlatformTotpSetup', PlatformTotpSetup);
const Verify = named('PlatformTotpVerifyInput', PlatformTotpVerifyInput);
const Me = named('PlatformMe', PlatformMe);
const NoInput = named('PlatformNoInput', PlatformNoInput);

/**
 * Console sign-in and the signed-in console user (spec 05 → Platform console, spec 06 →
 * Platform). Served on the console host and accepted only with the console cookie (D28 ruling
 * R-console-realtime).
 */
export const platformAuthRoutes: readonly ApiRoute[] = [
  {
    method: 'post',
    path: '/platform/auth/password',
    summary:
      'Console: sign in with email and password; sets the console cookies and asks for the authenticator code (or to set one up)',
    tags: ['platform'],
    request: { body: Password },
    responses: { 200: { description: 'The next sign-in step', schema: Next } },
    errors: [400, 401, 403, 429, 503],
  },
  {
    method: 'post',
    path: '/platform/auth/totp/setup',
    summary:
      'Console, first sign-in: a new authenticator secret and its otpauth URI, shown once (needs X-CSRF-Token)',
    tags: ['platform'],
    request: { body: NoInput },
    responses: { 200: { description: 'The new authenticator', schema: Setup } },
    errors: [400, 401, 403, 409, 429],
  },
  {
    method: 'post',
    path: '/platform/auth/totp/verify',
    summary:
      'Console: check the authenticator code (or the first code of a new one) and open the console on a new cookie (needs X-CSRF-Token)',
    tags: ['platform'],
    request: { body: Verify },
    responses: { 200: { description: 'Signed in to the console', schema: Next } },
    errors: [400, 401, 403, 429, 503],
  },
  {
    method: 'post',
    path: '/platform/auth/sign-out',
    summary: 'Console: sign out this browser and clear the console cookies (needs X-CSRF-Token)',
    tags: ['platform'],
    request: { body: NoInput },
    responses: { 204: { description: 'Signed out' } },
    errors: [400, 401, 403, 429],
  },
  {
    method: 'get',
    path: '/platform/me',
    summary: 'Console: the signed-in Quad staff member’s name and role',
    tags: ['platform'],
    responses: { 200: { description: 'The signed-in console user', schema: Me } },
    errors: [400, 401, 429],
  },
];
