import { SupportRedeem } from './_components/SupportRedeem';

import type { Metadata } from 'next';

import { t } from '@/i18n';

export const metadata: Metadata = { title: t('support.opening.title') };

/** `/sign-in/support/{token}`: the console's single-use link into a school (spec 05 Support access). */
export default async function SupportSessionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <SupportRedeem token={token} />;
}
