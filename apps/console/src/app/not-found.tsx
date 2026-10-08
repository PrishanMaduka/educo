import { NotFoundPage } from '@quad/ui/shell';
import Link from 'next/link';

import { t } from '@/i18n';

export default function NotFound() {
  return (
    <NotFoundPage
      title={t('notFound.title')}
      body={t('notFound.body')}
      actionLabel={t('notFound.action')}
      homeHref="/"
      linkComponent={Link}
    />
  );
}
