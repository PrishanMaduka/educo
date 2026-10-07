import { z } from 'zod';

/**
 * `POST /webhooks/ses` (spec 20, Email): SES bounce and complaint events delivered by SNS. The
 * envelope is what SNS posts (as `text/plain`); the API checks its topic and signature before it
 * reads anything inside `Message`. Field names are AWS's, so they stay PascalCase.
 */
export const SnsMessageType = z.enum([
  'Notification',
  'SubscriptionConfirmation',
  'UnsubscribeConfirmation',
]);
export type SnsMessageType = z.infer<typeof SnsMessageType>;

export const SnsEnvelopeSchema = z.object({
  Type: SnsMessageType,
  MessageId: z.string().min(1),
  TopicArn: z.string().min(1),
  Message: z.string(),
  Timestamp: z.string().datetime({ offset: true }),
  SignatureVersion: z.string(),
  Signature: z.string().min(1),
  SigningCertURL: z.string().min(1),
  Subject: z.string().optional(),
  SubscribeURL: z.string().optional(),
  Token: z.string().optional(),
});
export type SnsEnvelope = z.infer<typeof SnsEnvelopeSchema>;

/** The webhook's only success body. */
export const SesWebhookAck = z.object({ status: z.literal('ok') });
export type SesWebhookAck = z.infer<typeof SesWebhookAck>;

const SesRecipient = z.object({ emailAddress: z.string().email() });

/**
 * The SES event inside a Notification's `Message`: `eventType` for configuration-set event
 * publishing, `notificationType` for identity feedback notifications. Only the fields the
 * webhook reads are listed; the rest are ignored.
 */
export const SesEventSchema = z.object({
  eventType: z.string().optional(),
  notificationType: z.string().optional(),
  bounce: z.object({ bounceType: z.string(), bouncedRecipients: z.array(SesRecipient) }).optional(),
  complaint: z.object({ complainedRecipients: z.array(SesRecipient) }).optional(),
});
export type SesEvent = z.infer<typeof SesEventSchema>;
