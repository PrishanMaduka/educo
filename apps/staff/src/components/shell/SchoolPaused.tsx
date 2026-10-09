'use client';

import { Button } from '@quad/ui';
import { LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useShellActions } from './use-shell-actions';

/**
 * A paused school (spec 05 Plan and module guard: 403 `school_suspended`): the reason the API
 * gives instead of the portal, and Sign out, which still works.
 */
export function SchoolPaused({ reason }: { reason: string }) {
  const { t } = useTranslation();
  const { signOut } = useShellActions();
  return (
    <main id="main" className="grid min-h-dvh place-items-center p-4">
      <section className="flex w-full max-w-[480px] flex-col items-center gap-3 rounded-card border border-line bg-surface px-6 py-10 text-center shadow-card">
        <h1 className="m-0 text-[26px] leading-[1.2] font-extrabold tracking-[-0.02em] text-balance text-ink">
          {t('shell.paused.title')}
        </h1>
        <p className="m-0 text-[15px] text-ink-2">{reason}</p>
        <Button
          icon={LogOut}
          variant="secondary"
          className="mt-2 rounded-full"
          disabled={signOut.isPending}
          onClick={() => {
            signOut.mutate();
          }}
        >
          {t('auth.signOut')}
        </Button>
      </section>
    </main>
  );
}
