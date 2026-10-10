import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import {
  EMAIL_TEMPLATES,
  SMS_TEMPLATES,
  renderEmail,
  renderSms,
} from '../../src/common/delivery/templates';
import { formatMessage } from '../../src/common/delivery/templates/render';

import type { EmailTemplateId } from '../../src/common/delivery/templates';

const WEB = 'http://localhost:3000';
const CONSOLE = 'http://localhost:3001';
const SCHOOL = 'Colombo International School';

/** One valid set of parameters per template; every template must appear here. */
const SAMPLES: Record<EmailTemplateId, Record<string, unknown>> = {
  staff_invite: {
    name: 'Nadeesha',
    inviter: 'Prishan Maduka',
    link: `${WEB}/sign-in/invite/abc.def`,
    days: 7,
  },
  password_reset: { link: `${WEB}/sign-in/reset/abc.def`, minutes: 30 },
  lockout: { attempts: 5, minutes: 15, link: `${WEB}/sign-in/forgot` },
  two_step_reminder: { name: 'Nadeesha', link: `${WEB}/app/me/security` },
  new_device: {
    device: 'Chrome on Windows',
    signedInAt: '2026-10-08T04:00:00.000Z',
    timeZone: 'Asia/Colombo',
    link: `${WEB}/app/me/sessions`,
  },
  email_otp: { code: '482913', minutes: 10 },
  demo_request_sales: {
    kind: 'school',
    name: 'Sample Person',
    email: 'sample.person@example.test',
    school: 'Sample School',
    students: 'under_300',
    curriculum: 'national',
    link: `${CONSOLE}/leads/0193e6a1-0000-7000-8000-00000000abcd`,
  },
  demo_request_confirmation: { kind: 'parent' },
};

const schoolFor = (id: EmailTemplateId): string | null =>
  EMAIL_TEMPLATES[id].sender === 'school' ? SCHOOL : null;

describe('email templates', () => {
  it('covers the six M1 emails and the two demo request emails', () => {
    expect(Object.keys(EMAIL_TEMPLATES).sort()).toEqual(Object.keys(SAMPLES).sort());
  });

  it.each(Object.keys(SAMPLES) as EmailTemplateId[])(
    '%s renders a subject, text and HTML with no unfilled ICU argument',
    (id) => {
      const email = renderEmail(id, SAMPLES[id], {
        school: schoolFor(id),
        publicWebUrl: WEB,
        consoleUrl: CONSOLE,
      });
      expect(email.subject.length).toBeGreaterThan(0);
      for (const part of [email.subject, email.text, email.html]) {
        expect(part).not.toMatch(/[{}]/);
      }
      expect(email.html).toMatch(/^<!doctype html>/);
      if (EMAIL_TEMPLATES[id].sender === 'school') expect(email.text).toContain(SCHOOL);
    },
  );

  it('puts the action link in the text and the HTML', () => {
    const email = renderEmail('password_reset', SAMPLES.password_reset, {
      school: null,
      publicWebUrl: WEB,
    });
    expect(email.text).toContain(`${WEB}/sign-in/reset/abc.def`);
    expect(email.html).toContain(`href="${WEB}/sign-in/reset/abc.def"`);
    expect(email.text).toContain('30 minutes');
  });

  it('uses ICU plurals', () => {
    const email = renderEmail(
      'staff_invite',
      { ...SAMPLES.staff_invite, days: 1 },
      { school: SCHOOL, publicWebUrl: WEB },
    );
    expect(email.text).toContain('1 day.');
  });

  it('shows the new-device time in the given time zone', () => {
    const email = renderEmail('new_device', SAMPLES.new_device, {
      school: null,
      publicWebUrl: WEB,
    });
    expect(email.text).toContain('8 October 2026 at 09:30');
  });

  it('greets by name only when a name is given', () => {
    const named = renderEmail('two_step_reminder', SAMPLES.two_step_reminder, {
      school: SCHOOL,
      publicWebUrl: WEB,
    });
    expect(named.text.startsWith('Hello Nadeesha,')).toBe(true);
    const plain = renderEmail(
      'two_step_reminder',
      { link: `${WEB}/app/me/security` },
      { school: SCHOOL, publicWebUrl: WEB },
    );
    expect(plain.text.startsWith('Hello,')).toBe(true);
  });

  it('escapes values in the HTML', () => {
    const email = renderEmail(
      'staff_invite',
      { ...SAMPLES.staff_invite, inviter: '<b>Prishan</b> & co' },
      { school: SCHOOL, publicWebUrl: WEB },
    );
    expect(email.html).toContain('&lt;b&gt;Prishan&lt;/b&gt; &amp; co');
    expect(email.html).not.toContain('<b>Prishan');
  });

  it('refuses parameters that do not match the template', () => {
    expect(() =>
      renderEmail('password_reset', { link: `${WEB}/x` }, { school: null, publicWebUrl: WEB }),
    ).toThrow(ZodError);
  });

  it('refuses a link to anywhere but the web app', () => {
    expect(() =>
      renderEmail(
        'password_reset',
        { ...SAMPLES.password_reset, link: 'https://evil.example/sign-in/reset/abc' },
        { school: null, publicWebUrl: WEB },
      ),
    ).toThrow(/link/);
  });

  it('refuses a school email without the school, and an account email with one', () => {
    expect(() =>
      renderEmail('staff_invite', SAMPLES.staff_invite, { school: null, publicWebUrl: WEB }),
    ).toThrow(/school/);
    expect(() =>
      renderEmail('email_otp', SAMPLES.email_otp, { school: SCHOOL, publicWebUrl: WEB }),
    ).toThrow(/school/);
  });
});

describe('formatMessage', () => {
  it('throws when an ICU argument has no value, instead of sending a blank', () => {
    expect(() => formatMessage('email.staffInvite.subject', { inviter: 'Prishan' })).toThrow();
  });
});

describe('SMS templates', () => {
  it('renders the OTP text with the code and no unfilled ICU argument', () => {
    expect(Object.keys(SMS_TEMPLATES)).toEqual(['otp']);
    const text = renderSms('otp', { code: '482913', minutes: 10 });
    expect(text).toContain('482913');
    expect(text).toContain('10 minutes');
    expect(text).not.toMatch(/[{}]/);
  });

  it('refuses a code that is not six digits', () => {
    expect(() => renderSms('otp', { code: '48291', minutes: 10 })).toThrow(ZodError);
  });
});
