import Link from 'next/link';

import { COMPANY } from '../../src/app/(public)/_lib/company';

import type { ArticleContent } from '../../src/app/(public)/_lib/article';

/*
 * The sub-processor list at /legal/subprocessors (spec 19 "Sub-processors (D21)"). The rows are the
 * spec's table word for word; change the spec, this list and SUBPROCESSORS_CHANGED together, and
 * tell schools 30 days ahead (spec 16).
 */

/** The date the list last changed (`YYYY-MM-DD`). */
export const SUBPROCESSORS_CHANGED = '2026-10-09';

export interface Subprocessor {
  name: string;
  purpose: string;
  data: string;
  location: string;
}

export const SUBPROCESSORS: readonly Subprocessor[] = [
  {
    name: 'Amazon Web Services',
    purpose: 'Hosting, database, storage, email (SES)',
    data: 'All school data; email address and message content for email',
    location:
      'India (ap-south-1); SES sends from the same region; backup snapshots copied to Singapore (ap-southeast-1)',
  },
  {
    name: 'Anthropic',
    purpose: 'Ask Quad answers (schools can turn Ask Quad off)',
    data: 'The question and the tool results needed to answer it; never safeguarding or medical data. No training on the data; zero retention where available',
    location: 'United States',
  },
  {
    name: 'Google Firebase (FCM)',
    purpose: 'Push notifications',
    data: 'Device push token and notification title and text',
    location: 'Global',
  },
  {
    name: 'Sentry',
    purpose: 'Error tracking',
    data: 'Error details with personal data scrubbed',
    location: 'United States or EU (chosen at setup)',
  },
  {
    name: 'Notify.lk',
    purpose: 'SMS in Sri Lanka',
    data: 'Phone number and SMS text',
    location: 'Sri Lanka',
  },
  {
    name: 'Twilio',
    purpose: 'SMS outside Sri Lanka',
    data: 'Phone number and SMS text',
    location: 'United States',
  },
  {
    name: 'Cloudflare (Turnstile)',
    purpose: 'Captcha on the demo form',
    data: 'IP address and browser signals for the check',
    location: 'Global',
  },
  {
    name: 'Grafana Labs',
    purpose: 'Metrics, traces and logs (no personal data)',
    data: 'Technical telemetry with tenant ids',
    location: 'Chosen region nearest ap-south-1',
  },
  {
    name: 'Plausible Analytics',
    purpose: 'Landing-page visit counts (public site only)',
    data: 'No cookies, no personal data',
    location: 'EU',
  },
  {
    name: 'PayHere, Stripe',
    purpose: 'Card payments — contracted by each school directly, listed for transparency',
    data: 'Payer name, email, amount',
    location: 'Sri Lanka; global',
  },
];

const COLUMNS = [
  { key: 'name', label: 'Sub-processor' },
  { key: 'purpose', label: 'Purpose' },
  { key: 'data', label: 'Data' },
  { key: 'location', label: 'Location' },
] as const;

/**
 * The list as a table on wide screens and as one card per sub-processor at 760 px and below, so
 * nothing scrolls sideways at 390 px.
 */
function SubprocessorList() {
  return (
    <>
      <table className="w-full border-collapse text-[15px] leading-[1.5] max-[760px]:hidden">
        <caption className="sr-only">Sub-processors: purpose, data and location of each</caption>
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th
                key={column.key}
                scope="col"
                className="border-b-2 border-solid border-site-card-line px-3 py-2 text-left align-bottom font-bold text-site-page-ink first:pl-0"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SUBPROCESSORS.map((row) => (
            <tr key={row.name}>
              <th
                scope="row"
                className="border-b border-solid border-site-card-line py-3 pr-3 text-left align-top font-bold text-site-page-ink"
              >
                {row.name}
              </th>
              <td className="border-b border-solid border-site-card-line px-3 py-3 align-top">
                {row.purpose}
              </td>
              <td className="border-b border-solid border-site-card-line px-3 py-3 align-top">
                {row.data}
              </td>
              <td className="border-b border-solid border-site-card-line px-3 py-3 align-top">
                {row.location}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="m-0! list-none p-0! min-[761px]:hidden">
        {SUBPROCESSORS.map((row) => (
          <li
            key={row.name}
            className="my-3! rounded-2xl border border-solid border-site-card-line bg-site-card-bg p-4! text-[15px]"
          >
            <h3 className="m-0! text-base! text-site-page-ink">{row.name}</h3>
            <dl className="m-0 mt-2 grid gap-y-1.5">
              {COLUMNS.slice(1).map((column) => (
                <div key={column.key}>
                  <dt className="inline font-bold text-site-page-ink">{column.label}: </dt>
                  <dd className="m-0 inline">{row[column.key]}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}

export const subprocessorsPage: ArticleContent = {
  path: '/legal/subprocessors',
  eyebrow: 'Legal',
  title: 'Sub-processors',
  metaTitle: 'Sub-processors – Quad',
  summary:
    'These are the companies that handle data for Quad, what each one receives, and where it does so.',
  description:
    'The companies that process data for Quad: what each receives, why, and where. School data is stored in AWS Mumbai (ap-south-1).',
  updated: { date: SUBPROCESSORS_CHANGED, version: '1' },
  isWide: true,
  sections: [
    {
      id: 'list',
      title: 'The list',
      body: (
        <>
          <p>
            School data is stored and processed in Amazon Web Services’ Mumbai region (ap-south-1).
            The companies below handle limited data, some of it outside that region, and only for
            the purpose shown.
          </p>
          <SubprocessorList />
        </>
      ),
    },
    {
      id: 'changes',
      title: 'When the list changes',
      body: (
        <>
          <p>
            We tell schools at least 30 days before we add or replace a sub-processor, so they can
            raise concerns first. The date at the top of this page shows when the list last changed.
          </p>
          <p>
            Email {COMPANY.contact.privacy} to be told about changes. See the{' '}
            <Link href="/legal/privacy">privacy policy</Link> for how Quad handles personal data.
          </p>
        </>
      ),
    },
  ],
};
