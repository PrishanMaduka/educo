import {
  IdentifyInput,
  IdentifyResult,
  OtpRequestInput,
  OtpVerifyInput,
  OtpVerifyResult,
  PasswordForgotInput,
  PasswordResetInput,
  PasswordSignInInput,
  RefreshInput,
  SelectSchoolInput,
  SignInMembershipList,
  SignInResult,
  SsoCallbackQueryFields,
  SsoProviderParams,
  SsoStartInput,
  SelectSchoolTokens,
  SsoStartResult,
  TokenPair,
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
const OtpRequest = named('OtpRequestInput', OtpRequestInput);
const OtpVerify = named('OtpVerifyInput', OtpVerifyInput);
const OtpResult = named('OtpVerifyResult', OtpVerifyResult);
const Refresh = named('RefreshInput', RefreshInput);
const Pair = named('TokenPair', TokenPair);
const SchoolTokens = named('SelectSchoolTokens', SelectSchoolTokens);

/**
 * Staff and parent sign-in (spec 05, spec 06 Me and auth). Tenant-less: the school is never an
 * input, except the choice among the person's own schools on select-school.
 */
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
      'The provider returns here; the API checks the sign-in and always redirects back to /sign-in',
    tags: ['auth'],
    request: { params: SsoProviderParams, query: SsoCallbackQueryFields },
    responses: {
      302: { description: 'Signed in: redirects to /sign-in?step=<next step>' },
      303: {
        description:
          'Refused: redirects to /sign-in?error=<sso_unfinished | sso_refused | account_locked | sso_cancelled>',
      },
    },
    errors: [429],
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
    summary:
      'Open one of your schools. Staff: rotates the session cookie (needs X-CSRF-Token). Parent app: the select_school token gets both tokens; a school token switches and gets only the new access token (the refresh token stays)',
    tags: ['auth'],
    request: { body: SelectSchool },
    responses: {
      200: { description: 'Parent app (bearer): the tokens for the school', schema: SchoolTokens },
      204: { description: 'Staff (cookie): signed in to the school' },
    },
    errors: [400, 401, 403, 429],
  },
  {
    method: 'post',
    path: '/auth/sign-out',
    summary:
      'Sign out: the staff session for every school (needs X-CSRF-Token), or the parent app’s token family on this device',
    tags: ['auth'],
    responses: { 204: { description: 'Signed out' } },
    errors: [401, 403, 429],
  },
  {
    method: 'post',
    path: '/auth/otp/request',
    summary:
      'Send a 6-digit sign-in code to a mobile number or email (the same answer whether or not it is known)',
    tags: ['auth'],
    request: { body: OtpRequest },
    responses: { 202: { description: 'A code is on its way; it works for 10 minutes' } },
    errors: [400, 429],
  },
  {
    method: 'post',
    path: '/auth/otp/verify',
    summary:
      'Check the code: signs in to your one school, asks you to choose among several, or says you were not found',
    tags: ['auth'],
    request: { body: OtpVerify },
    responses: { 200: { description: 'What the code found', schema: OtpResult } },
    errors: [400, 403, 429],
  },
  {
    method: 'post',
    path: '/auth/refresh',
    summary:
      'Swap the refresh token for a new pair; an old refresh token signs the device out everywhere it was copied',
    tags: ['auth'],
    request: { body: Refresh },
    responses: { 200: { description: 'The new access and refresh tokens', schema: Pair } },
    errors: [400, 401, 429],
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
