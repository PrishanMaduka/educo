import { z } from 'zod';

import { defineEmailTemplate } from './email-template';
import { Count, Link, PersonName } from './params';

/** Sent when failed sign-ins lock an account (spec 05 step 7: five in 15 minutes, 15 minutes). */
export const lockoutEmail = defineEmailTemplate({
  sender: 'account',
  params: z
    .object({ name: PersonName.optional(), attempts: Count, minutes: Count, link: Link })
    .strict(),
  values: ({ attempts, minutes }) => ({ attempts, minutes }),
  name: ({ name }) => name,
  subject: 'email.lockout.subject',
  body: ['email.lockout.body', 'email.lockout.advice'],
  action: { label: 'email.lockout.action', link: ({ link }) => link },
});
