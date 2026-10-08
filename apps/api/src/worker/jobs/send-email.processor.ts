import { UnrecoverableError } from 'bullmq';

import { EmailJobSchema, buildEmailMessage } from '../../common/delivery/email';
import { EMAIL_QUEUE } from '../../common/delivery/queues';
import { runWithJobContext } from '../../common/request-context';

import { DeliveryFailedError } from './delivery-failure';

import type { DeliveryJobLike, OnceStore } from './once';
import type { EmailMessage, EmailSettings, EmailTransport } from '../../common/delivery/email';

export interface SendEmailDeps {
  readonly transport: EmailTransport;
  readonly once: OnceStore;
  readonly settings: EmailSettings;
}

/**
 * The `send-email` processor. It parses the payload (a bad one fails at once, without retries),
 * runs in the job tenant's context, renders the template and sends it, once per job id: a job
 * that runs again after a send (a retry after a crash, a stalled job) sends nothing.
 */
export function createSendEmailProcessor(deps: SendEmailDeps) {
  return async (job: DeliveryJobLike): Promise<void> => {
    const parsed = EmailJobSchema.safeParse(job.data);
    if (!parsed.success || job.id === undefined) {
      throw new UnrecoverableError('The send-email job payload is not valid.');
    }
    const data = parsed.data;
    const done = `${EMAIL_QUEUE}:${job.id}`;
    await runWithJobContext(`${EMAIL_QUEUE}.${job.id}`, data.tenantId, async () => {
      if (await deps.once.isDone(done)) return;
      let message: EmailMessage;
      try {
        message = buildEmailMessage(data, deps.settings);
      } catch {
        // Wrong parameters or a link outside the web app: retrying cannot help.
        throw new UnrecoverableError(`The ${data.template} email could not be rendered.`);
      }
      try {
        await deps.transport.send(message);
      } catch (error) {
        throw new DeliveryFailedError('email', error);
      }
      await deps.once.markDone(done);
    });
  };
}
