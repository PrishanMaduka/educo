import { z } from 'zod';

import { IdSchema } from '../common/ids';
import { MeBrand } from '../me/me';

/**
 * Staff sign-in (spec 05 → Staff portal; spec 06 → Me and auth). Identifier first: the page asks
 * for the work email, then the password (D37: the only staff method), then two-step and the school.
 */

/** A work email, trimmed and lower-cased, so two spellings are one address. */
export const SignInEmail = z
  .string({ required_error: 'Enter your work email' })
  .trim()
  .toLowerCase()
  .max(254, { message: 'Enter a shorter email address' })
  .email({ message: 'Enter a valid email address' });
export type SignInEmail = z.infer<typeof SignInEmail>;

/**
 * A password as typed at sign-in. The policy (length, breached list) applies only when one is
 * set; the upper bound keeps an Argon2 verify cheap.
 */
const TypedPassword = z
  .string({ required_error: 'Enter your password' })
  .min(1, { message: 'Enter your password' })
  .max(1024, { message: 'That password is too long' });

/** A way to sign in: a school's SSO for the email's domain, or a password. */
export const SignInMethod = z.enum(['sso:google', 'sso:microsoft', 'password']);
export type SignInMethod = z.infer<typeof SignInMethod>;

/** `POST /auth/password`. */
export const PasswordSignInInput = z.object({
  email: SignInEmail,
  password: TypedPassword,
  /** "Keep me signed in on this device": 30 days instead of the school's idle timeout. */
  keepSignedIn: z.boolean().default(false),
});
export type PasswordSignInInput = z.infer<typeof PasswordSignInInput>;

/**
 * What the page shows next (`nextSignInStep` in `@quad/domain`): the authenticator code, setting
 * one up, Choose a school, "not linked to a school yet", or the portal.
 */
export const SignInNext = z.enum([
  'two_step',
  'two_step_setup',
  'choose_school',
  'no_school',
  'done',
]);
export type SignInNext = z.infer<typeof SignInNext>;

export const SignInResult = z.object({ next: SignInNext });
export type SignInResult = z.infer<typeof SignInResult>;

/** Six digits from an authenticator (spec 05). */
export const OneTimeCode = z.string().regex(/^\d{6}$/, { message: 'Enter the 6-digit code' });

/** `POST /auth/totp/verify`: exactly one of a code and a recovery code. */
export const TotpVerifyInput = z
  .object({
    code: OneTimeCode.optional(),
    recoveryCode: z
      .string()
      .trim()
      .min(1, { message: 'Enter a recovery code' })
      .max(40, { message: 'Enter a recovery code' })
      .optional(),
    /** "Trust this device for 30 days". */
    trustDevice: z.boolean().default(false),
  })
  .superRefine((input, context) => {
    if ((input.code === undefined) === (input.recoveryCode === undefined)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['code'],
        message: 'Enter the 6-digit code or a recovery code',
      });
    }
  });
export type TotpVerifyInput = z.infer<typeof TotpVerifyInput>;

/** One school on Choose a school (`GET /auth/memberships`): staff memberships only. */
export const SignInMembership = z.object({
  tenantId: IdSchema,
  name: z.string(),
  shortName: z.string(),
  /** Null until school logos are stored as files (M4). */
  logoUrl: z.string().url().nullable(),
  brand: MeBrand,
  /** Primary role first. */
  roleNames: z.array(z.string()),
  /** A suspended school is listed with its reason and cannot be opened (spec 05, 07). */
  suspended: z.boolean(),
  suspendReason: z.string().nullable(),
});
export type SignInMembership = z.infer<typeof SignInMembership>;

export const SignInMembershipList = z.object({ items: z.array(SignInMembership) });
export type SignInMembershipList = z.infer<typeof SignInMembershipList>;

/** `POST /auth/select-school`. The tenant comes only from this, checked against the account. */
export const SelectSchoolInput = z.object({
  tenantId: IdSchema,
  /** "Remember my choice on this device": the non-sensitive `quad_last_school` cookie. */
  remember: z.boolean().default(false),
});
export type SelectSchoolInput = z.infer<typeof SelectSchoolInput>;

/** `POST /auth/password/forgot`. */
export const PasswordForgotInput = z.object({ email: SignInEmail });
export type PasswordForgotInput = z.infer<typeof PasswordForgotInput>;

/** `POST /auth/password/reset`: the signed link's token and the new password. */
export const PasswordResetInput = z.object({
  token: z
    .string({ required_error: 'The link is missing' })
    .min(1, { message: 'The link is missing' })
    .max(2048, { message: 'The link is not valid' }),
  password: z
    .string({ required_error: 'Choose a new password' })
    .min(1, { message: 'Choose a new password' })
    .max(1024, { message: 'That password is too long' }),
});
export type PasswordResetInput = z.infer<typeof PasswordResetInput>;
