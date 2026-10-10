'use client';

import { AuditLogTable, Button, Card, EmptyState, dayRangeFrom, useToast } from '@quad/ui';
import { PageHead } from '@quad/ui/shell';
import { Download, ScrollText } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AuditDetailDrawer } from './AuditDetailDrawer';
import {
  AuditFilters,
  NO_PLATFORM_AUDIT_FILTERS,
  isFiltered,
  type PlatformAuditFilterState,
} from './AuditFilters';
import { AuditWho } from './AuditWho';
import {
  useExportPlatformAudit,
  usePlatformAuditLog,
  usePlatformAuditPeople,
  type PlatformAuditQuery,
} from './use-audit';

import type { PlatformAuditEntry } from '@quad/contracts';

import { useSchools } from '@/components/data/use-schools';
import { ApiError } from '@/lib/api';
import { messageFor } from '@/lib/error-copy';

/** Quad staff read times in their own zone: the console has no school's zone. */
const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * Console → Audit log (spec 07): everything Quad staff do, across every school, filtered by
 * Quad staff member, school, action and date range; each entry opens in a drawer; Export CSV of
 * the filtered entries (any console role, recorded by the API).
 */
export function AuditLog() {
  const { t } = useTranslation();
  const toast = useToast();
  const [timeZone] = useState(browserTimeZone);
  const [filters, setFiltersState] = useState<PlatformAuditFilterState>(NO_PLATFORM_AUDIT_FILTERS);
  // The When filter's start, fixed when it was chosen, so the query key stays the same.
  const [from, setFrom] = useState<string | null>(null);
  const [opened, setOpened] = useState<PlatformAuditEntry | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const setFilters = (next: PlatformAuditFilterState) => {
    setFiltersState(next);
    setFrom(next.range === null ? null : dayRangeFrom(next.range, new Date(), timeZone));
  };
  const query: PlatformAuditQuery = {
    actor: filters.actor,
    tenantId: filters.tenantId,
    action: filters.action,
    from,
  };
  const log = usePlatformAuditLog(query);
  const people = usePlatformAuditPeople();
  const schools = useSchools();
  const exporting = useExportPlatformAudit();
  // "Now" for the relative times is when the log was last read, so a refresh moves it on.
  const now = new Date(log.dataUpdatedAt);
  const entries = log.data?.pages.flatMap((page) => page.items) ?? [];
  const filtered = isFiltered(filters);

  const empty = log.isError ? (
    <EmptyState
      icon={ScrollText}
      title={t('console.audit.loadFailed')}
      action={
        <Button
          variant="secondary"
          onClick={() => {
            void log.refetch();
          }}
        >
          {t('common.tryAgain')}
        </Button>
      }
    />
  ) : log.isPending ? (
    <EmptyState icon={ScrollText} title={t('console.audit.loading')} />
  ) : (
    <EmptyState
      icon={ScrollText}
      title={filtered ? t('console.audit.emptyFiltered') : t('console.audit.empty')}
      action={
        filtered ? (
          <Button
            variant="secondary"
            onClick={() => {
              setFilters(NO_PLATFORM_AUDIT_FILTERS);
            }}
          >
            {t('console.audit.clearFilters')}
          </Button>
        ) : undefined
      }
    />
  );

  const footer = log.hasNextPage ? (
    <div className="flex justify-center border-t border-line px-[18px] py-3">
      <Button
        variant="secondary"
        size="sm"
        disabled={log.isFetchingNextPage}
        onClick={() => {
          void log.fetchNextPage();
        }}
      >
        {t('console.audit.showMore')}
      </Button>
    </div>
  ) : undefined;

  const exportCsv = () => {
    exporting.mutate(query, {
      onError: (error) => {
        // A refused export's own sentence (too many entries) is written for the person.
        toast.show(
          error instanceof ApiError && error.status === 422 && error.message !== ''
            ? error.message
            : messageFor(error, (key) => t(key)),
        );
      },
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHead
        crumb={t('console.audit.crumb')}
        title={t('console.audit.title')}
        description={t('console.audit.summary')}
        actions={
          <Button
            variant="secondary"
            icon={Download}
            disabled={exporting.isPending}
            onClick={exportCsv}
          >
            {t('console.audit.export')}
          </Button>
        }
      />
      <AuditFilters
        people={people.data?.items ?? []}
        schools={schools.data?.pages.flatMap((page) => page.items) ?? []}
        value={filters}
        onChange={setFilters}
      />
      <Card flush>
        <AuditLogTable
          entries={entries}
          now={now}
          timeZone={timeZone}
          onOpen={(entry) => {
            setOpened(entry);
            setDrawerOpen(true);
          }}
          who={(entry) => <AuditWho actor={entry.actor} />}
          extraColumns={[
            {
              key: 'school',
              header: t('console.audit.col.school'),
              cell: (entry) => (
                <span className={entry.school === null ? 'text-ink-2' : 'text-ink'}>
                  {entry.school?.name ?? t('console.audit.noSchool')}
                </span>
              ),
              className: 'w-56',
            },
          ]}
          labels={{
            caption: t('console.audit.table'),
            when: t('console.audit.col.when'),
            who: t('console.audit.col.who'),
            what: t('console.audit.col.what'),
            open: (summary) => t('console.audit.open', { summary }),
          }}
          empty={empty}
          footer={footer}
        />
      </Card>
      <AuditDetailDrawer
        entry={opened}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        timeZone={timeZone}
      />
    </div>
  );
}
