import { describe, expect, it } from 'vitest';

import { currentRequestContext } from '../../src/common/request-context';
import { createSendEmailProcessor } from '../../src/worker/jobs/send-email.processor';
import { createSendSmsProcessor } from '../../src/worker/jobs/send-sms.processor';
import { FakeEmailTransport } from '../fakes/email';
import { MemoryOnce } from '../fakes/once';
import { FakeSmsSender } from '../fakes/sms';

const TENANT = '0193e6a1-0000-7000-8000-000000000001';
const SETTINGS = {
  fromDomain: 'mail.quad-edu.com',
  publicWebUrl: 'http://localhost:3000',
  supportInbox: null,
};

const inviteJob = (id = 'staff-invite.abc') => ({
  id,
  data: {
    to: 'nadeesha.jayasinghe@colombo-intl.local',
    tenantId: TENANT,
    school: { name: 'Colombo International School', replyTo: 'office@colombo-intl.local' },
    template: 'staff_invite',
    params: {
      name: 'Nadeesha',
      inviter: 'Prishan Maduka',
      link: 'http://localhost:3000/sign-in/invite/abc.def',
      days: 7,
    },
  },
});

describe('the send-email processor', () => {
  it('is idempotent on the job id: a second run of the same job sends nothing', async () => {
    const transport = new FakeEmailTransport();
    const process = createSendEmailProcessor({
      transport,
      once: new MemoryOnce(),
      settings: SETTINGS,
    });
    await process(inviteJob());
    await process(inviteJob());
    expect(transport.sent).toHaveLength(1);
    await process(inviteJob('staff-invite.other'));
    expect(transport.sent).toHaveLength(2);
  });

  it('runs inside a request context for the job tenant, so its spans carry tenant_id', async () => {
    const transport = new FakeEmailTransport();
    const process = createSendEmailProcessor({
      transport,
      once: new MemoryOnce(),
      settings: SETTINGS,
    });
    await process(inviteJob());
    expect(transport.sent[0]?.tenantId).toBe(TENANT);
    expect(currentRequestContext()).toBeUndefined();
  });

  it('refuses a payload that does not match, without retries', async () => {
    const process = createSendEmailProcessor({
      transport: new FakeEmailTransport(),
      once: new MemoryOnce(),
      settings: SETTINGS,
    });
    const job = inviteJob();
    await expect(
      process({ id: job.id, data: { ...job.data, template: 'no_such_email' } }),
    ).rejects.toMatchObject({ name: 'UnrecoverableError' });
    await expect(
      process({ id: job.id, data: { ...job.data, tenantId: 'not-a-uuid' } }),
    ).rejects.toMatchObject({ name: 'UnrecoverableError' });
  });

  it('turns a provider failure into an error without the address, and retries the send', async () => {
    const transport = new FakeEmailTransport();
    transport.failNext = Object.assign(
      new Error('550 Recipient nadeesha.jayasinghe@colombo-intl.local rejected'),
      { code: 'EENVELOPE', responseCode: 550 },
    );
    const once = new MemoryOnce();
    const process = createSendEmailProcessor({ transport, once, settings: SETTINGS });

    const failure = await process(inviteJob()).then(
      () => undefined,
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(Error);
    expect(String(failure)).not.toContain('colombo-intl.local');
    expect(String(failure)).toContain('EENVELOPE');

    await process(inviteJob());
    expect(transport.sent).toHaveLength(1);
  });
});

describe('the send-sms processor', () => {
  const otpJob = (id = 'otp.abc') => ({
    id,
    data: {
      to: '+94770000001',
      tenantId: null,
      template: 'otp',
      params: { code: '482913', minutes: 10 },
    },
  });

  it('renders the text, passes the code for the log provider, and is idempotent on the job id', async () => {
    const sender = new FakeSmsSender();
    const process = createSendSmsProcessor({ sender, once: new MemoryOnce() });
    await process(otpJob());
    await process(otpJob());
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]?.message).toMatchObject({ to: '+94770000001', code: '482913' });
    expect(sender.sent[0]?.message.text).toContain('482913');
  });

  it('runs in the job tenant context and refuses a bad number without retries', async () => {
    const sender = new FakeSmsSender();
    const process = createSendSmsProcessor({ sender, once: new MemoryOnce() });
    const job = otpJob();
    await process({ id: job.id, data: { ...job.data, tenantId: TENANT } });
    expect(sender.sent[0]?.tenantId).toBe(TENANT);
    await expect(
      process({ id: 'otp.bad', data: { ...job.data, to: '0770000001' } }),
    ).rejects.toMatchObject({ name: 'UnrecoverableError' });
  });
});
