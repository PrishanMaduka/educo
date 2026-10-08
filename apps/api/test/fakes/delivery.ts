import { prepareEmailJob, prepareSmsJob } from '../../src/common/delivery/delivery.service';
import { currentRequestContext } from '../../src/common/request-context';

import type {
  DeliveryQueue,
  QueueEmailInput,
  QueueSmsInput,
} from '../../src/common/delivery/delivery.service';
import type { EmailJob } from '../../src/common/delivery/email';
import type { SmsJob } from '../../src/common/delivery/sms';
import type { EmailTemplateId, SmsTemplateId } from '../../src/common/delivery/templates';

export interface QueuedJob<T> {
  readonly jobId: string;
  readonly job: T;
}

/**
 * Records queued email and SMS jobs instead of adding them to BullMQ (`AppOverrides.delivery`).
 * It checks each job exactly as the real queue does, so a bad template call still fails.
 */
export class RecordingDelivery implements DeliveryQueue {
  readonly emails: QueuedJob<EmailJob>[] = [];
  readonly sms: QueuedJob<SmsJob>[] = [];

  queueEmail<T extends EmailTemplateId>(input: QueueEmailInput<T>): Promise<void> {
    const prepared = prepareEmailJob(input, currentRequestContext()?.tenantId ?? null);
    this.emails.push(prepared);
    return Promise.resolve();
  }

  queueSms<T extends SmsTemplateId>(input: QueueSmsInput<T>): Promise<void> {
    const prepared = prepareSmsJob(input, currentRequestContext()?.tenantId ?? null);
    this.sms.push(prepared);
    return Promise.resolve();
  }
}
