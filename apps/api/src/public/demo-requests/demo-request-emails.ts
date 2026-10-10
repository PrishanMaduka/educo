import { SendableAddress } from '../../common/delivery/templates/params';

import type { AnyQueueEmailInput } from '../../common/delivery/delivery.service';
import type { DemoRequestBody } from '@quad/contracts';

type AntiSpamField = 'turnstileToken' | 'website';

/** The request as the visitor sent it, without the anti-spam fields (one shape per `kind`). */
export type DemoRequestDetails =
  | Omit<Extract<DemoRequestBody, { kind: 'school' }>, AntiSpamField>
  | Omit<Extract<DemoRequestBody, { kind: 'parent' }>, AntiSpamField>;

/** The lead a request stored: new, or the one from the last 24 hours it updated. */
export interface StoredLead {
  readonly leadId: string;
  readonly created: boolean;
}

/** Where the emails go and link to. */
export interface DemoRequestEmailSettings {
  /** `SALES_INBOX` (`support@quad-edu.com` outside local, OQ2). */
  readonly salesInbox: string;
  /** `CONSOLE_URL`, for the lead's link (its Leads view arrives in M2, OQ-T5). */
  readonly consoleUrl: string;
}

/** Whether the email queue can take `address`: the form's check is looser (`josé@…` passes it). */
const isSendable = (address: string): boolean => SendableAddress.safeParse(address).success;

/**
 * The emails a stored request sends (D57; spec 06's `demo-request-received` is these
 * `send-email` jobs, OQ-T4). Job ids hold only ids, never personal data.
 * - The sales email to `SALES_INBOX`, every time, so sales sees each repeat. Its id ends with
 *   `requestId`, unique per request: BullMQ keeps one job per id, so a repeat that reused the
 *   first one's id would be dropped while that one is pending, retrying or kept as failed.
 * - The confirmation to the requester, for a new lead only, with the lead's own id, so it is sent
 *   at most once per lead. Its only parameter is the kind: nothing typed reaches it. An address
 *   the queue cannot take (the form allows a few more) gets none; sales still hears.
 * - Nothing to the school, for a parent's request too (OQ1): no address comes from the school name.
 */
export function demoRequestEmailJobs(
  lead: StoredLead,
  request: DemoRequestDetails,
  settings: DemoRequestEmailSettings,
  requestId: string,
): AnyQueueEmailInput[] {
  const sales: AnyQueueEmailInput = {
    jobId: `demo-request.${lead.leadId}.sales.${requestId}`,
    to: settings.salesInbox,
    template: 'demo_request_sales',
    params: { ...request, link: new URL(`/leads/${lead.leadId}`, settings.consoleUrl).href },
  };
  if (!lead.created || !isSendable(request.email)) return [sales];
  return [
    sales,
    {
      jobId: `demo-request.${lead.leadId}.confirm`,
      to: request.email,
      template: 'demo_request_confirmation',
      params: { kind: request.kind },
    },
  ];
}
