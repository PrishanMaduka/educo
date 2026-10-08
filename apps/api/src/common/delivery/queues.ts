import { z } from 'zod';

import type { JobsOptions } from 'bullmq';

/** The delivery queues (spec 12 → Delivery providers). */
export const EMAIL_QUEUE = 'send-email';
export const SMS_QUEUE = 'send-sms';

/**
 * A caller-chosen job id that makes queuing idempotent (`password-reset.<nonce>`): BullMQ keeps
 * one job per id, and the worker sends each id once. No colons (BullMQ), not all digits (BullMQ
 * refuses integer ids), and no personal data: ids appear in logs.
 */
export const JobIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9._-]{1,200}$/, {
    message: 'must be 1-200 letters, digits, dots, dashes or underscores',
  })
  .refine((id) => !/^\d+$/.test(id), { message: 'must not be all digits' });

/**
 * How long a failed job stays in Redis to inspect. Its parameters can hold a secret (a signed
 * link or a one-time code), so it is kept a day at most, not for the link's whole life.
 */
export const FAILED_JOB_KEEP_SECONDS = 24 * 60 * 60;

/**
 * Five tries over about 15 minutes. A sent job is removed at once, so its address and content
 * leave Redis; a failed one is removed after `FAILED_JOB_KEEP_SECONDS`.
 */
export const DELIVERY_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 30_000 },
  removeOnComplete: true,
  removeOnFail: { age: FAILED_JOB_KEEP_SECONDS },
};
