import { Schools } from './_components/Schools';

import type { Metadata } from 'next';

import { t } from '@/i18n';

export const metadata: Metadata = { title: t('console.schools.title') };

/** Console → Schools (spec 07; minimal in M1, OQ18): the list and Open as school admin. */
export default function SchoolsPage() {
  return <Schools />;
}
