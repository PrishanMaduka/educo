import Link from 'next/link';

import { COMPANY } from '../../src/app/(public)/_lib/company';

import { SUBPROCESSORS } from './subprocessors';

import type { ArticleContent } from '../../src/app/(public)/_lib/article';

/*
 * The privacy policy at /legal/privacy (spec 19 "Legal pages", spec 16, D21, D37, D41). Plain
 * English; it describes how Quad is built to work. Needs legal review before launch.
 */

const privacy = COMPANY.contact.privacy;
const mail = (address: string) => <a href={`mailto:${address}`}>{address}</a>;

/** Sub-processors that handle data outside ap-south-1 (all but AWS, which hosts in the region). */
const outsideRegion = SUBPROCESSORS.filter((row) => row.name !== 'Amazon Web Services').map(
  (row) => row.name,
);

export const privacyPage: ArticleContent = {
  path: '/legal/privacy',
  eyebrow: 'Legal',
  title: 'Privacy policy',
  metaTitle: 'Privacy policy – Quad',
  summary:
    'Schools decide what happens to their data and Quad looks after it for them; this page explains what Quad holds, where it is kept, and how to ask about it.',
  description:
    'How Quad handles personal data: what each app holds, children’s data, storage in AWS Mumbai, Ask Quad, retention, cookies and your rights.',
  updated: { date: '2026-10-09', version: '0.1' },
  hasContents: true,
  sections: [
    {
      id: 'who-we-are',
      title: 'Who we are',
      body: (
        <>
          <p>
            Quad is a school platform: a staff portal for each school, the Quad app for parents, and
            a console for Quad’s own team. Quad is in development and preparing pilots with schools.
          </p>
          <p>
            Quad is provided by {COMPANY.legalName}, {COMPANY.registeredAddress} (
            {COMPANY.registrationNumber}). For anything about privacy, email {mail(privacy)}.
          </p>
        </>
      ),
    },
    {
      id: 'roles',
      title: 'Our two roles',
      body: (
        <>
          <p>
            <strong>For school data, the school is in charge.</strong> Each school decides what it
            records about its students, families and staff, and why. Quad is the school’s processor:
            we store and use that data only to run Quad for the school, on its instructions and
            under its agreement with us.
          </p>
          <p>
            <strong>For this website, we are in charge.</strong> Quad is the controller for
            information about visitors to quad-edu.com and people who ask us for a demo.
          </p>
          <p>
            If you are a parent or a member of staff with a question about your school’s records,
            ask your school first. We help schools answer these requests.
          </p>
        </>
      ),
    },
    {
      id: 'staff-portal',
      title: 'What the staff portal holds',
      body: (
        <>
          <p>The staff portal is where a school runs its day. It holds:</p>
          <ul>
            <li>
              <strong>Staff accounts:</strong> name, work email, role, the password in hashed form,
              the two-step sign-in secret (encrypted) and a record of sign-ins.
            </li>
            <li>
              <strong>The school’s records:</strong> students and their guardians, admissions,
              attendance, timetables and cover, marks, exams and reports, fees and invoices,
              messages and moments, and pastoral notes.
            </li>
            <li>
              <strong>Sensitive records:</strong> safeguarding entries and medical notes. These are
              encrypted field by field, only staff with a sensitive-access permission can open them,
              and every view is logged.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: 'parent-app',
      title: 'What the parent app holds',
      body: (
        <>
          <p>The Quad app for parents shows a family what the school shares. It holds:</p>
          <ul>
            <li>
              <strong>Your account:</strong> your name, phone number (you sign in with a code sent
              by SMS), your relationship to your child, and your device’s push token so we can send
              notifications.
            </li>
            <li>
              <strong>What you do in the app:</strong> messages to the school, thank-yous, bookings,
              consent choices (such as photo consent for your child) and the relatives you invite.
            </li>
            <li>
              <strong>Payments:</strong> when you pay a fee by card, the school’s own payment
              provider takes the card details. Quad receives the payer’s name, email and the amount,
              never the card number.
            </li>
            <li>
              <strong>Relatives you invite:</strong> their name and phone number. They see moments
              only, and you or the school can remove them at any time.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: 'console',
      title: 'What the platform console holds',
      body: (
        <>
          <p>
            Quad’s own team uses the console to set up and support schools. It holds our team’s
            accounts, each school’s name, plan, contacts and billing details, and a record of
            everything the team does there.
          </p>
          <p>
            When the team needs to look inside a school to help it, they must give a reason, the
            access lasts at most 60 minutes, the school sees a banner, it is logged by both the
            school and Quad, and it never reaches safeguarding or medical records.
          </p>
        </>
      ),
    },
    {
      id: 'children',
      title: 'Children’s data',
      body: (
        <>
          <p>
            Most of the data in Quad is about children, and we handle it only on the school’s
            instructions. Children do not sign in to Quad.
          </p>
          <ul>
            <li>
              Photos of a child are shared only as far as the child’s guardians allow: with the
              class, with the family only, or not at all.
            </li>
            <li>Health and safeguarding records never appear in moments or the Circle.</li>
            <li>
              Children’s data is never sold, never used for advertising, and never used to train AI
              models.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: 'website',
      title: 'Visitors to this website and demo requests',
      body: (
        <>
          <p>
            When you ask for a demo or ask us to tell your school about Quad, the form opens an
            email to us in your own email app. We receive what you send: usually your name, email
            address, school and anything you add. We use it only to reply and arrange a walkthrough,
            and we delete requests that never lead to an agreement 24 months after our last contact.
          </p>
          <p>
            If we count visits to this website, we use Plausible Analytics, which sets no cookies
            and collects no personal data. When the demo form starts sending requests to us
            directly, Cloudflare Turnstile will check that a person, not a bot, is sending it.
          </p>
        </>
      ),
    },
    {
      id: 'sign-in',
      title: 'How people sign in',
      body: (
        <ul>
          <li>
            <strong>School staff:</strong> work email and password, then a two-step code from an
            authenticator app where the school requires it.
          </li>
          <li>
            <strong>Parents and relatives:</strong> a one-time code sent by SMS to their phone.
          </li>
          <li>
            <strong>Quad’s own team:</strong> email, password and a two-step code, always.
          </li>
          <li>There is no sign-in with Google, Microsoft or social media accounts.</li>
        </ul>
      ),
    },
    {
      id: 'where',
      title: 'Where data is stored',
      body: (
        <>
          <p>
            School data is stored and processed in Amazon Web Services’ Mumbai region (ap-south-1):
            the database, files, queues and backups. A copy of each daily backup is kept in
            Singapore (ap-southeast-1) so we can recover from a disaster.
          </p>
          <p>
            A short list of sub-processors handle limited data outside that region, each for one
            purpose: {outsideRegion.join(', ')}. The{' '}
            <Link href="/legal/subprocessors">sub-processors page</Link> says what each one receives
            and where.
          </p>
        </>
      ),
    },
    {
      id: 'ask-quad',
      title: 'Ask Quad and Anthropic',
      body: (
        <>
          <p>
            Ask Quad is an assistant that answers questions from the school’s own records. It is
            powered by Claude by Anthropic, through Anthropic’s API.
          </p>
          <ul>
            <li>
              <strong>What is sent:</strong> the question and the results of the read-only lookups
              needed to answer it, such as names, classes and figures. Only what the person asking
              is allowed to see is ever looked up.
            </li>
            <li>
              <strong>What is never sent:</strong> safeguarding records, medical records and contact
              details.
            </li>
            <li>
              <strong>Training:</strong> data sent through Anthropic’s API is not used to train its
              models. We use zero data retention where it is available to us.
            </li>
            <li>
              <strong>Keeping conversations:</strong> Quad keeps Ask Quad conversations for 90 days,
              or not at all if the school chooses.
            </li>
            <li>
              <strong>Turning it off:</strong> each school can turn Ask Quad off in its settings.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: 'retention',
      title: 'How long data is kept',
      body: (
        <>
          <p>
            Schools can keep some records for longer where the law requires it. Otherwise these are
            the defaults, and a nightly job deletes data when its time is up:
          </p>
          <ul>
            <li>Student records: 7 years after the student leaves (the school can extend this).</li>
            <li>Attendance: 7 years.</li>
            <li>
              Safeguarding records: 25 years from the child’s date of birth (the school can change
              this).
            </li>
            <li>Medical records: 7 years after the student leaves.</li>
            <li>Messages and moments: 3 years after the academic year ends.</li>
            <li>Ask Quad conversations: 90 days, or none.</li>
            <li>Notifications: 90 days.</li>
            <li>Audit logs: 7 years.</li>
            <li>Demo requests that never led to an agreement: 24 months.</li>
            <li>Anything deleted in Quad: removed for good after 30 days.</li>
          </ul>
          <p>Backups age out within 35 days, so deleted data leaves them too.</p>
        </>
      ),
    },
    {
      id: 'rights',
      title: 'Your rights and how to ask',
      body: (
        <>
          <p>
            Depending on where you live, laws such as Sri Lanka’s Personal Data Protection Act (No.
            9 of 2022) and the GDPR give you the right to see the data held about you, to have it
            corrected or deleted, to get a copy, and to object to how it is used. You can also
            complain to your data protection authority.
          </p>
          <p>
            For data a school holds about you or your child, ask the school: it can export a
            student’s or guardian’s data and delete it on request, and we help it do so. For
            anything else, or if you are not sure, email {mail(privacy)}.
          </p>
        </>
      ),
    },
    {
      id: 'cookies',
      title: 'Cookies',
      body: (
        <>
          <p>Quad uses only cookies that are strictly necessary for it to work:</p>
          <ul>
            <li>a session cookie that keeps you signed in;</li>
            <li>a security token that protects your forms (CSRF);</li>
            <li>quad_theme, which remembers light or dark mode;</li>
            <li>quad_last_school, which remembers the last school you opened;</li>
            <li>Cloudflare Turnstile’s cookie, when the demo form checks for bots.</li>
          </ul>
          <p>
            There are no tracking or advertising cookies, so there is no cookie banner. This website
            also remembers your theme and whether you chose the school or parent view in your
            browser’s own storage; that never leaves your device.
          </p>
        </>
      ),
    },
    {
      id: 'security',
      title: 'Keeping data safe',
      body: (
        <p>
          The <Link href="/security">Security &amp; trust</Link> page explains how Quad protects
          data. If a breach ever affects a school’s data, we tell the school within 72 hours.
        </p>
      ),
    },
    {
      id: 'changes',
      title: 'Changes to this policy',
      body: (
        <p>
          The date and version at the top show when this policy last changed. We email school admins
          at least 30 days before any material change.
        </p>
      ),
    },
    {
      id: 'contact',
      title: 'Contact',
      body: (
        <p>
          Email {mail(privacy)}, or write to {COMPANY.legalName}, {COMPANY.registeredAddress}.
        </p>
      ),
    },
  ],
};
