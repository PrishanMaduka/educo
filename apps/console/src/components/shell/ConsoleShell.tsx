'use client';

import { useToast } from '@quad/ui';
import { AppShell, type ShellNavGroup } from '@quad/ui/shell';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Activity, Building2, CreditCard, House, Layers, LogOut, ScrollText } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';

import type { ReactNode } from 'react';

import { useConsoleMe } from '@/components/session/ConsoleSession';
import { useShellLabels } from '@/i18n';
import { ApiError, consoleApi, unwrapEmpty } from '@/lib/api';
import { messageFor } from '@/lib/error-copy';
import { openPage } from '@/lib/navigate';

/**
 * `POST /platform/auth/sign-out`, then the sign-in page as a full load. A 401 means the session
 * had already ended, which is where signing out was going anyway.
 */
function useSignOut() {
  const { t } = useTranslation();
  const toast = useToast();
  const queries = useQueryClient();
  return useMutation({
    mutationFn: () =>
      unwrapEmpty(consoleApi().POST('/api/v1/platform/auth/sign-out', { body: {} })),
    onSettled: (_data, error) => {
      if (error !== null && !(error instanceof ApiError && error.status === 401)) {
        toast.show(
          error instanceof ApiError
            ? messageFor(error, (key) => t(key))
            : t('console.signOut.failed'),
        );
        return;
      }
      queries.clear();
      openPage('/sign-in');
    },
  });
}

/** The console's side bar, top bar and search around every signed-in page, with the real user. */
export function ConsoleShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const labels = useShellLabels('console');
  const pathname = usePathname();
  const router = useRouter();
  const me = useConsoleMe();
  const signOut = useSignOut();
  const leave = () => {
    if (!signOut.isPending) signOut.mutate();
  };

  const groups: ShellNavGroup[] = [
    {
      id: 'platform',
      label: t('nav.console.group.platform'),
      items: [
        { href: '/', label: t('nav.console.overview'), icon: House, exact: true },
        { href: '/schools', label: t('nav.console.schools'), icon: Building2 },
        { href: '/plans', label: t('nav.console.plans'), icon: Layers },
        { href: '/billing', label: t('nav.console.billing'), icon: CreditCard },
        { href: '/audit', label: t('nav.console.audit'), icon: ScrollText },
      ],
    },
    {
      id: 'operations',
      label: t('nav.console.group.operations'),
      items: [{ href: '/system', label: t('nav.console.system'), icon: Activity }],
    },
  ];

  return (
    <AppShell
      variant="console"
      brand={{
        title: t('shell.console.title'),
        subtitle: t('shell.console.subtitle'),
        badge: t('shell.console.badge'),
      }}
      user={{ name: me.name, role: t(`role.platform.${me.role}`) }}
      groups={groups}
      currentHref={pathname}
      labels={labels}
      linkComponent={Link}
      profileMenu={{
        heading: me.name,
        sections: [
          {
            id: 'session',
            items: [{ id: 'sign-out', label: labels.signOut, icon: LogOut, onSelect: leave }],
          },
        ],
      }}
      onSignOut={leave}
      onNavigate={(href) => {
        router.push(href);
      }}
    >
      {children}
    </AppShell>
  );
}
