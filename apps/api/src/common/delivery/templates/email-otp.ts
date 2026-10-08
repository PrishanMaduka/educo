import { z } from 'zod';

import { defineEmailTemplate } from './email-template';
import { Count, OneTimeCode } from './params';

/** A parent's sign-in code by email (spec 05 → Parents step 3; 10 minutes). */
export const emailOtpEmail = defineEmailTemplate({
  sender: 'account',
  params: z.object({ code: OneTimeCode, minutes: Count }).strict(),
  values: ({ code, minutes }) => ({ code, minutes }),
  subject: 'email.otp.subject',
  body: ['email.otp.body'],
  after: ['email.otp.expiry'],
});
