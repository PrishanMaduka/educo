/*
 * The sub-processor list, shown in the privacy policy's "Companies that handle data for us" section
 * (spec 19 "Sub-processors (D21)", D44). The rows are the spec's table word for word; change the
 * spec, this list and the privacy policy's date and version together, and tell schools 30 days
 * ahead (spec 16).
 */

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

/** One card per sub-processor, so the list fits the policy's reading column at any width. */
export function SubprocessorCards() {
  return (
    <ul className="m-0! list-none p-0!" aria-label="Sub-processors">
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
  );
}
