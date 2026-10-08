import { z } from 'zod';

import { IdSchema } from '../common/ids';

/**
 * What a signed link is for (spec 05, Signed links). Each purpose has its own lifetime and
 * single-use rule (`SIGNED_LINK_RULES` in `@quad/domain`), and a link signed for one purpose never
 * verifies for another.
 */
export const SignedLinkPurpose = z.enum([
  'password_reset',
  'staff_invite',
  'guardian_invite',
  'relative_invite',
  'support_session',
  'calendar_feed',
  'email_link',
]);
export type SignedLinkPurpose = z.infer<typeof SignedLinkPurpose>;

/** 128 random bits, base64url without padding. */
export const SIGNED_LINK_NONCE_PATTERN = /^[A-Za-z0-9_-]{22}$/;

/**
 * The signed payload `{purpose, tid, sub, exp, nonce}` (spec 05; D32).
 * - `tid` is the school, or null for an account-level `password_reset` (OQ8).
 * - `sub` is the record the link is about (an account, member, invite or support visit).
 * - `exp` is the expiry in Unix seconds, or null for a purpose with no expiry (`calendar_feed`).
 * Which purposes may carry a null `tid` or `exp` is a domain rule (`signedLinkStatus`).
 */
export const SignedLinkPayloadSchema = z
  .object({
    purpose: SignedLinkPurpose,
    tid: IdSchema.nullable(),
    sub: IdSchema,
    exp: z.number().int().positive().nullable(),
    nonce: z.string().regex(SIGNED_LINK_NONCE_PATTERN),
  })
  .strict();
export type SignedLinkPayload = z.infer<typeof SignedLinkPayloadSchema>;
