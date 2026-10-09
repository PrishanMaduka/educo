import { z } from 'zod';

import { MembershipKind } from '../enums';

import { OneTimeCode, SignInEmail, SignInMembership } from './sign-in';

/**
 * Parent sign-in with a one-time code (spec 05 → Parent app; spec 06 → Me and auth). Tenant-less:
 * the school comes only from the account's own guardian and relative memberships once the code
 * is right, never from these inputs.
 */

/**
 * A mobile number with its country code, as typed (`+94 77 000 0001`). The API checks it against
 * the country list (`parseInternationalPhone` in `@quad/domain`; Sri Lanka only for now, OQ12).
 */
export const SignInPhone = z
  .string({
    required_error: 'Enter your mobile number',
    invalid_type_error: 'Enter your mobile number',
  })
  .trim()
  .min(1, { message: 'Enter your mobile number' })
  .max(32, { message: 'Enter a shorter mobile number' });

const subjectFields = { phone: SignInPhone.optional(), email: SignInEmail.optional() };

/** Exactly one of a phone number and an email ("Use email instead"). */
function exactlyOneSubject(input: { phone?: string; email?: string }, context: z.RefinementCtx) {
  if ((input.phone === undefined) === (input.email === undefined)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['phone'],
      message: 'Enter your mobile number or your email',
    });
  }
}

/** `POST /auth/otp/request`: answers 202 whether or not the number or address is known. */
export const OtpRequestInput = z.object(subjectFields).strict().superRefine(exactlyOneSubject);
export type OtpRequestInput = z.infer<typeof OtpRequestInput>;

/** `POST /auth/otp/verify`: the same subject and the 6-digit code. */
export const OtpVerifyInput = z
  .object({ ...subjectFields, code: OneTimeCode })
  .strict()
  .superRefine(exactlyOneSubject);
export type OtpVerifyInput = z.infer<typeof OtpVerifyInput>;

/** The memberships bearer tokens are for (the kind rule, D32): never `staff`. */
export const ParentMembershipKind = MembershipKind.extract(['guardian', 'relative']);
export type ParentMembershipKind = z.infer<typeof ParentMembershipKind>;

/** One school on the parent app's school picker (spec 09 Start-up). */
export const ParentMembership = SignInMembership.omit({ roleNames: true }).extend({
  kind: ParentMembershipKind,
});
export type ParentMembership = z.infer<typeof ParentMembership>;

/**
 * What the code found (spec 05 step 4): one school signs in at once, several need the school
 * picker first (with a 5-minute `select_school` access token, OQ20), none is "We couldn't find
 * you".
 */
export const OtpVerifyStatus = z.enum(['signed_in', 'choose_school', 'not_found']);
export type OtpVerifyStatus = z.infer<typeof OtpVerifyStatus>;

export const OtpVerifyResult = z.object({
  status: OtpVerifyStatus,
  /** The person's first name in the school they are signed in to (`signed_in`). */
  firstName: z.string().optional(),
  /** Their guardian and relative memberships; empty for `not_found`. */
  memberships: z.array(ParentMembership),
  /** `signed_in`: the school's access token; `choose_school`: the `select_school` token. */
  accessToken: z.string().optional(),
  /** `signed_in` only: the first token of a new refresh family. */
  refreshToken: z.string().optional(),
});
export type OtpVerifyResult = z.infer<typeof OtpVerifyResult>;
