import { greetingPeriod, type GreetingResult } from '@quad/domain';
import { formatDate } from '@quad/ui';

import { Greeting } from './_components/Greeting';

import type { Metadata } from 'next';

import { t, type MessageKey } from '@/i18n';
import { PLACEHOLDER_SCHOOL, PLACEHOLDER_USER } from '@/lib/placeholders';

// The greeting follows the time of day, so the page renders on each request, never at build time.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: t('nav.staff.home') };

const greetingKey: Record<GreetingResult['word'], MessageKey> = {
  'Good morning': 'greeting.morning',
  'Good afternoon': 'greeting.afternoon',
  'Good evening': 'greeting.evening',
  Hello: 'greeting.hello',
};

export default function StaffHome() {
  // Computed once on the server and passed down, so the client renders the same period (no hydration mismatch).
  const now = new Date();
  const { period, word } = greetingPeriod(now, PLACEHOLDER_SCHOOL.timeZone);
  return (
    <Greeting
      period={period}
      greeting={t(greetingKey[word])}
      firstName={PLACEHOLDER_USER.firstName}
      dateLine={formatDate(now, PLACEHOLDER_SCHOOL.timeZone, 'weekday')}
      summary={t('home.staff.summaryPlaceholder')}
    />
  );
}
