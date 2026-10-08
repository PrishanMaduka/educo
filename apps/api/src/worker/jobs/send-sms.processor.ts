import { UnrecoverableError } from 'bullmq';

import { SMS_QUEUE } from '../../common/delivery/queues';
import { SmsJobSchema } from '../../common/delivery/sms';
import { SMS_TEMPLATES } from '../../common/delivery/templates';
import { runWithJobContext } from '../../common/request-context';

import { DeliveryFailedError } from './delivery-failure';

import type { DeliveryJobLike, OnceStore } from './once';
import type { SmsSender } from '../../common/delivery/sms';
import type { RenderedSms } from '../../common/delivery/templates';

export interface SendSmsDeps {
  readonly sender: SmsSender;
  readonly once: OnceStore;
}

/** The `send-sms` processor: as `send-email`, for SMS. */
export function createSendSmsProcessor(deps: SendSmsDeps) {
  return async (job: DeliveryJobLike): Promise<void> => {
    const parsed = SmsJobSchema.safeParse(job.data);
    if (!parsed.success || job.id === undefined) {
      throw new UnrecoverableError('The send-sms job payload is not valid.');
    }
    const data = parsed.data;
    const done = `${SMS_QUEUE}:${job.id}`;
    await runWithJobContext(`${SMS_QUEUE}.${job.id}`, data.tenantId, async () => {
      if (await deps.once.isDone(done)) return;
      let rendered: RenderedSms;
      try {
        rendered = SMS_TEMPLATES[data.template].render(data.params);
      } catch {
        throw new UnrecoverableError(`The ${data.template} SMS could not be rendered.`);
      }
      try {
        await deps.sender.send({ to: data.to, ...rendered });
      } catch (error) {
        throw new DeliveryFailedError('sms', error);
      }
      await deps.once.markDone(done);
    });
  };
}
