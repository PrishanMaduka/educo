import { currentRequestContext } from '../../src/common/request-context';

import type { SmsMessage, SmsSender } from '../../src/common/delivery/sms';

export interface SentSms {
  readonly message: SmsMessage;
  /** The tenant of the request (or job) context the send ran in. */
  readonly tenantId: string | null;
}

/** An SMS provider that records what it is given (tests never reach Notify.lk or Twilio). */
export class FakeSmsSender implements SmsSender {
  readonly sent: SentSms[] = [];

  send(message: SmsMessage): Promise<void> {
    this.sent.push({ message, tenantId: currentRequestContext()?.tenantId ?? null });
    return Promise.resolve();
  }
}
