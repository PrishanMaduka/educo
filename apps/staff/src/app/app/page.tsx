import { type GreetingResult } from '@quad/domain';
import { formatDate } from '@quad/ui';
import { redirect } from 'next/navigation';

import { Greeting } from './_components/Greeting';

import type { Metadata } from 'next';

import { NoAccess } from '@/components/shell/NoAccess';
import { accessOf, hiddenByOf, hrefOf, roleNameOf } from '@/components/shell/staff-nav';
import { t, type MessageKey } from '@/i18n';
import { requireSignedIn } from '@/lib/server-session';

// The greeting follows the time of day and the session, so the page renders on each request.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: t('nav.staff.page.dashboard') };

const greetingKey: Record<GreetingResult['word'], MessageKey> = {
  'Good morning': 'greeting.morning',
  'Good afternoon': 'greeting.afternoon',
  'Good evening': 'greeting.evening',
  Hello: 'greeting.hello',
};

/**
 * The Dashboard (spec 08). Sign-in lands here; a role without the Dashboard starts on its own
 * home page instead (teachers on My teaching, front desk on Attendance).
 */
export default async function StaffHome() {
  const session = await requireSignedIn();
  if (session.kind !== 'ready') return null;
  const { me, permissions } = session;
  if (accessOf(permissions.pages, 'dashboard') === 'hidden') {
    if (permissions.home !== 'dashboard') redirect(hrefOf(permissions.home));
    return (
      <NoAccess
        page="dashboard"
        roleName={roleNameOf(me) ?? t('shell.role.support')}
        home={permissions.home}
        hiddenBy={hiddenByOf(permissions.pages, 'dashboard')}
      />
    );
  }
  // The API computes the greeting in the school's time zone (D27 follow-up).
  return (
    <Greeting
      period={me.greeting.period}
      greeting={t(greetingKey[me.greeting.word])}
      firstName={me.person.firstName}
      dateLine={formatDate(new Date(), me.school.timeZone, 'weekday')}
      summary={t('home.staff.summaryPlaceholder')}
    />
  );
}
