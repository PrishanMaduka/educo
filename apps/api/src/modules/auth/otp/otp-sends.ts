import { IdSchema, SignInEmail } from '@quad/contracts';
import { Queue } from 'bullmq';
import { z } from 'zod';

import { DELIVERY_JOB_OPTIONS } from '../../../common/delivery/queues';

import type { BeforeApplicationShutdown } from '@nestjs/common';
import type { Redis } from 'ioredis';

/**
 * Parent sign-in codes go only to known guardian and relative numbers (D39, owner 2026-10-09),
 * but `POST /auth/otp/request` answers before anything is looked up: it queues one job per
 * request on this queue, and the worker finds the account and sends the code or drops the job
 * (`otp-send-request.processor.ts`), so a known and an unknown number cost the request the same.
 */
export const OTP_SEND_REQUEST_QUEUE = 'otp-send-request';

/** The job: the challenge, its subject (an E.164 phone or an email) and the code to send. */
export const OtpSendRequestJob = z
  .object({
    challengeId: IdSchema,
    phone: z
      .string()
      .regex(/^\+\d{8,15}$/)
      .optional(),
    email: SignInEmail.optional(),
    code: z.string().regex(/^\d{6}$/),
    minutes: z.number().int().positive(),
  })
  .strict()
  .refine((job) => (job.phone === undefined) !== (job.email === undefined), {
    message: 'exactly one of phone and email',
  });
export type OtpSendRequestJob = z.infer<typeof OtpSendRequestJob>;

export interface OtpSendRequest {
  /** `otp-send.<challenge id>`: one job per challenge, and logs never see the subject. */
  readonly jobId: string;
  readonly job: OtpSendRequestJob;
}

/** Queues sign-in code requests (`OTP_SENDS`; tests pass a recording fake). */
export interface OtpSendRequests {
  request(request: OtpSendRequest): Promise<void>;
}

/**
 * Like the delivery jobs (five tries, gone once done), except that a job that fails for good is
 * removed at once too: it holds the code and the phone number or email (Task 9 review M9).
 */
export const OTP_SEND_REQUEST_JOB_OPTIONS = {
  ...DELIVERY_JOB_OPTIONS,
  removeOnFail: true,
} as const;

/** `OtpSendRequests` on BullMQ, sharing the API's Redis connection. */
export class BullOtpSendRequests implements OtpSendRequests, BeforeApplicationShutdown {
  private queue: Queue | undefined;

  constructor(
    private readonly redis: Redis,
    private readonly onError: (error: Error) => void,
  ) {}

  async request(request: OtpSendRequest): Promise<void> {
    this.queue ??= this.createQueue();
    await this.queue.add(OTP_SEND_REQUEST_QUEUE, OtpSendRequestJob.parse(request.job), {
      ...OTP_SEND_REQUEST_JOB_OPTIONS,
      jobId: request.jobId,
    });
  }

  async beforeApplicationShutdown(): Promise<void> {
    const queue = this.queue;
    this.queue = undefined;
    await queue?.close();
  }

  private createQueue(): Queue {
    const queue = new Queue(OTP_SEND_REQUEST_QUEUE, { connection: this.redis });
    queue.on('error', this.onError);
    return queue;
  }
}
