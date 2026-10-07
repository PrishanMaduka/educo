import type { EmailSuppressionReason, SesEvent } from '@quad/contracts';

export interface EmailSuppressionInput {
  readonly address: string;
  readonly reason: EmailSuppressionReason;
}

/**
 * Which addresses an SES event suppresses (spec 20, Email). A permanent bounce suppresses each
 * bounced recipient (`bounce`); a complaint suppresses each complaining recipient
 * (`complaint`). Transient and undetermined bounces, deliveries and every other event suppress
 * nobody: SES retries those itself. Addresses are compared case-insensitively (the column is
 * citext), and the first spelling wins.
 */
export function suppressionsFromSesEvent(event: SesEvent): EmailSuppressionInput[] {
  const type = event.eventType ?? event.notificationType;
  let found: EmailSuppressionInput[] = [];
  if (type === 'Bounce' && event.bounce?.bounceType === 'Permanent') {
    found = event.bounce.bouncedRecipients.map((r) => ({
      address: r.emailAddress,
      reason: 'bounce',
    }));
  } else if (type === 'Complaint' && event.complaint) {
    found = event.complaint.complainedRecipients.map((r) => ({
      address: r.emailAddress,
      reason: 'complaint',
    }));
  }
  const seen = new Set<string>();
  return found.filter(({ address }) => {
    const key = address.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
