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

/**
 * Limits are generous for what SNS sends (a Message is at most 256 KB) and keep anything larger
 * from reaching the signature check.
 */
export const SnsEnvelopeSchema = z.object({
  Type: SnsMessageType,
  MessageId: z.string().min(1).max(128),
  TopicArn: z.string().min(1).max(512),
  Message: z.string().max(262_144),
  Timestamp: z.string().max(64).datetime({ offset: true }),
  SignatureVersion: z.string().max(8),
  Signature: z.string().min(1).max(1024),
  SigningCertURL: z.string().min(1).max(2048),
  Subject: z.string().max(512).optional(),
  SubscribeURL: z.string().max(2048).optional(),
  Token: z.string().max(2048).optional(),
});
export type SnsEnvelope = z.infer<typeof SnsEnvelopeSchema>;

/** The webhook's only success body. */
export const SesWebhookAck = z.object({ status: z.literal('ok') });
export type SesWebhookAck = z.infer<typeof SesWebhookAck>;

/**
 * Lenient on purpose: a malformed recipient becomes `emailAddress: ''` instead of failing the
 * whole event, so the valid recipients are still suppressed. `suppressionsFromSesEvent` filters
 * out addresses the database would refuse.
 */
const SesRecipient = z.object({ emailAddress: z.string().catch('') }).catch({ emailAddress: '' });

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
