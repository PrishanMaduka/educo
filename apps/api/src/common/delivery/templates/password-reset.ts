import { z } from 'zod';

import { defineEmailTemplate } from './email-template';
import { Count, Link, PersonName } from './params';

/** Forgot password and an admin's Reset password (spec 05 step 6; 30 minutes, single use). */
export const passwordResetEmail = defineEmailTemplate({
  sender: 'account',
  params: z.object({ name: PersonName.optional(), link: Link, minutes: Count }).strict(),
  values: ({ minutes }) => ({ minutes }),
  name: ({ name }) => name,
  subject: 'email.passwordReset.subject',
  body: ['email.passwordReset.body'],
  action: { label: 'email.passwordReset.action', link: ({ link }) => link },
  after: ['email.passwordReset.expiry'],
});
