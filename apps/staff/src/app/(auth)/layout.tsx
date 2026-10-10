import { AuthArt, AuthLayout } from '@quad/ui/auth';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Providers } from '@/components/Providers';
import { t } from '@/i18n';

export const metadata: Metadata = { title: t('signIn.title') };

const STATS = [
  { value: t('signIn.art.statOneValue'), label: t('signIn.art.statOne') },
  { value: t('signIn.art.statTwoValue'), label: t('signIn.art.statTwo') },
  { value: t('signIn.art.statThreeValue'), label: t('signIn.art.statThree') },
];

/**
 * The sign-in pages: `/sign-in` and the signed-link pages (spec 05). Quad-branded, since the
 * school is not known yet. Providers live here, not in the root layout, which the pre-launch
 * export shares (D30, D32).
 */
export default function AuthPagesLayout({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <AuthLayout
        art={
          <AuthArt
            titleStart={t('signIn.art.titleStart')}
            titleHighlight={t('signIn.art.titleHighlight')}
            body={t('signIn.art.body')}
            stats={STATS}
          />
        }
        foot={t('signIn.foot')}
      >
        {children}
      </AuthLayout>
    </Providers>
  );
}
