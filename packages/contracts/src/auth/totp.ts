import { z } from 'zod';

import { InviteTokenHint, OneTimeCode, SignInNext } from './sign-in';

/**
 * `POST /me/totp` (spec 05 step 4; spec 06 Me and auth): without a code it starts a new
 * authenticator, with the code from that authenticator it confirms it.
 */
export const TotpSetupInput = z.object({
  code: OneTimeCode.optional(),
  /** On the invite page: the invitation's token as a hint (`InviteTokenHint`). */
  inviteToken: InviteTokenHint.optional(),
});
export type TotpSetupInput = z.infer<typeof TotpSetupInput>;

/**
 * Start: `otpauthUri` for the QR code (the rest null). Confirm: the 10 recovery codes, shown
 * once, and, when this finished a sign-in step, the next step (null for a signed-in person).
 */
export const TotpSetupResult = z.object({
  otpauthUri: z
    .string()
    .startsWith('otpauth://totp/', { message: 'must be an otpauth TOTP URI' })
    .nullable(),
  recoveryCodes: z.array(z.string()).nullable(),
  next: SignInNext.nullable(),
});
export type TotpSetupResult = z.infer<typeof TotpSetupResult>;
