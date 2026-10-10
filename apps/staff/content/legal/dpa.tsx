/*
 * NEEDS LEGAL REVIEW BEFORE LAUNCH. A plain-English first draft (version 0.1) of the data
 * processing agreement between Quad and each school (spec 19 "Legal pages", D21, D41, D57; owner,
 * OQ6, 2026-10-10). It says only what the spec makes true: no certifications, and the penetration
 * test is planned. Company facts, governing law and the contact address come from
 * src/app/(public)/_lib/company.ts.
 */
import Link from 'next/link';

import { COMPANY } from '../../src/app/(public)/_lib/company';

import type { ArticleContent } from '../../src/app/(public)/_lib/article';

const support = COMPANY.contact.support;
const mail = (address: string) => <a href={`mailto:${address}`}>{address}</a>;

export const dpaPage: ArticleContent = {
  path: '/legal/dpa',
  eyebrow: 'Legal',
  title: 'Data processing agreement',
  metaTitle: 'Data processing agreement – Quad',
  summary:
    'This agreement sets out how Quad looks after the personal data each school puts into Quad, as the school’s processor.',
  description:
    'Quad’s data processing agreement with schools: instructions, confidentiality, security, sub-processors, breach notice, transfers, deletion and audits.',
  updated: { date: '2026-10-10', version: '0.1' },
  notice: 'Draft, version 0.1: this needs legal review before launch.',
  layout: 'legal',
  inShort: [
    'The school decides what happens to its data. Quad is its processor and acts only on its instructions.',
    'Everyone at Quad who can reach school data must keep it confidential.',
    'If a breach affects the school’s data, we tell the school within 72 hours.',
    'We tell schools 30 days before we add or replace a sub-processor, and the school can object.',
    'School data is stored in AWS Mumbai (ap-south-1), with a backup copy in Singapore.',
    'When the agreement ends, we return the data on request and delete it; backups age out within 35 days.',
  ],
  sections: [
    {
      id: 'who',
      title: 'Who is who',
      icon: 'swap',
      body: (
        <>
          <p>
            This agreement is between {COMPANY.legalName} (“Quad”, “we”) and the school or school
            group that uses Quad (“the school”). It is part of the school’s{' '}
            <Link href="/legal/terms">terms of service</Link>; where the two disagree about personal
            data, this agreement wins.
          </p>
          <p>
            <strong>The school is the controller.</strong> It decides what it records about its
            students, their families and its staff, and why. <strong>Quad is the processor.</strong>{' '}
            We store and use that data only to run Quad for the school.
          </p>
          <p>
            The data includes names and contact details, attendance, timetables, marks and reports,
            fees, messages and moments, and, where the school records them, safeguarding and medical
            notes. This agreement lasts as long as Quad holds any of the school’s data.
          </p>
        </>
      ),
    },
    {
      id: 'instructions',
      title: 'We act only on the school’s instructions',
      icon: 'rule',
      body: (
        <>
          <p>
            We process the school’s data only to provide Quad, as the school’s agreement, its
            settings and its written instructions say. How the school uses Quad (what it records,
            who it invites, which modules it turns on, and whether Ask Quad is on) counts as its
            instructions.
          </p>
          <p>
            If we think an instruction would break data protection law, we tell the school. If the
            law ever requires us to process the data in some other way, we tell the school first,
            unless the law forbids it.
          </p>
          <p>
            We never sell school data, and children’s data is never used for advertising or to train
            AI models.
          </p>
        </>
      ),
    },
    {
      id: 'staff',
      title: 'Our staff keep it confidential',
      icon: 'user',
      body: (
        <>
          <p>
            Everyone at Quad who can reach school data is bound to keep it confidential, gets access
            only as far as their work needs, and has that access logged.
          </p>
          <p>
            When our team needs to look inside a school to help it, they must give a reason, the
            access lasts at most 60 minutes, the school sees a banner, and the visit is logged by
            both the school and Quad. It never reaches safeguarding or medical records.
          </p>
        </>
      ),
    },
    {
      id: 'security',
      title: 'Security measures',
      icon: 'lock',
      body: (
        <>
          <p>We protect school data with measures that include:</p>
          <ul>
            <li>
              each school’s data kept apart in the database by row-level security, forced on every
              school table;
            </li>
            <li>
              encryption in transit and at rest, and the most sensitive fields encrypted again,
              field by field;
            </li>
            <li>two-step sign-in for school admins by default, and always for Quad’s own team;</li>
            <li>
              safeguarding and medical records open only to staff given sensitive access, with every
              view logged;
            </li>
            <li>an audit log of changes, kept for 7 years.</li>
          </ul>
          <p>
            <Link href="/security">Security &amp; trust</Link> describes them in full. Quad has not
            been independently audited or certified. An external penetration test is planned before
            the first school goes live, and then every year.
          </p>
        </>
      ),
    },
    {
      id: 'subprocessors',
      title: 'Sub-processors',
      icon: 'box',
      body: (
        <>
          <p>
            The school agrees that we may use the companies listed in the{' '}
            <Link href="/legal/privacy#subprocessors">privacy policy’s list of sub-processors</Link>
            , each only for the purpose shown there. We give each of them data protection terms that
            protect the school’s data as this agreement does, and we stay responsible to the school
            for their work.
          </p>
          <p>
            We email school admins at least 30 days before we add or replace a sub-processor, so the
            school can object before the change. Email {mail(support)} to raise an objection or a
            concern.
          </p>
        </>
      ),
    },
    {
      id: 'rights',
      title: 'Help with rights requests',
      icon: 'family',
      body: (
        <>
          <p>
            When a parent, a member of staff or anyone else asks the school to see, correct, delete
            or get a copy of their data, we help the school answer. The school can export a
            student’s or guardian’s data and delete it in Quad, and we help with anything it cannot
            do itself.
          </p>
          <p>
            If someone sends a request about the school’s data to us, we pass it to the school
            rather than answer it ourselves.
          </p>
        </>
      ),
    },
    {
      id: 'breach',
      title: 'Breach notice within 72 hours',
      icon: 'alert',
      body: (
        <p>
          If a personal data breach affects the school’s data, we tell the school without undue
          delay and within 72 hours of finding it, with what we know: what happened, the data and
          people likely to be affected, and what we are doing about it. We help the school tell its
          regulator and the people affected where the law requires it.
        </p>
      ),
    },
    {
      id: 'transfers',
      title: 'Where data goes',
      icon: 'globe',
      body: (
        <>
          <p>
            School data is stored and processed in Amazon Web Services’ Mumbai region (ap-south-1).
            A copy of each daily backup is kept in Singapore (ap-southeast-1) so we can recover from
            a disaster. A short list of sub-processors handle limited data outside that region, each
            for one purpose, as the privacy policy shows.
          </p>
          <p>
            For a school in the European Union or the United Kingdom, we agree the safeguards the
            GDPR requires for data that leaves those areas, such as standard contractual clauses,
            with the school before any of its data is transferred.
          </p>
        </>
      ),
    },
    {
      id: 'laws',
      title: 'The laws it follows',
      icon: 'scale',
      body: (
        <p>
          For a school in Sri Lanka, this agreement is meant to meet the Personal Data Protection
          Act (No. 9 of 2022). For a school in the European Union or the United Kingdom, it is meant
          to cover what the GDPR and the UK GDPR require of a contract with a processor (Article
          28). Where a school’s own law asks for more, we agree it with the school in its order
          form.
        </p>
      ),
    },
    {
      id: 'end',
      title: 'Deletion and return at the end',
      icon: 'door',
      body: (
        <p>
          The school can export its data at any time. When the agreement ends, we return the data on
          request and then delete it, unless the law requires us to keep some of it. Backups age out
          within 35 days, so deleted data leaves them too.
        </p>
      ),
    },
    {
      id: 'audits',
      title: 'Audits and information',
      icon: 'audit',
      body: (
        <p>
          We give the school the information it needs to show that this agreement is kept, and we
          allow and help with audits by the school, or an auditor it appoints, on reasonable notice.
          The school can also see its own audit log in Quad at any time.
        </p>
      ),
    },
    {
      id: 'law',
      title: 'Governing law',
      icon: 'flag',
      body: (
        <p>
          This agreement is governed by: {COMPANY.governingLaw}. Disputes go to: {COMPANY.courts}.
        </p>
      ),
    },
    {
      id: 'contact',
      title: 'Contact',
      icon: 'chat',
      body: (
        <p>
          {COMPANY.legalName}, {COMPANY.registeredAddress} ({COMPANY.registrationNumber}). Email{' '}
          {mail(support)}.
        </p>
      ),
    },
  ],
};
