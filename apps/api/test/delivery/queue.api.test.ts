import { randomBytes } from 'node:crypto';

import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { afterAll, describe, expect, it } from 'vitest';

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
        supportInbox: null,
      },
    });
    if (job === undefined) return;
    await process(job);
    await process(job);
    expect(transport.sent).toHaveLength(1);
  });
});
