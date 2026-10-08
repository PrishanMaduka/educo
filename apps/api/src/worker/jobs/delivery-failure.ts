/**
 * A provider failure with only its codes. SMTP and SES errors can quote the recipient's address
 * in their message, and the worker logs and reports failed jobs, so the message is dropped
 * (spec 16: no personal data in logs).
 */
export class DeliveryFailedError extends Error {
  constructor(channel: 'email' | 'sms', cause: unknown) {
    super(`The ${channel} provider failed (${describe(cause)}).`);
    this.name = 'DeliveryFailedError';
  }
}

function describe(cause: unknown): string {
  if (!(cause instanceof Error)) return 'unknown';
  const parts = [cause.name];
  if ('code' in cause && (typeof cause.code === 'string' || typeof cause.code === 'number')) {
    parts.push(String(cause.code));
  }
  if ('responseCode' in cause && typeof cause.responseCode === 'number') {
    parts.push(String(cause.responseCode));
  }
  return parts.join(' ');
}
