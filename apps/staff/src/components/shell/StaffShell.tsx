'use client';

import { useToast } from '@quad/ui';
import { AppShell, type ShellNavGroup } from '@quad/ui/shell';
import {
  ArrowLeftRight,
  BookOpen,
  Bus,
  Calculator,
  CalendarCheck,
  CalendarRange,
  CarFront,
  ChartColumn,
  ClipboardList,
  CreditCard,
  FileCheck,
  Funnel,
  GraduationCap,
  HandHeart,
  HeartHandshake,
  House,
  LayoutGrid,
  MessagesSquare,
  Presentation,
  Shield,
  SlidersHorizontal,
  Target,
  TriangleAlert,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { PreviewBanner } from './PreviewBanner';
import { visibleNav } from './staff-nav';
import { SupportBanner } from './SupportBanner';
import { switchSchoolMenu } from './SwitchSchoolMenu';
import { useShellActions } from './use-shell-actions';
import { ViewAsPicker } from './ViewAsPicker';

import type { MessageKey } from '@/i18n';
import type { Me, MeBrand, MePermissions, StaffPageId } from '@quad/contracts';

import { useShellLabels } from '@/i18n/client';
import { portalNoticeFrom, type PortalNotice } from '@/lib/session';

/** Each page's icon (spec 03 side bar icons; lucide stands in for the drawings until D40 lands). */
const ICONS: Record<StaffPageId, LucideIcon> = {
  dashboard: House,
  my_teaching: GraduationCap,
  admissions: Funnel,
  crm: Target,
  communications: MessagesSquare,
  family_connection: HeartHandshake,
  evenings_forms: ClipboardList,
  students: Users,
  early_warning: TriangleAlert,
  attendance: CalendarCheck,
  pastoral: HandHeart,
  courses: BookOpen,
  timetable: LayoutGrid,
  teachers_classes: Presentation,
  staff_cover: ArrowLeftRight,
  exams: FileCheck,
  reports: ChartColumn,
  fees: CreditCard,
  accounting: Calculator,
  routes: Bus,
  pickup: CarFront,
  academic_year: CalendarRange,
  users_roles: Shield,
  school_settings: SlidersHorizontal,
};

/**
 * The school's brand as CSS variables (spec 03 "School brand colour", D32): the API computes
 * the palette; `school-brand.css` maps these onto the token variables, taking `fillDark` in dark
 * mode. Values only ever reach CSS variables, never class names.
 */
export function schoolBrandStyle(brand: MeBrand): CSSProperties {
  return {
    '--school-brand': brand.color,
    '--school-brand-fill': brand.fill,
    '--school-brand-fill-dark': brand.fillDark,
    '--school-brand-ink': brand.ink,
  };
}

/** The sentence for each portal notice: fixed copy, never text from the address. */
const NOTICE_COPY: Record<PortalNotice, MessageKey> = {
  preview_failed: 'shell.notice.previewFailed',
};

/**
 * The fixed notice a reload asked for (`?notice=`, `portalNoticeFrom`), shown once as a toast;
 * the flag then leaves the address, so a refresh does not repeat it.
 */
function usePortalNotice() {
  const { t } = useTranslation();
  const toast = useToast();
  useEffect(() => {
    const url = new URL(window.location.href);
    const notice = portalNoticeFrom(url.searchParams.get('notice'));
    if (notice === null) return;
    url.searchParams.delete('notice');
    window.history.replaceState(
      window.history.state,
      '',
      `${url.pathname}${url.search}${url.hash}`,
    );
    toast.show(t(NOTICE_COPY[notice]));
    // Once per page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** Puts the brand on <html> too, so menus and toasts in portals (outside the shell) share it. */
function useBrandOnRoot(brand: MeBrand) {
  useEffect(() => {
    const root = document.documentElement;
    const style = schoolBrandStyle(brand);
    root.setAttribute('data-school-brand', '');
    for (const [name, value] of Object.entries(style)) root.style.setProperty(name, String(value));
    return () => {
      root.removeAttribute('data-school-brand');
      for (const name of Object.keys(style)) root.style.removeProperty(name);
    };
  }, [brand]);
}

export interface StaffShellProps {
  me: Me;
  permissions: MePermissions;
  children: ReactNode;
}

/**
 * The staff portal's side bar, top bar, banners and profile menu around every /app page (spec 08),
 * from `GET /me` and `GET /me/permissions`: the school's name and brand, the pages the person's
 * role (or the previewed role) opens, the support and preview banners, View as, Switch school
 * and Sign out.
 */
export function StaffShell({ me, permissions, children }: StaffShellProps) {
  const { t } = useTranslation();
  const labels = useShellLabels('staff');
  const pathname = usePathname();
  const router = useRouter();
  const actions = useShellActions();
  useBrandOnRoot(me.school.brand);
  usePortalNotice();

  const groups: ShellNavGroup[] = visibleNav(permissions.pages).map(({ group, pages }) => ({
    id: group,
    label: t(`nav.staff.group.${group}`),
    items: pages.map((page) => ({
      href: page.href,
      label: t(`nav.staff.page.${page.id}`),
      icon: ICONS[page.id],
      exact: page.exact,
    })),
  }));
  const role = me.support !== null ? t('shell.role.support') : (me.person.roleNames[0] ?? '');
  const busy =
    actions.signOut.isPending ||
    actions.switchSchool.isPending ||
    actions.backToMyView.isPending ||
    actions.startPreview.isPending;
  const canPreview =
    me.support === null && (me.preview !== null || permissions.keys.includes('users.manage'));

  const banner =
    me.support !== null ? (
      <SupportBanner
        support={me.support}
        exiting={actions.exitSupport.isPending}
        onExit={() => {
          actions.exitSupport.mutate();
        }}
      />
    ) : me.preview !== null ? (
      <PreviewBanner
        preview={me.preview}
        leaving={actions.backToMyView.isPending}
        onBack={() => {
          actions.backToMyView.mutate();
        }}
      />
    ) : null;

  const profileMenu = switchSchoolMenu(
    me,
    {
      backToMyView: () => {
        actions.backToMyView.mutate();
      },
      switchSchool: (tenantId) => {
        actions.switchSchool.mutate(tenantId);
      },
      signOut: () => {
        actions.signOut.mutate();
      },
    },
    (key, values) => t(key, values),
  );

  return (
    <div data-school-brand="" style={schoolBrandStyle(me.school.brand)}>
      <AppShell
        variant="staff"
        brand={{
          title: me.school.name,
          subtitle: t('shell.staff.subtitle'),
          initials: me.school.shortName,
        }}
        user={{ name: me.person.name, role }}
        groups={groups}
        currentHref={pathname}
        labels={labels}
        linkComponent={Link}
        onNavigate={(href) => {
          router.push(href);
        }}
        banner={banner}
        actions={
          canPreview ? (
            <ViewAsPicker
              preview={me.preview}
              busy={busy}
              onChoose={(choice) => {
                actions.startPreview.mutate(choice);
              }}
              onBack={() => {
                actions.backToMyView.mutate();
              }}
            />
          ) : undefined
        }
        profileMenu={profileMenu}
        onSignOut={() => {
          actions.signOut.mutate();
        }}
      >
        {children}
      </AppShell>
    </div>
  );
}
