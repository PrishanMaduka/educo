import { z } from 'zod';

import { defineEmailTemplate } from './email-template';

/**
 * The requester's confirmation (D57): fixed copy only. Its one parameter is the kind of request,
 * so nothing the visitor typed (name, school, note) can reach the email, and the demo form can
 * never be used to send someone else a message.
 */
export const demoRequestConfirmationEmail = defineEmailTemplate({
  sender: 'account',
  params: z.object({ kind: z.enum(['school', 'parent']) }).strict(),
  values: () => ({}),
  subject: ({ kind }) =>
    kind === 'school'
      ? 'email.demoRequestConfirmation.subject.school'
      : 'email.demoRequestConfirmation.subject.parent',
  body: ({ kind }) => [
    kind === 'school'
      ? 'email.demoRequestConfirmation.body.school'
      : 'email.demoRequestConfirmation.body.parent',
  ],
  after: ['email.demoRequestConfirmation.notYou'],
  footer: 'email.demoRequestConfirmation.footer',
  footerLink: { label: 'email.demoRequestConfirmation.privacy', path: '/legal/privacy' },
});
