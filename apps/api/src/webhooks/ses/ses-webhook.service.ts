import { Inject, Injectable } from '@nestjs/common';
import { SesEventSchema, SnsEnvelopeSchema } from '@quad/contracts';
import { suppressionsFromSesEvent } from '@quad/domain';

import { ForbiddenError } from '../../common/errors';
import { CONFIG, LOGGER, SNS_KEY_FETCHER, SNS_SUBSCRIBE_FETCHER, TENANT_DB } from '../../tokens';

import {
  cachedKeyGetter,
  isAwsSnsUrl,
  isFreshSnsTimestamp,
  isSigningCertForTopic,
  verifySnsSignature,
} from './sns-signature';

import type { SnsFetchers } from './ses-webhook.module';
import type { SnsKeyGetter } from './sns-signature';
import type { Config } from '../../config';
import type { SesEvent, SesWebhookAck, SnsEnvelope } from '@quad/contracts';
import type { QuadTenantDb } from '@quad/db';
import type { Logger } from 'pino';

/** Where the suppressions this webhook writes come from (`email_suppressions.source`). */
const SOURCE = 'ses';

/** Why a message was refused; logged, never sent back. */
type Refusal =
  'envelope' | 'topic' | 'cert_url' | 'version' | 'stale' | 'signature' | 'subscribe_url';

const OK: SesWebhookAck = { status: 'ok' };

@Injectable()
export class SesWebhookService {
  private readonly getKey: SnsKeyGetter;
  private readonly logger: Logger;

  constructor(
    @Inject(CONFIG) private readonly config: Config,
    @Inject(LOGGER) logger: Logger,
    @Inject(TENANT_DB) private readonly db: QuadTenantDb,
    @Inject(SNS_KEY_FETCHER) fetchKey: SnsFetchers['key'],
    @Inject(SNS_SUBSCRIBE_FETCHER) private readonly subscribe: SnsFetchers['subscribe'],
  ) {
    this.getKey = cachedKeyGetter(fetchKey);
    this.logger = logger.child({ module: 'ses-webhook' });
  }

  /**
   * Checks, in order and before any fetch or write: the envelope shape, the pinned topic, the
   * signing host (AWS SNS, in the topic's region), SignatureVersion 2, the replay window, and
   * the signature itself. Then confirms a subscription or records the SES event.
   */
  async receive(body: unknown): Promise<SesWebhookAck> {
    const parsed = SnsEnvelopeSchema.safeParse(body);
    if (!parsed.success) {
      return this.refuse('envelope');
    }
    const message = parsed.data;
    const refusal = this.precheck(message);
    if (refusal !== null) {
      return this.refuse(refusal, message);
    }
    if (!(await verifySnsSignature(message, this.getKey))) {
      return this.refuse('signature', message);
    }
    switch (message.Type) {
      case 'SubscriptionConfirmation':
        return this.confirm(message);
      case 'UnsubscribeConfirmation':
        this.logger.warn({ messageId: message.MessageId }, 'SNS unsubscribed the SES webhook');
        return OK;
      case 'Notification':
        return this.record(message);
    }
  }

  private precheck(message: SnsEnvelope): Refusal | null {
    const topic = this.config.SES_SNS_TOPIC_ARN;
    if (topic === undefined || message.TopicArn !== topic) return 'topic';
    if (!isSigningCertForTopic(message.SigningCertURL, topic)) return 'cert_url';
    if (message.SignatureVersion !== '2') return 'version';
    if (!isFreshSnsTimestamp(message.Timestamp, Date.now())) return 'stale';
    return null;
  }

  private async confirm(message: SnsEnvelope): Promise<SesWebhookAck> {
    const url = message.SubscribeURL;
    if (url === undefined || !isAwsSnsUrl(url)) {
      return this.refuse('subscribe_url', message);
    }
    await this.subscribe(url);
    this.logger.info(
      { messageId: message.MessageId },
      'Confirmed the SES webhook SNS subscription',
    );
    return OK;
  }

  private async record(message: SnsEnvelope): Promise<SesWebhookAck> {
    const event = parseSesEvent(message.Message);
    if (event === null) {
      this.logger.warn({ messageId: message.MessageId }, 'SNS notification was not an SES event');
      return OK;
    }
    const suppressions = suppressionsFromSesEvent(event);
    for (const suppression of suppressions) {
      await this.db.definers.recordEmailSuppression({ ...suppression, source: SOURCE });
    }
    // Counts only: addresses are personal data and never logged.
    this.logger.info(
      { messageId: message.MessageId, suppressed: suppressions.length },
      'Recorded SES event',
    );
    return OK;
  }

  private refuse(reason: Refusal, message?: SnsEnvelope): never {
    this.logger.warn({ reason, messageId: message?.MessageId }, 'Refused an SNS message');
    throw new ForbiddenError();
  }
}

function parseSesEvent(text: string): SesEvent | null {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const result = SesEventSchema.safeParse(json);
  return result.success ? result.data : null;
}
