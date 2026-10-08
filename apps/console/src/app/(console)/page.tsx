import { PageHead } from '@quad/ui/shell';

import type { Metadata } from 'next';

import { t } from '@/i18n';

export const metadata: Metadata = { title: t('home.console.title') };

/** Platform overview placeholder. Schools, revenue and early warning arrive with M1b and later milestones. */
export default function ConsoleOverview() {
  return (
    <PageHead
      crumb={t('home.console.crumb')}
      title={t('home.console.title')}
      description={t('home.console.summaryPlaceholder')}
    />
  );
}
