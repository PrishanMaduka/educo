import { ResetPassword } from './_components/ResetPassword';

import type { Metadata } from 'next';

import { t } from '@/i18n';

export const metadata: Metadata = { title: t('reset.title') };

/**
 * `/sign-in/reset/{token}`: the link in the reset email. The token stays in the path (D32), which
 * the middleware keeps out of Referer headers and search indexes.
 */
export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ResetPassword token={token} />;
}
