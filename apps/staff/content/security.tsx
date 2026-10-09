import Link from 'next/link';

import { COMPANY } from '../src/app/(public)/_lib/company';

import type { ArticleContent } from '../src/app/(public)/_lib/article';

/*
 * The Security & trust page at /security (D41). Only what the spec makes true by design (spec 02,
 * 05, 11, 16): no certifications, audits or uptime figures, and planned work is called planned.
 * Ask Quad names "Claude by Anthropic" in plain text only: no logo, no partnership wording.
 */

const mail = (address: string) => <a href={`mailto:${address}`}>{address}</a>;

export const securityPage: ArticleContent = {
  path: '/security',
  eyebrow: 'Security & trust',
  title: 'How Quad keeps school data safe.',
  metaTitle: 'Security & trust – Quad',
  summary:
    'Quad holds children’s data, so it is built to keep every school’s data apart and to give each person only the access they need.',
  description:
    'How Quad protects school data: row-level security per school, encryption, two-step sign-in, logged access to sensitive records, and responsible AI.',
  hasContents: true,
  sections: [
    {
      id: 'isolation',
      title: 'Each school’s data is kept apart',
      body: (
        <ul>
          <li>
            Each school’s data is kept separate in the database with PostgreSQL row-level security,
            forced on every school table, so a query can only ever see one school’s rows.
          </li>
          <li>
            The app connects to the database with its own role, which cannot bypass those rules.
          </li>
          <li>
            Which school a request is for comes from the signed-in session, never from the web
            address or anything else the browser sends.
          </li>
          <li>Automated tests try to read across schools on every part of the API.</li>
        </ul>
      ),
    },
    {
      id: 'encryption',
      title: 'Encryption',
      body: (
        <ul>
          <li>All traffic is encrypted in transit with TLS 1.2 or later, with HSTS.</li>
          <li>The database, files and backups are encrypted at rest.</li>
          <li>
            The most sensitive fields (two-step secrets, safeguarding entries, medical notes and
            payment gateway secrets) are encrypted again, field by field, with AES-256-GCM and keys
            held in AWS Key Management Service.
          </li>
        </ul>
      ),
    },
    {
      id: 'sign-in',
      title: 'Signing in',
      body: (
        <ul>
          <li>
            Staff sign in with their work email and a password. Passwords are stored as Argon2id
            hashes and checked against known breached passwords.
          </li>
          <li>
            Two-step sign-in with an authenticator app (TOTP) is required for school admins by
            default, and schools can require it for other roles. Quad’s own team must always use it.
          </li>
          <li>
            Repeated wrong attempts lock the account for a while, and a new device triggers an
            email.
          </li>
          <li>Parents sign in with a one-time code sent by SMS, with limits on every number.</li>
          <li>
            Links in invitations and password resets are signed, expire, and work once where it
            matters.
          </li>
        </ul>
      ),
    },
    {
      id: 'sensitive',
      title: 'Safeguarding and medical records',
      body: (
        <p>
          Safeguarding and medical records sit behind extra keys: only staff given sensitive access
          can open them, and every view is logged. They never appear in moments, early warning, Ask
          Quad or Quad’s support access.
        </p>
      ),
    },
    {
      id: 'access',
      title: 'Least privilege and audit logs',
      body: (
        <ul>
          <li>
            Each role sees only its own modules and scope. Parents see only their own children;
            relatives see only moments.
          </li>
          <li>Changes are recorded in an audit log that is kept for 7 years.</li>
          <li>
            When Quad’s team needs to look inside a school to help it, they must give a reason,
            access ends after 60 minutes, the school sees a banner, and the visit is logged by both
            the school and Quad.
          </li>
        </ul>
      ),
    },
    {
      id: 'region',
      title: 'Where data lives, and backups',
      body: (
        <p>
          School data is stored in Amazon Web Services’ Mumbai region (ap-south-1), with
          point-in-time recovery for 35 days and a daily backup copy in Singapore for disaster
          recovery. The <Link href="/legal/privacy#subprocessors">privacy policy</Link> lists every
          service that handles data and where.
        </p>
      ),
    },
    {
      id: 'ask-quad',
      title: 'Responsible AI: Ask Quad',
      body: (
        <>
          <p>
            Ask Quad answers questions from a school’s records. It is powered by Claude by
            Anthropic, through Anthropic’s API, and it is built with these limits:
          </p>
          <ul>
            <li>
              It uses read-only tools, and each tool checks what the person asking is allowed to
              see.
            </li>
            <li>It answers only from the school’s records and shows the sources it used.</li>
            <li>
              It never takes an action by itself: sending a reminder or a message is a button a
              person presses.
            </li>
            <li>It never sees safeguarding or medical data.</li>
            <li>Data sent through Anthropic’s API is not used to train its models.</li>
            <li>Each school can turn Ask Quad off.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'practice',
      title: 'How we build it',
      body: (
        <>
          <ul>
            <li>Secrets are kept in a secrets manager, never in code.</li>
            <li>Dependencies and code are scanned automatically on every change.</li>
            <li>Logs are structured with personal data left out.</li>
          </ul>
          <p>
            Quad has not been independently audited or certified. An external penetration test is
            planned before the first school goes live, and then every year.
          </p>
        </>
      ),
    },
    {
      id: 'report',
      title: 'Report a security issue',
      body: (
        <p>
          If you think you have found a security issue in Quad, email{' '}
          {mail(COMPANY.contact.security)}. Please give us a chance to fix it before telling anyone
          else.
        </p>
      ),
    },
  ],
};
