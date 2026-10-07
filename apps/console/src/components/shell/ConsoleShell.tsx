'use client';

import { AppShell, type ShellNavGroup } from '@quad/ui/shell';
import { Activity, Building2, CreditCard, House, Layers } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';

import type { ReactNode } from 'react';

import { useShellLabels } from '@/i18n';
import { PLACEHOLDER_OWNER } from '@/lib/placeholders';

/** The console's side bar, top bar and search around every page. */
export function ConsoleShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const labels = useShellLabels();
  const pathname = usePathname();
  const router = useRouter();

  const groups: ShellNavGroup[] = [
    {
      id: 'platform',
      label: t('nav.console.group.platform'),
      items: [
        { href: '/', label: t('nav.console.overview'), icon: House, exact: true },
        { href: '/schools', label: t('nav.console.schools'), icon: Building2 },
        { href: '/plans', label: t('nav.console.plans'), icon: Layers },
        { href: '/billing', label: t('nav.console.billing'), icon: CreditCard },
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
      user={{ name: PLACEHOLDER_OWNER.name, role: PLACEHOLDER_OWNER.role }}
      groups={groups}
      currentHref={pathname}
      labels={labels}
      linkComponent={Link}
      onNavigate={(href) => {
        router.push(href);
      }}
    >
      {children}
    </AppShell>
  );
}
