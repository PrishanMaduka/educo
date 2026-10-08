import { NotFoundPage } from '@quad/ui/shell';
import Link from 'next/link';

import { t } from '@/i18n';
import { publicEnv } from '@/lib/public-env';

export default function NotFound() {
  return (
    <NotFoundPage
      title={t('notFound.title')}
      body={t('notFound.body')}
      actionLabel={t('notFound.action')}
      // The pre-launch site has only the public pages, so Home is the landing page.
      homeHref={publicEnv.NEXT_PUBLIC_QUAD_PRELAUNCH ? '/' : '/app'}
      linkComponent={Link}
    />
  );
}
