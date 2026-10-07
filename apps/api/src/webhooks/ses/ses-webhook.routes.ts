import { SesWebhookAck, SnsEnvelopeSchema } from '@quad/contracts';

import { named } from '../../openapi/registry';

import type { ApiRoute } from '../../openapi/registry';

const Envelope = named('SnsEnvelope', SnsEnvelopeSchema);
const Ack = named('SesWebhookAck', SesWebhookAck);

export const sesWebhookRoutes: readonly ApiRoute[] = [
  {
    method: 'post',
    path: '/webhooks/ses',
    summary: 'SES bounce and complaint events from SNS (signature version 2, pinned topic)',
    tags: ['webhooks'],
    request: { body: Envelope },
    responses: { 200: { description: 'Accepted', schema: Ack } },
    errors: [400, 403, 413],
    // An SNS message is at most 256 KB; the envelope adds a few hundred bytes.
    bodyLimit: 300 * 1024,
  },
];
