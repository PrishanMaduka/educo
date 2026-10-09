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
 * `GET /auth/sso/:provider/callback`: the authorization response, as documented. A provider
 * sends `code` and `state`, or `error` (with `error_description`, which is ignored) when the
 * person cancels or the provider refuses. Other parameters (`scope`, `authuser`, `iss`…) are
 * dropped here and read from the URL by the OIDC client.
 */
export const SsoCallbackQueryFields = z.object({
  code: z.string().min(1).max(4096).optional(),
  state: z.string().min(1).max(512).optional(),
  error: z.string().min(1).max(256).optional(),
  error_description: z.string().max(2048).optional(),
});

/** The callback query as the API parses it: `code` and `state`, unless `error` is there. */
export const SsoCallbackQuery = SsoCallbackQueryFields.superRefine((query, context) => {
  if (query.error !== undefined) return;
  for (const field of ['code', 'state'] as const) {
    if (query[field] === undefined) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: 'Required' });
    }
  }
}).transform((query) => ({
  ...(query.code === undefined ? {} : { code: query.code }),
  ...(query.state === undefined ? {} : { state: query.state }),
  ...(query.error === undefined ? {} : { error: query.error }),
}));
export type SsoCallbackQuery = z.infer<typeof SsoCallbackQuery>;

/**
 * Why the callback sent the browser back to `/sign-in?error=<code>` (it always redirects):
 * - `sso_unfinished`: the state is missing, wrong, used or expired, the code exchange or the ID
 *   token failed, or the provider could not be reached. Start again.
 * - `sso_refused`: the provider did not vouch for the email, or no school of this account
 *   admits it (domain, provider, Workspace), or the login belongs to another account.
 * - `account_locked`: the account is locked (spec 05 step 7).
 * - `sso_cancelled`: the provider answered with `error` (for example `access_denied`).
 */
export const SsoSignInError = z.enum([
  'sso_unfinished',
  'sso_refused',
  'account_locked',
  'sso_cancelled',
]);
export type SsoSignInError = z.infer<typeof SsoSignInError>;
