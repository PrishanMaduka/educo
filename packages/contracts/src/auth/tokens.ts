import { z } from 'zod';

import { IdSchema } from '../common/ids';

import { ParentMembershipKind } from './otp';

/**
 * The parent app's tokens (spec 05 → Parent app step 5; D32): an EdDSA access JWT that lives 15
 * minutes and a rotating refresh token whose family lives 60 days.
 */

/**
 * `{sessionId}.{generation}.{secret}`: the family (`sessions.id`, lower-case uuid), its
 * generation (no leading zeros) and 64 bytes in base64url without padding (a random value and
 * the server's MAC over the family and generation).
 */
export const RefreshToken = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:0|[1-9]\d{0,8})\.[A-Za-z0-9_-]{86}$/,
    { message: 'Sign in again' },
  );

/** `POST /auth/refresh`: the refresh token only; a refresh never changes the school. */
export const RefreshInput = z.object({ refreshToken: RefreshToken }).strict();
export type RefreshInput = z.infer<typeof RefreshInput>;

/** A new access token and the family's next refresh token (the old one is now spent). */
export const TokenPair = z.object({ accessToken: z.string(), refreshToken: z.string() });
export type TokenPair = z.infer<typeof TokenPair>;

/** The registered claims every access token carries (checked by the API on every request). */
const Registered = {
  iss: z.string(),
  aud: z.string(),
  iat: z.number().int(),
  exp: z.number().int(),
};

/**
 * The access JWT in a school: `sub` the membership (`users.id`), `acc` the account, `tid` the
 * school, `kind` guardian or relative, `rh` the roles hash and `sid` the refresh family.
 */
export const TenantTokenClaims = z.object({
  ...Registered,
  scope: z.literal('tenant'),
  sub: IdSchema,
  acc: IdSchema,
  tid: IdSchema,
  kind: ParentMembershipKind,
  rh: z.string().min(1),
  sid: IdSchema,
});
export type TenantTokenClaims = z.infer<typeof TenantTokenClaims>;

/**
 * The 5-minute token that only chooses a school (OQ20): `sub` and `acc` the account, `sid` the
 * family that is waiting for a school.
 */
export const SelectSchoolTokenClaims = z.object({
  ...Registered,
  scope: z.literal('select_school'),
  sub: IdSchema,
  acc: IdSchema,
  sid: IdSchema,
});
export type SelectSchoolTokenClaims = z.infer<typeof SelectSchoolTokenClaims>;

export const BearerClaims = z.discriminatedUnion('scope', [
  TenantTokenClaims,
  SelectSchoolTokenClaims,
]);
export type BearerClaims = z.infer<typeof BearerClaims>;
