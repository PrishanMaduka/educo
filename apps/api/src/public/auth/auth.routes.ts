import {
  IdentifyInput,
  IdentifyResult,
  PasswordForgotInput,
  PasswordResetInput,
  PasswordSignInInput,
  SelectSchoolInput,
  SignInMembershipList,
  SignInResult,
  SsoCallbackQuery,
  SsoProviderParams,
  SsoStartInput,
  SsoStartResult,
  TotpVerifyInput,
} from '@quad/contracts';

import { named } from '../../openapi/registry';

import type { ApiRoute } from '../../openapi/registry';

const Identify = named('IdentifyInput', IdentifyInput);
const Methods = named('IdentifyResult', IdentifyResult);
const PasswordSignIn = named('PasswordSignInInput', PasswordSignInInput);
const Next = named('SignInResult', SignInResult);
const TotpVerify = named('TotpVerifyInput', TotpVerifyInput);
const Memberships = named('SignInMembershipList', SignInMembershipList);
const SelectSchool = named('SelectSchoolInput', SelectSchoolInput);
const Forgot = named('PasswordForgotInput', PasswordForgotInput);
const Reset = named('PasswordResetInput', PasswordResetInput);
const SsoStart = named('SsoStartInput', SsoStartInput);
const SsoUrl = named('SsoStartResult', SsoStartResult);

/** Staff sign-in (spec 05, spec 06 Me and auth). Tenant-less: the school is never an input. */
export const authRoutes: readonly ApiRoute[] = [
  {
    method: 'post',
    path: '/auth/identify',
    summary:
      'The sign-in methods for a work email (the same answer whether or not it has an account)',
    tags: ['auth'],
    request: { body: Identify },
    responses: {
      200: { description: 'SSO for the email’s domain, then password', schema: Methods },
    },
    errors: [400, 429],
  },
  {
    method: 'post',
    path: '/auth/password',
    summary: 'Sign in with email and password; sets the session cookies and says what comes next',
    tags: ['auth'],
    request: { body: PasswordSignIn },
    responses: { 200: { description: 'The next sign-in step', schema: Next } },
    errors: [400, 401, 403, 429],
  },
  {
    method: 'post',
    path: '/auth/sso/{provider}/start',
    summary:
      'Start single sign-on with Google or Microsoft: the provider URL to open, with PKCE (sets a short-lived state cookie)',
    tags: ['auth'],
    request: { params: SsoProviderParams, body: SsoStart },
    responses: { 200: { description: 'Open this URL to sign in', schema: SsoUrl } },
    errors: [400, 403, 429, 503],
  },
  {
    method: 'get',
    path: '/auth/sso/{provider}/callback',
    summary:
      'The provider returns here; the API checks the sign-in and redirects to /sign-in?step=<next step>',
    tags: ['auth'],
    request: { params: SsoProviderParams, query: SsoCallbackQuery },
    responses: { 302: { description: 'Redirects to the next sign-in step' } },
    errors: [400, 401, 403, 429, 503],
  },
  {
    method: 'post',
    path: '/auth/totp/verify',
    summary: 'Check the authenticator or recovery code at the two-step step (needs X-CSRF-Token)',
    tags: ['auth'],
    request: { body: TotpVerify },
    responses: { 200: { description: 'The next sign-in step', schema: Next } },
    errors: [400, 401, 403, 429],
  },
  {
    method: 'get',
    path: '/auth/memberships',
    summary: 'The schools you can open (Choose a school, Switch school)',
    tags: ['auth'],
    responses: { 200: { description: 'Your staff schools', schema: Memberships } },
    errors: [401, 429],
  },
  {
    method: 'post',
    path: '/auth/select-school',
    summary: 'Open one of your schools; rotates the session (needs X-CSRF-Token)',
    tags: ['auth'],
    request: { body: SelectSchool },
    responses: { 204: { description: 'Signed in to the school' } },
    errors: [400, 401, 403, 429],
  },
  {
    method: 'post',
    path: '/auth/sign-out',
    summary: 'Sign out of every school on this device (needs X-CSRF-Token)',
    tags: ['auth'],
    responses: { 204: { description: 'Signed out' } },
    errors: [401, 403, 429],
  },
  {
    method: 'post',
    path: '/auth/password/forgot',
    summary: 'Email a password reset link (the same answer whether or not the account exists)',
    tags: ['auth'],
    request: { body: Forgot },
    responses: { 202: { description: 'If the account exists, a reset link is on its way' } },
    errors: [400, 429],
  },
  {
    method: 'post',
    path: '/auth/password/reset',
    summary: 'Set a new password with a reset link; signs out every device',
    tags: ['auth'],
    request: { body: Reset },
    responses: { 204: { description: 'The password is changed' } },
    errors: [400, 429],
  },
];
