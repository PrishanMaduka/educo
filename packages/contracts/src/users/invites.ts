import { z } from 'zod';

/**
 * The staff invite link (spec 05 Account edge cases; spec 06 Invites; OQ9): a signed
 * `staff_invite` token in the path of `/sign-in/invite/{token}`.
 */

/** `:token`: a signed link, never longer than any link Quad hands out. */
export const InviteTokenParams = z.object({
  token: z.string().min(1).max(2048),
});
export type InviteTokenParams = z.infer<typeof InviteTokenParams>;

/**
 * `GET /auth/invites/:token`: what the invite page shows. Only the school, the name the school
 * gave (if any), the address masked (`maskEmail`) and whether a password must be chosen here (a new
 * account) or the person signs in first (an existing one).
 */
export const InviteDetails = z.object({
  school: z.string(),
  /**
   * The name the school gave the invitee; left out while it is still the one made from the address
   * (`nameFromEmail`), which would spell out the masked part (fix round 1, M7).
   */
  name: z.string().optional(),
  emailMasked: z.string(),
  needsPassword: z.boolean(),
});
export type InviteDetails = z.infer<typeof InviteDetails>;

/**
 * `POST /auth/invites/:token/accept`: a new account chooses its password here (the policy and the
 * breached list apply); an existing account sends none and must be signed in.
 */
export const InviteAcceptInput = z
  .object({
    password: z
      .string()
      .min(1, { message: 'Choose a password' })
      .max(1024, { message: 'That password is too long' })
      .optional(),
  })
  .strict();
export type InviteAcceptInput = z.infer<typeof InviteAcceptInput>;
