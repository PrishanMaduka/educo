/*
 * The sub-processor list, shown in the privacy policy's "Companies that handle data for us" section
 * (spec 19 "Sub-processors (D21)", D44). The rows are the spec's table word for word; change the
 * spec, this list and the privacy policy's date and version together, and tell schools 30 days
 * ahead (spec 16). Google Analytics (owner, 2026-10-10, D57) handles data
 * about visitors to this website, for which Quad is the controller, so it is listed apart from the
 * companies that process school data.
 */
import { FactCards } from './fact-cards';

export interface Subprocessor {
  name: string;
  /** The company that provides it, when that differs by where the visitor is. */
  provider?: string;
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
    name: 'PayHere, Stripe',
    purpose: 'Card payments — contracted by each school directly, listed for transparency',
    data: 'Payer name, email, amount',
    location: 'Sri Lanka; global',
  },
];

/** Companies that handle data about visitors to this website, for which Quad decides (D57). */
export const SITE_PROCESSORS: readonly Subprocessor[] = [
  {
    name: 'Google Analytics',
    provider: 'Google Ireland Limited for visitors in the EEA and UK, Google LLC elsewhere',
    purpose: 'Website visit counts, only if you accept analytics cookies',
    data: 'Cookie id, pages viewed, device and browser, approximate location',
    location: 'United States and global',
  },
];

/** One card per company, in as many columns as fit the policy's card (one on phones). */
export function SubprocessorCards({
  rows = SUBPROCESSORS,
  label = 'Sub-processors',
}: {
  rows?: readonly Subprocessor[];
  label?: string;
}) {
  return (
    <FactCards
      label={label}
      cards={rows.map((row) => ({
        title: row.name,
        facts: [
          ['Provided by', row.provider],
          ['Purpose', row.purpose],
          ['Data', row.data],
          ['Location', row.location],
        ],
      }))}
    />
  );
}
