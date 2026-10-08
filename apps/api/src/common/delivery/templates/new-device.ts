import { z } from 'zod';

import { defineEmailTemplate } from './email-template';
import { Link, PersonName, TimeZone } from './params';

/** "8 October 2026 at 09:30 GMT+5:30": the sign-in time in the given zone, with its offset. */
function signInTime(signedInAt: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'shortOffset',
    timeZone,
  }).format(new Date(signedInAt));
}

/** A sign-in from a device without the trusted-device cookie (spec 16; Task 7 sends it). */
export const newDeviceEmail = defineEmailTemplate({
  sender: 'account',
  params: z
    .object({
      name: PersonName.optional(),
      /** A short description such as "Chrome on Windows", never the raw user agent. */
      device: z.string().trim().min(1).max(120),
      signedInAt: z.string().datetime(),
      timeZone: TimeZone,
      link: Link,
    })
    .strict(),
  values: ({ device, signedInAt, timeZone }) => ({
    device,
    when: signInTime(signedInAt, timeZone),
  }),
  name: ({ name }) => name,
  subject: 'email.newDevice.subject',
  body: ['email.newDevice.body', 'email.newDevice.advice'],
  action: { label: 'email.newDevice.action', link: ({ link }) => link },
});
