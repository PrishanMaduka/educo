import { currentRequestContext } from '../../src/common/request-context';

import type { EmailMessage, EmailTransport } from '../../src/common/delivery/email';

export interface SentEmail {
  readonly message: EmailMessage;
  /** The tenant of the request (or job) context the send ran in. */
  readonly tenantId: string | null;
}

/** An email provider that records what it is given (tests never reach SMTP or SES). */
export class FakeEmailTransport implements EmailTransport {
  readonly sent: SentEmail[] = [];
  /** When set, the next send throws this error once (a provider outage). */
  failNext: Error | undefined;

  send(message: EmailMessage): Promise<void> {
    const failure = this.failNext;
    if (failure !== undefined) {
      this.failNext = undefined;
      return Promise.reject(failure);
    }
    this.sent.push({ message, tenantId: currentRequestContext()?.tenantId ?? null });
    return Promise.resolve();
  }
}
