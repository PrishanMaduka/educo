import { SCHOOL_SETTINGS_TABS } from './_components/school-tabs';
import { SchoolSettings } from './_components/SchoolSettings';

import type { Metadata } from 'next';

import { NoAccess } from '@/components/shell/NoAccess';
import { accessOf, roleNameOf } from '@/components/shell/staff-nav';
import { t } from '@/i18n';
import { requireSignedIn } from '@/lib/server-session';

export const metadata: Metadata = { title: t('nav.staff.page.school_settings') };

interface SchoolSettingsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Settings → School settings (spec 08; `settings.view` to see, `settings.edit` to change). The
 * server checks the page is part of the person's role (or the previewed one) before anything
 * renders; the settings and the log are read in the browser, where a save refreshes them.
 */
export default async function SchoolSettingsPage({ searchParams }: SchoolSettingsPageProps) {
  const session = await requireSignedIn();
  if (session.kind !== 'ready') return null;
  const { me, permissions } = session;
  const access = accessOf(permissions.pages, 'school_settings');
  if (access === 'hidden') {
    return (
      <NoAccess
        page="school_settings"
        roleName={roleNameOf(me) ?? t('shell.role.support')}
        home={permissions.home}
      />
    );
  }
  const query = await searchParams;
  const keys = new Set(permissions.keys);
  return (
    <SchoolSettings
      initialTab={SCHOOL_SETTINGS_TABS.find((tab) => tab === query.tab) ?? 'general'}
      timeZone={me.school.timeZone}
      // A preview refuses every write, so the form stays read-only while one is on.
      canEdit={access === 'full' && keys.has('settings.edit') && me.preview === null}
      canExport={keys.has('sensitive.export_data')}
    />
  );
}
