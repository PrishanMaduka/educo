import { AuthArt, AuthLayout } from '@quad/ui/auth';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { t } from '@/i18n';

export const metadata: Metadata = { title: t('console.signIn.pageTitle') };

/** The console's sign-in page (spec 05; the prototype's `platformAuth`), Quad-branded. */
export default function SignInLayout({ children }: { children: ReactNode }) {
  return (
    <AuthLayout
      art={
        <AuthArt
          product={t('console.signIn.art.product')}
          titleStart={t('console.signIn.art.titleStart')}
          titleHighlight={t('console.signIn.art.titleHighlight')}
          body={t('console.signIn.art.body')}
        />
      }
      foot={t('console.signIn.foot')}
    >
      {children}
    </AuthLayout>
  );
}
