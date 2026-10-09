import { createHmac, hkdfSync } from 'node:crypto';

import { SignInEmail } from '@quad/contracts';
import { Queue } from 'bullmq';
import { z } from 'zod';

import { DELIVERY_JOB_OPTIONS } from '../../common/delivery/queues';

import type { BeforeApplicationShutdown } from '@nestjs/common';
import type { Redis } from 'ioredis';

/**
 * Forgot password (spec 05 step 6) answers before anything is looked up: the API queues one
 * job per request on this queue, and the worker finds the account and sends the link (D32), so
 * a known and an unknown email cost the request the same.
 */
export const PASSWORD_RESET_REQUEST_QUEUE = 'password-reset-request';

/** The job: the address as typed (normalised), nothing about whether it has an account. */
export const PasswordResetRequestJob = z.object({ email: SignInEmail }).strict();
export type PasswordResetRequestJob = z.infer<typeof PasswordResetRequestJob>;

export interface PasswordResetRequest {
  /** `password-reset-request.<HMAC of the email>`: logs never see the address. */
  readonly jobId: string;
  readonly email: string;
}

/** Queues Forgot password requests (`PASSWORD_RESETS`; tests pass a recording fake). */
export interface PasswordResetRequests {
  request(job: PasswordResetRequest): Promise<void>;
}

/** HKDF `info` for the job-id key, so it never equals another key made from SESSION_SECRET. */
const JOB_ID_KEY_INFO = 'quad password-reset request';

/**
 * The job id for an email: HMAC-SHA256 under a key derived from `SESSION_SECRET`. One address
 * has one job id, so a second request while one is waiting adds nothing.
 */
export function passwordResetJobIds(sessionSecret: string): (email: string) => string {
  const key = Buffer.from(hkdfSync('sha256', sessionSecret, '', JOB_ID_KEY_INFO, 32));
  return (email) =>
    `password-reset-request.${createHmac('sha256', key).update(email, 'utf8').digest('base64url')}`;
}

/**
 * Like the delivery jobs (five tries over about 15 minutes, gone once done), except that a job
 * that fails for good is removed at once too: the job id is fixed per address, so a failed job
 * kept for a day would make BullMQ ignore that address's next requests, and it holds the email.
 */
export const PASSWORD_RESET_REQUEST_JOB_OPTIONS = {
  ...DELIVERY_JOB_OPTIONS,
  removeOnFail: true,
} as const;

/** `PasswordResetRequests` on BullMQ, sharing the API's Redis connection. */
export class BullPasswordResetRequests implements PasswordResetRequests, BeforeApplicationShutdown {
  private queue: Queue | undefined;

  constructor(
    private readonly redis: Redis,
    private readonly onError: (error: Error) => void,
    /** BullMQ key prefix; tests use their own so a local worker never sees their jobs. */
    private readonly prefix?: string,
  ) {}

  async request(job: PasswordResetRequest): Promise<void> {
    this.queue ??= this.createQueue();
    await this.queue.add(
      PASSWORD_RESET_REQUEST_QUEUE,
      PasswordResetRequestJob.parse({ email: job.email }),
      { ...PASSWORD_RESET_REQUEST_JOB_OPTIONS, jobId: job.jobId },
    );
  }

  async beforeApplicationShutdown(): Promise<void> {
    const queue = this.queue;
    this.queue = undefined;
    await queue?.close();
  }

  private createQueue(): Queue {
    const queue = new Queue(PASSWORD_RESET_REQUEST_QUEUE, {
      connection: this.redis,
      ...(this.prefix === undefined ? {} : { prefix: this.prefix }),
    });
    queue.on('error', this.onError);
    return queue;
  }
}
