'use client';

import { Button, EmptyState } from '@quad/ui';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert } from 'lucide-react';
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { PlatformMe } from '@quad/contracts';

import { ApiError, consoleApi, unwrap } from '@/lib/api';
import { replacePage } from '@/lib/navigate';
import { signInPathFor } from '@/lib/session';

/** `GET /platform/me`'s query key; sign-out clears it. */
export const ME_KEY = ['platform', 'me'] as const;

const MeContext = createContext<PlatformMe | null>(null);

/** The signed-in Quad staff member (inside `ConsoleSession` only). */
export function useConsoleMe(): PlatformMe {
  const me = useContext(MeContext);
  if (me === null) throw new Error('useConsoleMe needs ConsoleSession around it.');
  return me;
}

const isSignedOut = (error: unknown) => error instanceof ApiError && error.status === 401;

/**
 * The gate round every signed-in console page (D32, D50). The console cookies are
 * `SameSite=Strict`, so the first request of a link from another site arrives without them: the
 * server never decides, and the page asks `GET /platform/me` once it has loaded. A 401 goes to
 * `/sign-in?next=<this page>`; until the answer, nothing of the page shows.
 */
export function ConsoleSession({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const me = useQuery({
    queryKey: ME_KEY,
    queryFn: () => unwrap(consoleApi().GET('/api/v1/platform/me')),
    retry: (count, error) => !isSignedOut(error) && count < 2,
    staleTime: 60_000,
  });
  const signedOut = me.isError && isSignedOut(me.error);

  useEffect(() => {
    if (signedOut) replacePage(signInPathFor(window.location.pathname, window.location.search));
  }, [signedOut]);

  if (me.data !== undefined) {
    return <MeContext.Provider value={me.data}>{children}</MeContext.Provider>;
  }
  if (me.isError && !signedOut) {
    return (
      <main className="grid min-h-dvh place-items-center bg-canvas px-4">
        <EmptyState
          icon={ShieldAlert}
          title={t('console.session.failed')}
          action={
            <Button
              variant="secondary"
              onClick={() => {
                void me.refetch();
              }}
            >
              {t('common.tryAgain')}
            </Button>
          }
        />
      </main>
    );
  }
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4">
      <p role="status" className="m-0 text-[13.5px] text-ink-2">
        {t('console.session.checking')}
      </p>
    </main>
  );
}
