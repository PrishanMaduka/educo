import { z } from 'zod';

import { defineEmailTemplate } from './email-template';
import { Count, Link, PersonName } from './params';

/** A school invites a member of staff (Task 13; `staff_invite` link, 7 days, OQ7). */
export const staffInviteEmail = defineEmailTemplate({
  sender: 'school',
  params: z
    .object({ name: PersonName.optional(), inviter: PersonName, link: Link, days: Count })
    .strict(),
  values: ({ inviter, days }) => ({ inviter, days }),
  name: ({ name }) => name,
  subject: 'email.staffInvite.subject',
  body: ['email.staffInvite.body'],
  action: { label: 'email.staffInvite.action', link: ({ link }) => link },
  after: ['email.staffInvite.expiry'],
});
