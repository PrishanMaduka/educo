import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { buildEmailMessage } from '../../src/common/delivery/email';
import { renderEmail } from '../../src/common/delivery/templates';
import { demoRequestEmailJobs } from '../../src/public/demo-requests/demo-request-emails';

import type { EmailSettings } from '../../src/common/delivery/email';
import type { DemoRequestDetails } from '../../src/public/demo-requests/demo-request-emails';

const WEB = 'http://localhost:3000';
const CONSOLE = 'http://localhost:3001';
const OPTIONS = { school: null, publicWebUrl: WEB, consoleUrl: CONSOLE } as const;
const SETTINGS: EmailSettings = {
  fromDomain: 'mail.quad-edu.com',
  publicWebUrl: WEB,
  consoleUrl: CONSOLE,
  supportInbox: 'support@quad-edu.com',
};
const LEAD = '0193e6a1-0000-7000-8000-00000000abcd';
const SALES_INBOX = 'sales@quad.local';
const NONCE = '0193e6a1-0000-7000-8000-00000000ffff';

const school: DemoRequestDetails = {
  kind: 'school',
  name: 'Sample Person',
  email: 'sample.person@example.test',
  school: 'Sample School',
  country: 'Portugal',
  students: '300_1000',
  curriculum: 'ib',
};

const parent: DemoRequestDetails = {
  kind: 'parent',
  name: 'Sample Parent',
  email: 'sample.parent@example.test',
  school: 'Sample School',
  city: 'Lisbon',
  note: 'Our school would love this.\nPlease get in touch.',
};

const settings = { salesInbox: SALES_INBOX, consoleUrl: CONSOLE };

/** The sales email's parameters for a request, as the service queues them. */
function salesParams(request: DemoRequestDetails): Record<string, unknown> {
  const jobs = demoRequestEmailJobs({ leadId: LEAD, created: true }, request, settings, NONCE);
  const sales = jobs.find((job) => job.template === 'demo_request_sales');
  if (sales === undefined) throw new Error('no sales email');
  return sales.params;
}

describe('the demo request emails (M1b Task 5, D57)', () => {
  describe('which emails a stored request queues', () => {
    it('queues a new parent request to exactly SALES_INBOX and the requester, nothing to the school', () => {
      const jobs = demoRequestEmailJobs({ leadId: LEAD, created: true }, parent, settings, NONCE);

      expect(jobs.map((job) => [job.template, job.to])).toEqual([
        ['demo_request_sales', SALES_INBOX],
        ['demo_request_confirmation', 'sample.parent@example.test'],
      ]);
      // No address is ever made from the school name.
      expect(JSON.stringify(jobs.map((job) => job.to))).not.toMatch(/sample.?school/i);
      for (const job of jobs) expect(job.school).toBeUndefined();
    });

    it('gives the sales email a job id of its own per request, and the confirmation one per lead', () => {
      const first = demoRequestEmailJobs({ leadId: LEAD, created: true }, school, settings, NONCE);
      const repeat = demoRequestEmailJobs(
        { leadId: LEAD, created: false },
        school,
        settings,
        '0193e6a1-0000-7000-8000-00000000eeee',
      );

      expect(first.map((job) => job.jobId)).toEqual([
        `demo-request.${LEAD}.sales.${NONCE}`,
        `demo-request.${LEAD}.confirm`,
      ]);
      // A repeat sends only a sales email, whose id differs, so BullMQ cannot drop it as a
      // duplicate of the first one while that is pending, retrying or kept as failed.
      expect(repeat.map((job) => job.jobId)).toEqual([
        `demo-request.${LEAD}.sales.0193e6a1-0000-7000-8000-00000000eeee`,
      ]);
    });

    it('links the sales email to the lead in the console', () => {
      expect(salesParams(school)).toMatchObject({ link: `${CONSOLE}/leads/${LEAD}` });
    });

    it('sends no confirmation to an address the email queue cannot take, but still tells sales', () => {
      const jobs = demoRequestEmailJobs(
        { leadId: LEAD, created: true },
        { ...school, email: 'josé@example.test' },
        settings,
        NONCE,
      );
      expect(jobs.map((job) => job.template)).toEqual(['demo_request_sales']);
    });
  });

  describe('the requester’s confirmation', () => {
    it.each([
      [
        'school',
        'Thanks for asking for a demo of Quad. We’ll email you within one working day to find a time.',
      ],
      [
        'parent',
        'Thanks for telling us about your child’s school. Our team will get in touch with the school; we never contact other families.',
      ],
    ] as const)('renders the fixed %s text with no unfilled ICU argument', (kind, sentence) => {
      const email = renderEmail('demo_request_confirmation', { kind }, OPTIONS);

      expect(email.text).toContain(sentence);
      for (const part of [email.subject, email.text, email.html]) {
        expect(part).not.toMatch(/[{}]/);
      }
      expect(email.text).toContain('support@quad-edu.com');
      expect(email.text).toContain(`${WEB}/legal/privacy`);
      expect(email.html).toContain(`href="${WEB}/legal/privacy"`);
    });

    it('takes nothing the visitor typed: its only parameter is the kind', () => {
      expect(() =>
        renderEmail('demo_request_confirmation', { kind: 'school', name: 'Sample' }, OPTIONS),
      ).toThrow();
    });

    it('never contains the request’s name, school or note, whatever they are', () => {
      const text = fc
        .string({ minLength: 4, maxLength: 60 })
        .filter((value) => value.trim().length >= 4);
      fc.assert(
        fc.property(
          fc.constantFrom('school', 'parent'),
          text,
          text,
          text,
          (kind, name, s, note) => {
            const request: DemoRequestDetails =
              kind === 'school'
                ? { ...school, name, school: s }
                : { ...parent, name, school: s, note };
            const jobs = demoRequestEmailJobs(
              { leadId: LEAD, created: true },
              request,
              settings,
              NONCE,
            );
            const confirm = jobs.find((job) => job.template === 'demo_request_confirmation');
            if (confirm === undefined) throw new Error('no confirmation');
            const message = buildEmailMessage(
              {
                to: confirm.to,
                tenantId: null,
                school: null,
                template: confirm.template,
                params: confirm.params,
              },
              SETTINGS,
            );
            const all = [message.subject, message.text, message.html, message.replyTo ?? ''].join(
              '\n',
            );
            for (const typed of [name, s, note]) {
              expect(all).not.toContain(typed);
            }
            expect(message.replyTo).toBe('support@quad-edu.com');
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  describe('the sales email', () => {
    it('lists every filled field of a school request, with Reply-To the requester', () => {
      const message = buildEmailMessage(
        {
          to: SALES_INBOX,
          tenantId: null,
          school: null,
          template: 'demo_request_sales',
          params: salesParams(school),
        },
        SETTINGS,
      );

      expect(message.from.name).toBe('Quad');
      expect(message.replyTo).toBe('sample.person@example.test');
      expect(message.subject).toBe('Demo request: Sample School');
      for (const line of [
        'Name: Sample Person',
        'Email: sample.person@example.test',
        'School: Sample School',
        'Country: Portugal',
        'Students: 300–1,000',
        'Curriculum: IB',
      ]) {
        expect(message.text).toContain(line);
      }
      expect(message.text).toContain(`Open in the console:\n${CONSOLE}/leads/${LEAD}`);
      expect(message.html).toContain(`href="${CONSOLE}/leads/${LEAD}"`);
      for (const part of [message.subject, message.text, message.html]) {
        expect(part).not.toMatch(/[{}]/);
      }
    });

    it('labels a parent request "From a parent" and lists its city and note', () => {
      const message = buildEmailMessage(
        {
          to: SALES_INBOX,
          tenantId: null,
          school: null,
          template: 'demo_request_sales',
          params: salesParams(parent),
        },
        SETTINGS,
      );

      expect(message.subject).toBe('From a parent: Sample School');
      expect(message.text).toContain(
        'From a parent: Quad’s team follows up with the school. Nothing has been sent to the school.',
      );
      expect(message.text).toContain('City: Lisbon');
      expect(message.text).toContain('Note: Our school would love this.\nPlease get in touch.');
      expect(message.text).not.toContain('Students:');
    });

    it('leaves out the fields that were not filled', () => {
      const params = salesParams({ ...school, country: undefined });
      const email = renderEmail('demo_request_sales', params, OPTIONS);
      expect(email.text).not.toContain('Country:');
    });

    it('escapes what the visitor typed in the HTML and keeps it plain text', () => {
      const params = salesParams({
        ...parent,
        name: '<script>alert(1)</script>',
        note: '<img src=x onerror=alert(1)> & "quotes"',
      });
      const email = renderEmail('demo_request_sales', params, OPTIONS);

      expect(email.html).not.toContain('<script>');
      expect(email.html).not.toContain('<img');
      expect(email.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(email.html).toContain('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;quotes&quot;');
      expect(email.text).toContain('Name: <script>alert(1)</script>');
    });

    it('never has a line break in its subject', () => {
      const params = { ...salesParams(school), school: 'Sample\r\nBcc: someone@example.test' };
      expect(() => renderEmail('demo_request_sales', params, OPTIONS)).toThrow();
      const message = buildEmailMessage(
        {
          to: SALES_INBOX,
          tenantId: null,
          school: null,
          template: 'demo_request_sales',
          params: salesParams({ ...school, school: 'Sample School' }),
        },
        SETTINGS,
      );
      expect(message.subject).not.toMatch(/[\r\n]/);
    });

    it('refuses a console link that does not lead to CONSOLE_URL', () => {
      const params = { ...salesParams(school), link: 'https://evil.example/leads/1' };
      expect(() => renderEmail('demo_request_sales', params, OPTIONS)).toThrow(/CONSOLE_URL/);
    });
  });
});
