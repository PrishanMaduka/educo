'use client';

import { AppShell, type ShellNavGroup } from '@quad/ui/shell';
import {
  CalendarCheck,
  GraduationCap,
  House,
  MessageSquare,
  Settings,
  Users,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';

import type { ReactNode } from 'react';

import { useShellLabels } from '@/i18n';
import { PLACEHOLDER_SCHOOL, PLACEHOLDER_USER } from '@/lib/placeholders';

/** The staff portal's side bar, top bar and search around every /app page. */
export function StaffShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const labels = useShellLabels('staff');
  const pathname = usePathname();
  const router = useRouter();

  // TODO(M1): hide items for modules outside the school's plan and the person's permissions.
  const groups: ShellNavGroup[] = [
    {
      id: 'overview',
      label: t('nav.staff.group.overview'),
      items: [{ href: '/app', label: t('nav.staff.home'), icon: House, exact: true }],
    },
    {
      id: 'students',
      label: t('nav.staff.group.students'),
      items: [
        { href: '/app/students', label: t('nav.staff.students'), icon: Users },
        { href: '/app/attendance', label: t('nav.staff.attendance'), icon: CalendarCheck },
      ],
    },
    {
      id: 'learning',
      label: t('nav.staff.group.learning'),
      items: [{ href: '/app/teaching', label: t('nav.staff.teaching'), icon: GraduationCap }],
    },
    {
      id: 'relationships',
      label: t('nav.staff.group.relationships'),
      items: [{ href: '/app/messages', label: t('nav.staff.messages'), icon: MessageSquare }],
    },
    {
      id: 'finance',
      label: t('nav.staff.group.finance'),
      items: [{ href: '/app/fees', label: t('nav.staff.fees'), icon: Wallet }],
    },
    {
      id: 'settings',
      label: t('nav.staff.group.settings'),
      items: [{ href: '/app/settings', label: t('nav.staff.settings'), icon: Settings }],
    },
  ];

  return (
    <AppShell
      variant="staff"
      brand={{ title: PLACEHOLDER_SCHOOL.name, subtitle: t('shell.staff.subtitle') }}
      user={{ name: PLACEHOLDER_USER.name, role: PLACEHOLDER_USER.role }}
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
