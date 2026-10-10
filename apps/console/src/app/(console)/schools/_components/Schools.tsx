'use client';

import { Button, Card, EmptyState, Pill, Table, type TableColumn } from '@quad/ui';
import { PageHead } from '@quad/ui/shell';
import { Building2, Eye } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { OpenAsSchoolAdminDrawer } from '../_drawers/OpenAsSchoolAdminDrawer';

import { SchoolName } from './SchoolName';

import type { PlatformRole, PlatformTenant, TenantStatus } from '@quad/contracts';

import { useSchools } from '@/components/data/use-schools';
import { useConsoleMe } from '@/components/session/ConsoleSession';

/** Spec 05: only these platform roles may open a school as its admin. */
const SUPPORT_ROLES: ReadonlySet<PlatformRole> = new Set(['owner', 'admin', 'support']);

const STATUS_TONE: Readonly<Record<TenantStatus, 'good' | 'info' | 'warn' | 'bad' | 'neutral'>> = {
  active: 'good',
  trial: 'info',
  onboarding: 'info',
  past_due: 'warn',
  suspended: 'bad',
  deleted: 'neutral',
};

/**
 * Console → Schools, minimal in M1 (OQ18): every school with its status, and **Open as school
 * admin** for support, admin and owner (spec 05). The full list (plan, seats, health) is M2.
 */
export function Schools() {
  const { t } = useTranslation();
  const me = useConsoleMe();
  const schools = useSchools();
  const [chosen, setChosen] = useState<PlatformTenant | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const canSupport = SUPPORT_ROLES.has(me.role);
  const rows = schools.data?.pages.flatMap((page) => page.items) ?? [];

  const status = (school: PlatformTenant) => (
    <Pill tone={STATUS_TONE[school.status]}>{t(`console.schools.status.${school.status}`)}</Pill>
  );
  const openAs = (school: PlatformTenant) => {
    const paused = school.status === 'suspended';
    return (
      <Button
        variant="secondary"
        size="sm"
        icon={Eye}
        disabled={paused}
        // 44 px to tap on phones (spec 03).
        className="max-sm:h-11"
        title={paused ? t('console.schools.openAsPaused') : undefined}
        aria-label={t('console.schools.openAsLabel', { school: school.name })}
        onClick={() => {
          setChosen(school);
          setDrawerOpen(true);
        }}
      >
        {t('console.schools.openAs')}
      </Button>
    );
  };

  const columns: TableColumn<PlatformTenant>[] = [
    {
      key: 'name',
      header: t('console.schools.col.school'),
      cell: (school) => <SchoolName school={school} />,
    },
    { key: 'status', header: t('console.schools.col.status'), cell: status, className: 'w-36' },
    ...(canSupport
      ? [
          {
            key: 'support',
            header: t('console.schools.col.actions'),
            cell: openAs,
            align: 'right' as const,
            className: 'w-56',
          },
        ]
      : []),
  ];

  const empty = schools.isError ? (
    <EmptyState
      icon={Building2}
      title={t('console.schools.loadFailed')}
      action={
        <Button
          variant="secondary"
          onClick={() => {
            void schools.refetch();
          }}
        >
          {t('common.tryAgain')}
        </Button>
      }
    />
  ) : (
    <EmptyState
      icon={Building2}
      title={schools.isPending ? t('console.schools.summaryLoading') : t('console.schools.empty')}
    />
  );

  const footer = schools.hasNextPage ? (
    <div className="flex justify-center border-t border-line px-[18px] py-3">
      <Button
        variant="secondary"
        size="sm"
        disabled={schools.isFetchingNextPage}
        onClick={() => {
          void schools.fetchNextPage();
        }}
      >
        {t('console.schools.showMore')}
      </Button>
    </div>
  ) : undefined;

  return (
    <div className="flex flex-col gap-5">
      <PageHead
        crumb={t('console.schools.crumb')}
        title={t('console.schools.title')}
        description={
          schools.data === undefined
            ? t('console.schools.summaryLoading')
            : t('console.schools.summary', { count: rows.length })
        }
      />
      {canSupport ? (
        <p className="m-0 flex items-start gap-2 rounded-xl bg-info-soft px-3.5 py-2.5 text-[13px] text-ink">
          <Eye aria-hidden="true" strokeWidth={2} className="mt-px size-4 shrink-0" />
          {t('console.schools.supportNote')}
        </p>
      ) : null}
      <Card flush>
        <div className="max-md:hidden">
          <Table
            caption={t('console.schools.list')}
            columns={columns}
            rows={rows}
            getRowId={(school) => school.id}
            rowLabel={(school) => school.name}
            empty={empty}
            footer={footer}
          />
        </div>
        <div className="md:hidden">
          {rows.length === 0 ? (
            <div className="px-[18px] py-6">{empty}</div>
          ) : (
            <ul aria-label={t('console.schools.list')} className="m-0 list-none p-0">
              {rows.map((school) => (
                <li
                  key={school.id}
                  className="flex flex-col gap-2.5 border-b border-line px-[18px] py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <SchoolName school={school} />
                    {status(school)}
                  </div>
                  {canSupport ? <div className="flex">{openAs(school)}</div> : null}
                </li>
              ))}
            </ul>
          )}
          {footer}
        </div>
      </Card>
      <OpenAsSchoolAdminDrawer school={chosen} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}
