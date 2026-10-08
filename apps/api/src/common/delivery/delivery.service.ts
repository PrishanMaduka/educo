import { Queue } from 'bullmq';

import { currentRequestContext } from '../request-context';

import { EmailJobSchema } from './email';
import { DELIVERY_JOB_OPTIONS, EMAIL_QUEUE, JobIdSchema, SMS_QUEUE } from './queues';
import { SmsJobSchema } from './sms';
import { EMAIL_TEMPLATES, SMS_TEMPLATES } from './templates';

import type { EmailJob, SchoolSender } from './email';
import type { SmsJob } from './sms';
import type { EmailParams, EmailTemplateId, SmsParams, SmsTemplateId } from './templates';
import type { BeforeApplicationShutdown } from '@nestjs/common';
import type { Redis } from 'ioredis';

export interface QueueEmailInput<T extends EmailTemplateId> {
  /** Makes queuing idempotent: one job, and one send, per id (`JobIdSchema`). */
  readonly jobId: string;
  readonly to: string;
  readonly template: T;
  readonly params: EmailParams<T>;
  /** The sending school, required for school mail and refused for account mail (D19). */
  readonly school?: SchoolSender;
}

export interface QueueSmsInput<T extends SmsTemplateId> {
  readonly jobId: string;
  /** E.164. */
  readonly to: string;
  readonly template: T;
  readonly params: SmsParams<T>;
}

/**
 * Queues email and SMS for the worker (every send is a job, spec 12). Inject with
 * `@Inject(DELIVERY)`. The job's tenant is the current request's school, never a parameter.
 */
export interface DeliveryQueue {
  queueEmail<T extends EmailTemplateId>(input: QueueEmailInput<T>): Promise<void>;
  queueSms<T extends SmsTemplateId>(input: QueueSmsInput<T>): Promise<void>;
}

export interface PreparedJob<T> {
  readonly jobId: string;
  readonly job: T;
}

/**
 * Checks an email before it is queued: the job id, the template's parameters, and the sender
 * rule (school mail needs the school and a school context; account mail names no school).
 */
export function prepareEmailJob<T extends EmailTemplateId>(
  input: QueueEmailInput<T>,
  tenantId: string | null,
): PreparedJob<EmailJob> {
  const template = EMAIL_TEMPLATES[input.template];
  if (template.sender === 'school' && (input.school === undefined || tenantId === null)) {
    throw new Error('A school email needs the sending school and must be queued in a school.');
  }
  if (template.sender === 'account' && input.school !== undefined) {
    throw new Error('An account email is sent by Quad, so it names no school.');
  }
  const job = EmailJobSchema.parse({
    to: input.to,
    tenantId,
    school: input.school ?? null,
    template: input.template,
    params: template.params.parse(input.params),
  });
  return { jobId: JobIdSchema.parse(input.jobId), job };
}

/** Checks an SMS before it is queued: the job id, the number and the template's parameters. */
export function prepareSmsJob<T extends SmsTemplateId>(
  input: QueueSmsInput<T>,
  tenantId: string | null,
): PreparedJob<SmsJob> {
  const job = SmsJobSchema.parse({
    to: input.to,
    tenantId,
    template: input.template,
    params: SMS_TEMPLATES[input.template].params.parse(input.params),
  });
  return { jobId: JobIdSchema.parse(input.jobId), job };
}

export interface BullDeliveryOptions {
  /** BullMQ key prefix; tests use their own so a local worker never sees their jobs. */
  readonly prefix?: string;
  /** Queue errors (Redis trouble). Without a listener BullMQ's error event would throw. */
  readonly onError?: (error: Error) => void;
}

/**
 * `DeliveryQueue` on BullMQ, sharing the API's Redis connection. Queues are created on first
 * use, so the API starts without Redis.
 */
export class BullDelivery implements DeliveryQueue, BeforeApplicationShutdown {
  private readonly queues = new Map<string, Queue>();

  constructor(
    private readonly redis: Redis,
    private readonly options: BullDeliveryOptions = {},
  ) {}

  async queueEmail<T extends EmailTemplateId>(input: QueueEmailInput<T>): Promise<void> {
    const { jobId, job } = prepareEmailJob(input, currentRequestContext()?.tenantId ?? null);
    await this.queue(EMAIL_QUEUE).add(job.template, job, { ...DELIVERY_JOB_OPTIONS, jobId });
  }

  async queueSms<T extends SmsTemplateId>(input: QueueSmsInput<T>): Promise<void> {
    const { jobId, job } = prepareSmsJob(input, currentRequestContext()?.tenantId ?? null);
    await this.queue(SMS_QUEUE).add(job.template, job, { ...DELIVERY_JOB_OPTIONS, jobId });
  }

  /** Closes the queues; the shared connection is closed by `RedisModule` afterwards. */
  async close(): Promise<void> {
    const queues = [...this.queues.values()];
    this.queues.clear();
    await Promise.all(queues.map((queue) => queue.close()));
  }

  async beforeApplicationShutdown(): Promise<void> {
    await this.close();
  }

  private queue(name: string): Queue {
    let queue = this.queues.get(name);
    if (queue === undefined) {
      queue = new Queue(name, {
        connection: this.redis,
        ...(this.options.prefix === undefined ? {} : { prefix: this.options.prefix }),
      });
      const onError = this.options.onError ?? (() => undefined);
      queue.on('error', onError);
      this.queues.set(name, queue);
    }
    return queue;
  }
}
