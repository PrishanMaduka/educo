import { describe, expect, it } from 'vitest';

import { EmailSuppressionReason, SesEventSchema, SesWebhookAck, SnsEnvelopeSchema } from '../index';

const notification = {
  Type: 'Notification',
  MessageId: '22b80b92-fdea-4c2c-8f9d-bdfb0c7bf324',
  TopicArn: 'arn:aws:sns:ap-south-1:123456789012:quad-staging-ses-events',
  Subject: 'Amazon SES Email Event Notification',
  Message: '{"eventType":"Bounce"}',
  Timestamp: '2026-10-07T10:00:00.000Z',
  SignatureVersion: '2',
  Signature: 'c2lnbmF0dXJl',
  SigningCertURL: 'https://sns.ap-south-1.amazonaws.com/SimpleNotificationService-abc.pem',
  UnsubscribeURL: 'https://sns.ap-south-1.amazonaws.com/?Action=Unsubscribe',
};

describe('SNS envelope (POST /webhooks/ses)', () => {
  it('parses a sample notification', () => {
    const parsed = SnsEnvelopeSchema.parse(notification);
    expect(parsed.Type).toBe('Notification');
    expect(parsed.Subject).toBe('Amazon SES Email Event Notification');
  });

  it('parses a subscription confirmation with its SubscribeURL and Token', () => {
    const parsed = SnsEnvelopeSchema.parse({
      ...notification,
      Subject: undefined,
      Type: 'SubscriptionConfirmation',
      SubscribeURL: 'https://sns.ap-south-1.amazonaws.com/?Action=ConfirmSubscription',
      Token: 'token-value',
    });
    expect(parsed.SubscribeURL).toMatch(/ConfirmSubscription/);
    expect(parsed.Token).toBe('token-value');
  });

  it('rejects an unknown Type at Type', () => {
    const result = SnsEnvelopeSchema.safeParse({ ...notification, Type: 'Other' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['Type']);
  });

  it('rejects a missing Signature at Signature', () => {
    const result = SnsEnvelopeSchema.safeParse({ ...notification, Signature: undefined });
    expect(result.error?.issues[0]?.path).toEqual(['Signature']);
  });

  it('acknowledges with status ok only', () => {
    expect(SesWebhookAck.safeParse({ status: 'ok' }).success).toBe(true);
    expect(SesWebhookAck.safeParse({ status: 'done' }).success).toBe(false);
  });
});

describe('SNS envelope size limits', () => {
  it.each([
    ['MessageId', 128],
    ['TopicArn', 512],
    ['Message', 262_144],
    ['SignatureVersion', 8],
    ['Signature', 1024],
    ['SigningCertURL', 2048],
    ['Subject', 512],
    ['SubscribeURL', 2048],
    ['Token', 2048],
  ] as const)('accepts %s at %i characters and refuses one more', (field, max) => {
    expect(SnsEnvelopeSchema.safeParse({ ...notification, [field]: 'x'.repeat(max) }).success).toBe(
      true,
    );
    const result = SnsEnvelopeSchema.safeParse({ ...notification, [field]: 'x'.repeat(max + 1) });
    expect(result.error?.issues[0]?.path).toEqual([field]);
  });
});

describe('SES event inside the SNS Message', () => {
  it('reads a permanent bounce from an event publishing message (eventType)', () => {
    const parsed = SesEventSchema.parse({
      eventType: 'Bounce',
      bounce: { bounceType: 'Permanent', bouncedRecipients: [{ emailAddress: 'a@example.com' }] },
      mail: { messageId: 'x' },
    });
    expect(parsed.bounce?.bouncedRecipients[0]?.emailAddress).toBe('a@example.com');
  });

  it('reads a complaint from a feedback notification (notificationType)', () => {
    const parsed = SesEventSchema.parse({
      notificationType: 'Complaint',
      complaint: { complainedRecipients: [{ emailAddress: 'b@example.com' }] },
    });
    expect(parsed.notificationType).toBe('Complaint');
  });

  it('keeps the other recipients when one is malformed (the domain filters it out)', () => {
    const parsed = SesEventSchema.parse({
      eventType: 'Bounce',
      bounce: {
        bounceType: 'Permanent',
        bouncedRecipients: [
          { emailAddress: 'nope' },
          { emailAddress: 42 },
          'not an object',
          { emailAddress: 'ok@example.com' },
        ],
      },
    });
    expect(parsed.bounce?.bouncedRecipients.map((r) => r.emailAddress)).toEqual([
      'nope',
      '',
      '',
      'ok@example.com',
    ]);
  });

  it('lists the suppression reasons in spec 04 order', () => {
    expect(EmailSuppressionReason.options).toEqual(['bounce', 'complaint', 'manual']);
  });
});
