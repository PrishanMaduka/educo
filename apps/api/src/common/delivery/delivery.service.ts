import { Queue } from 'bullmq';

import { currentRequestContext } from '../request-context';

import { CheckedFlowProducer } from './checked-flow-producer';
import { EmailJobSchema } from './email';
import { DELIVERY_JOB_OPTIONS, EMAIL_QUEUE, JobIdSchema, SMS_QUEUE } from './queues';
import { SmsJobSchema } from './sms';
import { EMAIL_TEMPLATES, SMS_TEMPLATES } from './templates';

import type { EmailJob, SchoolSender } from './email';
import type { SmsJob } from './sms';
import type { EmailParams, EmailTemplateId, SmsParams, SmsTemplateId } from './templates';
import type { BeforeApplicationShutdown } from '@nestjs/common';
import type { JobsOptions } from 'bullmq';
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

/** A `QueueEmailInput` for any one template (a list may mix templates). */
export type AnyQueueEmailInput = { [T in EmailTemplateId]: QueueEmailInput<T> }[EmailTemplateId];

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
  /**
   * Queues several emails together. Each is checked first, so a bad one queues none; then all
   * go to Redis in one transaction, so a connection lost before it runs queues none either. If
   * Redis refuses one job while the transaction runs, the others stay queued and this throws,
   * so the caller never resolves with an email missing. An id already queued keeps its job, as
   * with `queueEmail`.
   */
  queueEmails(inputs: readonly AnyQueueEmailInput[]): Promise<void>;
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

/**
 * Sign-in codes (the SMS `otp` and the email `email_otp`, Task 9 fix round 1): a job that fails
 * for good is removed at once, so no code or phone number waits in Redis for a day. A code is
 * useless after 10 minutes anyway, and the person simply asks for a new one.
 */
const DISCARDED_ON_FAILURE: ReadonlySet<string> = new Set(['otp', 'email_otp']);

function optionsFor(template: string): JobsOptions {
  return DISCARDED_ON_FAILURE.has(template)
    ? { ...DELIVERY_JOB_OPTIONS, removeOnFail: true }
    : DELIVERY_JOB_OPTIONS;
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
  private flows: CheckedFlowProducer | undefined;

  constructor(
    private readonly redis: Redis,
    private readonly options: BullDeliveryOptions = {},
  ) {}

  async queueEmail<T extends EmailTemplateId>(input: QueueEmailInput<T>): Promise<void> {
    const { jobId, job } = prepareEmailJob(input, currentRequestContext()?.tenantId ?? null);
    await this.queue(EMAIL_QUEUE).add(job.template, job, { ...optionsFor(job.template), jobId });
  }

  async queueEmails(inputs: readonly AnyQueueEmailInput[]): Promise<void> {
    const tenantId = currentRequestContext()?.tenantId ?? null;
    const prepared = inputs.map((input) => prepareEmailJob(input, tenantId));
    if (prepared.length === 0) return;
    // One MULTI (`CheckedFlowProducer`); `Queue.addBulk` sends a plain pipeline in this BullMQ
    // version, which a dropped connection can cut halfway.
    await this.flowProducer().addAll(
      prepared.map(({ jobId, job }) => ({
        name: job.template,
        queueName: EMAIL_QUEUE,
        data: job,
        opts: { ...optionsFor(job.template), jobId },
      })),
    );
  }

  async queueSms<T extends SmsTemplateId>(input: QueueSmsInput<T>): Promise<void> {
    const { jobId, job } = prepareSmsJob(input, currentRequestContext()?.tenantId ?? null);
    await this.queue(SMS_QUEUE).add(job.template, job, { ...optionsFor(job.template), jobId });
  }

  /** Closes the queues; the shared connection is closed by `RedisModule` afterwards. */
  async close(): Promise<void> {
    const queues = [...this.queues.values()];
    this.queues.clear();
    const flows = this.flows;
    this.flows = undefined;
    await Promise.all([...queues.map((queue) => queue.close()), flows?.close()]);
  }

  async beforeApplicationShutdown(): Promise<void> {
    await this.close();
  }

  private flowProducer(): CheckedFlowProducer {
    if (this.flows === undefined) {
      this.flows = new CheckedFlowProducer({
        connection: this.redis,
        ...(this.options.prefix === undefined ? {} : { prefix: this.options.prefix }),
      });
      this.flows.on('error', this.options.onError ?? (() => undefined));
    }
    return this.flows;
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
