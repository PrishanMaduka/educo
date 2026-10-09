import { InviteFlow } from './_components/InviteFlow';

import type { Metadata } from 'next';

import { t } from '@/i18n';

export const metadata: Metadata = { title: t('invite.loading') };

/**
 * `/sign-in/invite/{token}`: a staff invitation (spec 05 Account edge cases; OQ9). The school
 * comes only from the verified token, through the API.
 */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <InviteFlow token={token} />;
}
