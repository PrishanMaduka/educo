import { randomBytes } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { buildEmailMessage } from '../../src/common/delivery/email';
import { SmtpEmail } from '../../src/common/delivery/smtp-email';
import { demoRequestEmailJobs } from '../../src/public/demo-requests/demo-request-emails';

import type { EmailSettings } from '../../src/common/delivery/email';

const SMTP_URL = process.env.SMTP_URL ?? 'smtp://localhost:1025';
const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://localhost:8025';

const SETTINGS: EmailSettings = {
  fromDomain: 'mail.quad-edu.com',
  publicWebUrl: 'http://localhost:3000',
  consoleUrl: 'http://localhost:3001',
  supportInbox: 'support@quad-edu.com',
};

const AddressSchema = z.object({ Name: z.string(), Address: z.string() });
const MailpitMessageSchema = z.object({
  From: AddressSchema,
  To: z.array(AddressSchema),
  ReplyTo: z.array(AddressSchema),
  Subject: z.string(),
  Text: z.string(),
  HTML: z.string(),
});
const MailpitSearchSchema = z.object({ messages: z.array(z.object({ ID: z.string() })) });

async function mailpitJson(path: string): Promise<unknown> {
  const response = await fetch(`${MAILPIT_URL}${path}`);
  expect(response.ok).toBe(true);
  return response.json();
}

/** The one message Mailpit holds for `to` (each test uses a fresh address). */
async function deliveredTo(to: string): Promise<z.infer<typeof MailpitMessageSchema>> {
  let id: string | undefined;
  await vi.waitFor(
    async () => {
      const search = MailpitSearchSchema.parse(
        await mailpitJson(`/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`),
      );
      expect(search.messages).toHaveLength(1);
      id = search.messages[0]?.ID;
    },
    { timeout: 5_000, interval: 100 },
  );
  return MailpitMessageSchema.parse(await mailpitJson(`/api/v1/message/${id ?? ''}`));
}

describe('the SMTP adapter against the compose Mailpit', () => {
  const transport = new SmtpEmail(SMTP_URL);

  it('delivers a school email from "{School} via Quad" with the office as Reply-To', async () => {
    const to = `smtp-test-${randomBytes(6).toString('hex')}@colombo-intl.local`;
    const message = buildEmailMessage(
      {
        to,
        tenantId: '0193e6a1-0000-7000-8000-000000000001',
        school: { name: 'Colombo International School', replyTo: 'office@colombo-intl.local' },
        template: 'staff_invite',
        params: {
          name: 'Nadeesha',
          inviter: 'Prishan Maduka',
          link: 'http://localhost:3000/sign-in/invite/abc.def',
          days: 7,
        },
      },
      { ...SETTINGS, supportInbox: null },
    );
    await transport.send(message);

    const delivered = await deliveredTo(to);
    expect(delivered.From).toEqual({
      Name: 'Colombo International School via Quad',
      Address: 'no-reply@mail.quad-edu.com',
    });
    expect(delivered.ReplyTo).toEqual([{ Name: '', Address: 'office@colombo-intl.local' }]);
    expect(delivered.To.map((address) => address.Address)).toEqual([to]);
    expect(delivered.Subject).toBe(message.subject);
    expect(delivered.Text).toContain('http://localhost:3000/sign-in/invite/abc.def');
    expect(delivered.HTML).toContain('href="http://localhost:3000/sign-in/invite/abc.def"');
  });

  it('delivers account email from "Quad" with the support inbox as Reply-To', async () => {
    const to = `smtp-test-${randomBytes(6).toString('hex')}@colombo-intl.local`;
    await transport.send(
      buildEmailMessage(
        {
          to,
          tenantId: null,
          school: null,
          template: 'email_otp',
          params: { code: '482913', minutes: 10 },
        },
        SETTINGS,
      ),
    );
    const delivered = await deliveredTo(to);
    expect(delivered.From).toEqual({ Name: 'Quad', Address: 'no-reply@mail.quad-edu.com' });
    expect(delivered.ReplyTo).toEqual([{ Name: '', Address: 'support@quad-edu.com' }]);
    expect(delivered.Subject).toContain('482913');
  });

  it('delivers a parent request to SALES_INBOX with Reply-To the parent, and the parent a confirmation with no typed text', async () => {
    const id = randomBytes(6).toString('hex');
    const salesInbox = `sales-${id}@quad.local`;
    const requester = `parent-${id}@example.test`;
    const lead = '0193e6a1-0000-7000-8000-00000000abcd';
    const jobs = demoRequestEmailJobs(
      { leadId: lead, created: true },
      {
        kind: 'parent',
        name: `Typed Name ${id}`,
        email: requester,
        school: `Typed School ${id}`,
        city: 'Lisbon',
        note: `Typed note ${id} <b>bold</b>`,
      },
      { salesInbox, consoleUrl: SETTINGS.consoleUrl },
      '0193e6a1-0000-7000-8000-00000000ffff',
    );
    for (const { to, template, params } of jobs) {
      await transport.send(
        buildEmailMessage({ to, tenantId: null, school: null, template, params }, SETTINGS),
      );
    }

    const sales = await deliveredTo(salesInbox);
    expect(sales.From).toEqual({ Name: 'Quad', Address: 'no-reply@mail.quad-edu.com' });
    expect(sales.ReplyTo).toEqual([{ Name: '', Address: requester }]);
    expect(sales.Subject).toBe(`From a parent: Typed School ${id}`);
    expect(sales.Text).toContain(`Name: Typed Name ${id}`);
    expect(sales.Text).toContain(`http://localhost:3001/leads/${lead}`);
    expect(sales.HTML).toContain(`Typed note ${id} &lt;b&gt;bold&lt;/b&gt;`);

    const confirmation = await deliveredTo(requester);
    expect(confirmation.From).toEqual({ Name: 'Quad', Address: 'no-reply@mail.quad-edu.com' });
    expect(confirmation.ReplyTo).toEqual([{ Name: '', Address: 'support@quad-edu.com' }]);
    expect(confirmation.Text).toContain('Our team will get in touch with the school');
    const whole = JSON.stringify(confirmation);
    expect(whole).not.toContain(`Typed Name ${id}`);
    expect(whole).not.toContain(`Typed School ${id}`);
    expect(whole).not.toContain(`Typed note ${id}`);
  });
});
