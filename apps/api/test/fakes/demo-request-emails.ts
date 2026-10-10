import { currentRequestContext } from '../../src/common/request-context';

import type {
  DemoRequestEmail,
  DemoRequestEmails,
} from '../../src/public/demo-requests/demo-request-emails';

/** One queued demo request email, with the school the request context held (always none). */
export interface QueuedDemoRequestEmail extends DemoRequestEmail {
  readonly tenantId: string | null;
}

/**
 * Records the demo request emails the route queues instead of queuing them
 * (`AppOverrides.demoRequestEmails`), with the request's school, so a test can show that no
 * school ever reaches them.
 */
export class RecordingDemoRequestEmails implements DemoRequestEmails {
  readonly queued: QueuedDemoRequestEmail[] = [];

  queue(email: DemoRequestEmail): Promise<void> {
    this.queued.push({ ...email, tenantId: currentRequestContext()?.tenantId ?? null });
    return Promise.resolve();
  }

  /** The job ids queued for one lead, in order. */
  jobIdsFor(leadId: string): string[] {
    return this.queued.filter((email) => email.leadId === leadId).map((email) => email.jobId);
  }
}
