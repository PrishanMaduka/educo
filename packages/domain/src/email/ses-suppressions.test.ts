import { describe, expect, it } from 'vitest';

import { suppressionsFromSesEvent } from './ses-suppressions';

import type { SesEvent } from '@quad/contracts';

const recipients = (...addresses: string[]) => addresses.map((emailAddress) => ({ emailAddress }));

describe('suppressionsFromSesEvent', () => {
  it.each<{ name: string; event: SesEvent; expected: ReturnType<typeof suppressionsFromSesEvent> }>(
    [
      {
        name: 'a permanent bounce suppresses every bounced recipient as bounce',
        event: {
          eventType: 'Bounce',
          bounce: { bounceType: 'Permanent', bouncedRecipients: recipients('a@x.io', 'b@x.io') },
        },
        expected: [
          { address: 'a@x.io', reason: 'bounce' },
          { address: 'b@x.io', reason: 'bounce' },
        ],
      },
      {
        name: 'a feedback notification (notificationType) works the same way',
        event: {
          notificationType: 'Bounce',
          bounce: { bounceType: 'Permanent', bouncedRecipients: recipients('a@x.io') },
        },
        expected: [{ address: 'a@x.io', reason: 'bounce' }],
      },
      {
        name: 'a transient bounce suppresses nobody',
        event: {
          eventType: 'Bounce',
          bounce: { bounceType: 'Transient', bouncedRecipients: recipients('a@x.io') },
        },
        expected: [],
      },
      {
        name: 'an undetermined bounce suppresses nobody',
        event: {
          eventType: 'Bounce',
          bounce: { bounceType: 'Undetermined', bouncedRecipients: recipients('a@x.io') },
        },
        expected: [],
      },
      {
        name: 'a complaint suppresses every complaining recipient as complaint',
        event: {
          eventType: 'Complaint',
          complaint: { complainedRecipients: recipients('c@x.io') },
        },
        expected: [{ address: 'c@x.io', reason: 'complaint' }],
      },
      {
        name: 'a delivery suppresses nobody',
        event: { eventType: 'Delivery' },
        expected: [],
      },
      {
        name: 'a bounce without its bounce object suppresses nobody',
        event: { eventType: 'Bounce' },
        expected: [],
      },
      {
        name: 'a repeated recipient is listed once',
        event: {
          eventType: 'Complaint',
          complaint: { complainedRecipients: recipients('c@x.io', 'C@X.io') },
        },
        expected: [{ address: 'c@x.io', reason: 'complaint' }],
      },
      {
        name: 'an event with no type suppresses nobody',
        event: { bounce: { bounceType: 'Permanent', bouncedRecipients: recipients('a@x.io') } },
        expected: [],
      },
    ],
  )('$name', ({ event, expected }) => {
    expect(suppressionsFromSesEvent(event)).toEqual(expected);
  });
});
