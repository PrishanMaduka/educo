import { AuthArt } from './_components/AuthArt';
import { AuthProviders } from './_components/AuthProviders';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { t } from '@/i18n';

export const metadata: Metadata = { title: t('signIn.title') };

/**
 * The sign-in pages: `/sign-in` and the signed-link pages (spec 05). Quad-branded, since the
 * school is not known yet. Providers live here, not in the root layout, which the pre-launch
 * export shares (D30, D32).
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProviders>
      <div className="grid min-h-dvh grid-cols-[minmax(0,1.15fr)_minmax(360px,1fr)] bg-surface max-[860px]:grid-cols-1 max-[860px]:grid-rows-[auto_1fr]">
        <AuthArt />
        <main className="flex min-w-0 flex-col items-center justify-center gap-[22px] bg-canvas px-6 py-10 max-[860px]:justify-start max-[860px]:px-4 max-[860px]:pt-7">
          {children}
          <p className="m-0 text-center text-xs text-ink-2">{t('signIn.foot')}</p>
        </main>
      </div>
    </AuthProviders>
  );
}
