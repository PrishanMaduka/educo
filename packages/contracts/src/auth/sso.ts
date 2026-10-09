import { z } from 'zod';

import { SsoProvider } from '../enums';

import { SignInEmail } from './sign-in';

/**
 * Staff single sign-on (spec 05 step 2; spec 06 Me and auth): OIDC authorization code with PKCE.
 * The school is never an input: it comes from the account's own memberships after the provider
 * has vouched for the email.
 */

/** `:provider` in `/auth/sso/:provider/*`. */
export const SsoProviderParams = z.object({ provider: SsoProvider });
export type SsoProviderParams = z.infer<typeof SsoProviderParams>;

/** `POST /auth/sso/:provider/start`. */
export const SsoStartInput = z.object({
  /** Passed to the provider as `login_hint`; its domain must have a school with that provider. */
  email: SignInEmail,
  /** "Keep me signed in on this device", carried through the provider in the state cookie. */
  keepSignedIn: z.boolean().default(false),
});
export type SsoStartInput = z.infer<typeof SsoStartInput>;

/** Where the browser goes next: the provider's sign-in page. */
export const SsoStartResult = z.object({ url: z.string().url() });
export type SsoStartResult = z.infer<typeof SsoStartResult>;

/**
 * `GET /auth/sso/:provider/callback`: the authorization response. Other parameters a provider
 * adds (`scope`, `authuser`, `iss`…) are dropped here and read from the URL by the OIDC client.
 */
export const SsoCallbackQuery = z.object({
  code: z.string().min(1).max(4096),
  state: z.string().min(1).max(512),
});
export type SsoCallbackQuery = z.infer<typeof SsoCallbackQuery>;
