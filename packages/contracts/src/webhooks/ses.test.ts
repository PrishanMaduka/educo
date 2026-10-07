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

  it('rejects a recipient that is not an email address at its path', () => {
    const result = SesEventSchema.safeParse({
      eventType: 'Bounce',
      bounce: { bounceType: 'Permanent', bouncedRecipients: [{ emailAddress: 'nope' }] },
    });
    expect(result.error?.issues[0]?.path).toEqual([
      'bounce',
      'bouncedRecipients',
      0,
      'emailAddress',
    ]);
  });

  it('lists the suppression reasons in spec 04 order', () => {
    expect(EmailSuppressionReason.options).toEqual(['bounce', 'complaint', 'manual']);
  });
});
