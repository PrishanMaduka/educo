import type { DemoRequestBody } from '@quad/contracts';
import type { Logger } from 'pino';

type AntiSpamField = 'turnstileToken' | 'website';

/** The request as the visitor sent it, without the anti-spam fields (one shape per `kind`). */
export type DemoRequestDetails =
  | Omit<Extract<DemoRequestBody, { kind: 'school' }>, AntiSpamField>
  | Omit<Extract<DemoRequestBody, { kind: 'parent' }>, AntiSpamField>;

/** `sales` goes to `SALES_INBOX`; `confirm` goes to the requester (Task 5 renders both). */
export type DemoRequestEmailKind = 'sales' | 'confirm';

/** One email about a stored lead. The job id holds only the lead id, never personal data. */
export interface DemoRequestEmail {
  /** `demo-request.<leadId>.<sales|confirm>`: one `send-email` job per id. */
  readonly jobId: string;
  readonly kind: DemoRequestEmailKind;
  readonly leadId: string;
  readonly request: DemoRequestDetails;
}

/**
 * Queues the emails about a demo request (`DEMO_REQUEST_EMAILS`; tests pass a recording fake).
 * Spec 06's `demo-request-received` job is realised as one `send-email` job per email (OQ-T4).
 */
export interface DemoRequestEmails {
  queue(email: DemoRequestEmail): Promise<void>;
}

/**
 * The emails a stored request sends (D57): the sales email every time, so sales sees each
 * repeat, and the requester's confirmation only for a new lead, so a repeat within 24 hours does
 * not send a second one.
 */
export function demoRequestEmailsFor(
  leadId: string,
  created: boolean,
): readonly Pick<DemoRequestEmail, 'jobId' | 'kind'>[] {
  const kinds: readonly DemoRequestEmailKind[] = created ? ['sales', 'confirm'] : ['sales'];
  return kinds.map((kind) => ({ jobId: `demo-request.${leadId}.${kind}`, kind }));
}

/**
 * Until Task 5 adds the two templates and `SALES_INBOX`: logs that an email is owed (the lead
 * id only) instead of sending it. The lead itself is stored. Task 5 replaces this provider with
 * one that queues `send-email` jobs through `DELIVERY`.
 */
export class UnsentDemoRequestEmails implements DemoRequestEmails {
  constructor(private readonly logger: Logger) {}

  queue(email: DemoRequestEmail): Promise<void> {
    this.logger.warn(
      { metric: 'demo_request_email_unsent', jobId: email.jobId },
      'Demo request email not sent: its template arrives with Task 5',
    );
    return Promise.resolve();
  }
}
