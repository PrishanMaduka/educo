import { z } from 'zod';

import { defineEmailTemplate } from './email-template';
import { Link, PersonName } from './params';

/** Users & roles → Remind: asks a member of staff to set up two-step sign-in (spec 08). */
export const twoStepReminderEmail = defineEmailTemplate({
  sender: 'school',
  params: z.object({ name: PersonName.optional(), link: Link }).strict(),
  values: () => ({}),
  name: ({ name }) => name,
  subject: 'email.twoStepReminder.subject',
  body: ['email.twoStepReminder.body'],
  action: { label: 'email.twoStepReminder.action', link: ({ link }) => link },
});
