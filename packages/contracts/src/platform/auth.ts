import { z } from 'zod';

import { OneTimeCode, PasswordSignInInput, SignInNext } from '../auth/sign-in';
import { IdSchema } from '../common/ids';
import { PlatformRole } from '../enums';

/**
 * Console sign-in (spec 05 → Platform console; spec 06 → Conventions): email and password, then
 * TOTP, always, in every environment (D37). The routes are `/platform/auth/*`, never `/auth/*`.
 */

/**
 * `POST /platform/auth/password`. No "Keep me signed in": a console session always idles out
 * after 8 hours (spec 05).
 */
export const PlatformPasswordSignInInput = PasswordSignInInput.pick({
  email: true,
  password: true,
});
export type PlatformPasswordSignInInput = z.infer<typeof PlatformPasswordSignInInput>;

/**
 * What the console shows next: the authenticator code, setting one up (first sign-in, or after
 * an owner reset it), or the console.
 */
export const PlatformSignInNext = SignInNext.extract(['two_step', 'two_step_setup', 'done']);
export type PlatformSignInNext = z.infer<typeof PlatformSignInNext>;

export const PlatformSignInResult = z.object({ next: PlatformSignInNext });
export type PlatformSignInResult = z.infer<typeof PlatformSignInResult>;

/**
 * A body or query with nothing in it: no body reads as `{}`, and any field is refused with 400
 * `validation`, so a client that sends something these routes do not take finds out.
 */
export const PlatformNoInput = z.object({}).strict().default({});
/** Nothing: no field is ever allowed. */
export type PlatformNoInput = Record<string, never>;

/** `POST /platform/auth/totp/setup`: an empty body. */
export const PlatformTotpSetupInput = PlatformNoInput;
export type PlatformTotpSetupInput = PlatformNoInput;

/**
 * A new authenticator, returned once: the base32 secret (to type in) and the otpauth URI (for the
 * QR code). `POST /platform/auth/totp/verify` with its first code turns it on.
 */
export const PlatformTotpSetup = z.object({
  secret: z.string().min(1),
  otpauthUri: z.string().startsWith('otpauth://totp/', { message: 'must be an otpauth TOTP URI' }),
});
export type PlatformTotpSetup = z.infer<typeof PlatformTotpSetup>;

/** `POST /platform/auth/totp/verify`: the authenticator's code (no recovery codes, D32). */
export const PlatformTotpVerifyInput = z.object({ code: OneTimeCode });
export type PlatformTotpVerifyInput = z.infer<typeof PlatformTotpVerifyInput>;

/** `GET /platform/me`: the signed-in console user. */
export const PlatformMe = z.object({
  id: IdSchema,
  name: z.string(),
  role: PlatformRole,
});
export type PlatformMe = z.infer<typeof PlatformMe>;
