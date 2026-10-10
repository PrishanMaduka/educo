import { AuditLog } from './_components/AuditLog';

import type { Metadata } from 'next';

import { t } from '@/i18n';

export const metadata: Metadata = { title: t('console.audit.title') };

/** Console → Audit log (spec 07). */
export default function AuditPage() {
  return <AuditLog />;
}
