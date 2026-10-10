import { randomBytes } from 'node:crypto';

import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { CheckedFlowProducer } from '../../src/common/delivery/checked-flow-producer';
import { BullDelivery } from '../../src/common/delivery/delivery.service';
import { EMAIL_QUEUE, SMS_QUEUE } from '../../src/common/delivery/queues';
import { currentRequestContext, runWithRequestContext } from '../../src/common/request-context';
import { redisOnce } from '../../src/worker/jobs/once';
import { createSendEmailProcessor } from '../../src/worker/jobs/send-email.processor';
import { FakeEmailTransport } from '../fakes/email';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const TENANT = '0193e6a1-0000-7000-8000-000000000001';
const SCHOOL = { name: 'Colombo International School', replyTo: 'office@colombo-intl.local' };
const INVITE = {
  name: 'Nadeesha',
  inviter: 'Prishan Maduka',
  link: 'http://localhost:3000/sign-in/invite/abc.def',
  days: 7,
};

/** Runs `fn` as a request of school `tenantId` would (Task 6's guard fills this in). */
function inSchool<T>(tenantId: string | null, fn: () => Promise<T>): Promise<T> {
  return runWithRequestContext(`test-${randomBytes(4).toString('hex')}`, () => {
    const context = currentRequestContext();
    if (context) context.tenantId = tenantId;
    return fn();
  });
}

describe('queued email and SMS on the compose Redis', () => {
  const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  // A prefix of its own, so these jobs never reach a local worker and runs never collide.
  const prefix = `test-delivery-${randomBytes(4).toString('hex')}`;
  const delivery = new BullDelivery(redis, { prefix });
  const emails = new Queue(EMAIL_QUEUE, { connection: redis, prefix });
  const texts = new Queue(SMS_QUEUE, { connection: redis, prefix });

  afterAll(async () => {
    await delivery.close();
    await emails.obliterate({ force: true });
    await texts.obliterate({ force: true });
    await emails.close();
    await texts.close();
    const markers = await redis.keys('quad:delivery:done:*test-delivery*');
    if (markers.length > 0) await redis.del(...markers);
    await redis.quit();
  });

  it('adds one job per id: queuing the same id twice keeps one job', async () => {
    const jobId = `staff-invite.${randomBytes(6).toString('hex')}`;
    await inSchool(TENANT, async () => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        await delivery.queueEmail({
          jobId,
          to: 'nadeesha.jayasinghe@colombo-intl.local',
          template: 'staff_invite',
          params: INVITE,
          school: SCHOOL,
        });
      }
    });
    const jobs = (await emails.getJobs(['waiting'])).filter((job) => job.id === jobId);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.data).toMatchObject({ template: 'staff_invite', school: SCHOOL });
  });

  it('takes the tenant from the request context, never from the caller', async () => {
    const jobId = `two-step.${randomBytes(6).toString('hex')}`;
    await inSchool(TENANT, () =>
      delivery.queueEmail({
        jobId,
        to: 'nadeesha.jayasinghe@colombo-intl.local',
        template: 'two_step_reminder',
        params: { link: 'http://localhost:3000/app/me/security' },
        school: SCHOOL,
      }),
    );
    const job = await emails.getJob(jobId);
    expect(job?.data).toMatchObject({ tenantId: TENANT });
  });

  it('refuses a school email outside a school, and an account email that names a school', async () => {
    await expect(
      inSchool(null, () =>
        delivery.queueEmail({
          jobId: `staff-invite.${randomBytes(6).toString('hex')}`,
          to: 'nadeesha.jayasinghe@colombo-intl.local',
          template: 'staff_invite',
          params: INVITE,
          school: SCHOOL,
        }),
      ),
    ).rejects.toThrow(/school/);
    await expect(
      inSchool(null, () =>
        delivery.queueEmail({
          jobId: `otp.${randomBytes(6).toString('hex')}`,
          to: 'nadeesha.jayasinghe@colombo-intl.local',
          template: 'email_otp',
          params: { code: '482913', minutes: 10 },
          school: SCHOOL,
        }),
      ),
    ).rejects.toThrow(/school/);
  });

  it.each(['12345', 'has:colon', 'has space', ''])('refuses the job id %j', async (jobId) => {
    await expect(
      inSchool(null, () =>
        delivery.queueEmail({
          jobId,
          to: 'nadeesha.jayasinghe@colombo-intl.local',
          template: 'email_otp',
          params: { code: '482913', minutes: 10 },
        }),
      ),
    ).rejects.toThrow();
  });

  describe('queueEmails: several emails in one Redis transaction', () => {
    const LEAD = `0193e6a1-0000-7000-8000-${randomBytes(6).toString('hex')}`;
    const sales = (suffix: string) => ({
      jobId: `demo-request.${LEAD}.sales.${suffix}`,
      to: 'sales@quad.local',
      template: 'demo_request_sales' as const,
      params: {
        kind: 'parent' as const,
        name: 'Sample Parent',
        email: 'sample.parent@example.test',
        school: 'Sample School',
        link: `http://localhost:3001/leads/${LEAD}`,
      },
    });
    const confirm = {
      jobId: `demo-request.${LEAD}.confirm`,
      to: 'sample.parent@example.test',
      template: 'demo_request_confirmation' as const,
      params: { kind: 'parent' as const },
    };

    it('adds every email, each with the delivery options', async () => {
      await inSchool(null, () => delivery.queueEmails([sales('a'), confirm]));

      const added = await Promise.all([
        emails.getJob(sales('a').jobId),
        emails.getJob(confirm.jobId),
      ]);
      expect(added.map((job): unknown => job?.data)).toEqual([
        {
          to: 'sales@quad.local',
          tenantId: null,
          school: null,
          template: 'demo_request_sales',
          params: sales('a').params,
        },
        {
          to: 'sample.parent@example.test',
          tenantId: null,
          school: null,
          template: 'demo_request_confirmation',
          params: { kind: 'parent' },
        },
      ]);
      for (const job of added) {
        expect(job?.opts).toMatchObject({ attempts: 5, removeOnComplete: true });
      }
    });

    it('adds none when one of them is not valid', async () => {
      const bad = { ...confirm, jobId: `demo-request.${LEAD}.bad`, to: 'not an address' };
      await expect(inSchool(null, () => delivery.queueEmails([sales('b'), bad]))).rejects.toThrow();
      expect(await emails.getJob(sales('b').jobId)).toBeUndefined();
      expect(await emails.getJob(bad.jobId)).toBeUndefined();
    });

    it('keeps one job per id: an id queued before is not added twice, the new one is', async () => {
      await inSchool(null, () => delivery.queueEmails([sales('c'), confirm]));
      const confirms = (await emails.getJobs(['waiting'])).filter(
        (job) => job.id === confirm.jobId,
      );
      expect(confirms).toHaveLength(1);
      expect(await emails.getJob(sales('c').jobId)).toBeDefined();
    });
  });

  describe('CheckedFlowProducer: one MULTI, and every job checked', () => {
    // MULTI does not roll back a Lua error in one command, and FlowProducer.addBulk drops the
    // per-command results, so a refused job would otherwise go unnoticed.
    const flows = new CheckedFlowProducer({ connection: redis, prefix });
    const job = (id: string) => ({
      name: 'demo_request_confirmation',
      queueName: EMAIL_QUEUE,
      data: { id },
      opts: { jobId: id },
    });

    afterAll(async () => {
      await flows.close();
    });

    it('adds every job and returns', async () => {
      const ids = [
        `flow.${randomBytes(6).toString('hex')}`,
        `flow.${randomBytes(6).toString('hex')}`,
      ];
      await flows.addAll(ids.map(job));
      for (const id of ids) expect(await emails.getJob(id)).toBeDefined();
    });

    it.each([
      [
        'an error',
        [
          [null, 'a'],
          [new Error('ERR in script'), null],
        ],
      ],
      [
        'a refusal code',
        [
          [null, 'a'],
          [null, -1],
        ],
      ],
      ['a missing result', [[null, 'a']]],
      ['no results (aborted)', null],
    ])('throws when Redis answers one job with %s', async (_case, results) => {
      vi.spyOn(flows.getBackend(), 'addFlow').mockResolvedValueOnce(
        results as unknown as [Error | null, string | number][],
      );
      await expect(flows.addAll([job('flow.a'), job('flow.b')])).rejects.toThrow(/not added/);
    });
  });

  it('queues an SMS job for the OTP', async () => {
    const jobId = `otp.${randomBytes(6).toString('hex')}`;
    await inSchool(null, () =>
      delivery.queueSms({
        jobId,
        to: '+94770000001',
        template: 'otp',
        params: { code: '482913', minutes: 10 },
      }),
    );
    const job = await texts.getJob(jobId);
    expect(job?.data).toMatchObject({ to: '+94770000001', template: 'otp', tenantId: null });
  });

  it('removes a failed sign-in code job at once: no code or number stays in Redis', async () => {
    const smsId = `otp.${randomBytes(6).toString('hex')}`;
    const emailId = `otp.${randomBytes(6).toString('hex')}`;
    await inSchool(null, async () => {
      await delivery.queueSms({
        jobId: smsId,
        to: '+94770000001',
        template: 'otp',
        params: { code: '482913', minutes: 10 },
      });
      await delivery.queueEmail({
        jobId: emailId,
        to: 'dilhani@example.test',
        template: 'email_otp',
        params: { code: '482913', minutes: 10 },
      });
    });
    expect((await texts.getJob(smsId))?.opts.removeOnFail).toBe(true);
    expect((await emails.getJob(emailId))?.opts.removeOnFail).toBe(true);
  });

  it('keeps a failed job (whose params hold a link or code) for a day at most', async () => {
    const jobId = `password-reset.keep-${randomBytes(6).toString('hex')}`;
    await inSchool(null, () =>
      delivery.queueEmail({
        jobId,
        to: 'prishan.maduka@colombo-intl.local',
        template: 'password_reset',
        params: { link: 'http://localhost:3000/sign-in/reset/abc.def', minutes: 30 },
      }),
    );
    const job = await emails.getJob(jobId);
    expect(job?.opts.removeOnComplete).toBe(true);
    expect(job?.opts.removeOnFail).toEqual({ age: 24 * 60 * 60 });
  });

  it('sends a queued job once, even when the worker runs it twice (Redis marker)', async () => {
    const jobId = `password-reset.${prefix}`;
    await inSchool(null, () =>
      delivery.queueEmail({
        jobId,
        to: 'prishan.maduka@colombo-intl.local',
        template: 'password_reset',
        params: { link: 'http://localhost:3000/sign-in/reset/abc.def', minutes: 30 },
      }),
    );
    const job = await emails.getJob(jobId);
    expect(job).toBeDefined();
    const transport = new FakeEmailTransport();
    const process = createSendEmailProcessor({
      transport,
      once: redisOnce(redis),
      settings: {
        fromDomain: 'mail.quad-edu.com',
        publicWebUrl: 'http://localhost:3000',
        consoleUrl: 'http://localhost:3001',
        supportInbox: null,
      },
    });
    if (job === undefined) return;
    await process(job);
    await process(job);
    expect(transport.sent).toHaveLength(1);
  });
});
