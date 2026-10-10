'use client';

import { Button, Card, EmptyState, useToast } from '@quad/ui';
import { Download, ScrollText } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { auditRangeFrom } from './audit-range';
import { AuditDetailDrawer } from './AuditDetailDrawer';
import { AuditFilters, NO_AUDIT_FILTERS, type AuditFilterState } from './AuditFilters';
import { AuditTable } from './AuditTable';
import { useAuditLog, useAuditPeople, useExportAudit, type AuditQuery } from './use-school-data';

import type { AuditEntry } from '@quad/contracts';

import { actionMessageFor } from '@/lib/error-copy';

/** What the Audit tab shows: the filters as chosen, and the range's start worked out then. */
export interface AuditView {
  readonly filters: AuditFilterState;
  /** The When filter's start, a UTC instant fixed when it was chosen; null for any time. */
  readonly from: string | null;
}

export const ALL_AUDIT: AuditView = { filters: NO_AUDIT_FILTERS, from: null };

export interface AuditTabProps {
  /** Kept by the page, so leaving the tab and coming back keeps the filters. */
  view: AuditView;
  onViewChange: (view: AuditView) => void;
  timeZone: string;
  /** `sensitive.export_data`: Export CSV is offered (the API refuses it otherwise). */
  canExport: boolean;
}

/**
 * School settings → Audit (spec 08): who did what and when, filtered by person, action and date
 * range, each entry opening in a drawer, and Export CSV for those with `sensitive.export_data`.
 */
export function AuditTab({ view, onViewChange, timeZone, canExport }: AuditTabProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [opened, setOpened] = useState<AuditEntry | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { filters } = view;
  const setFilters = (next: AuditFilterState) => {
    onViewChange({
      filters: next,
      from: next.range === null ? null : auditRangeFrom(next.range, new Date(), timeZone),
    });
  };
  const query: AuditQuery = { actor: filters.actor, action: filters.action, from: view.from };
  const log = useAuditLog(query);
  const people = useAuditPeople();
  // "Now" for the relative times is when the log was last read, so a refresh moves it on.
  const now = new Date(log.dataUpdatedAt);
  const exporting = useExportAudit();
  const entries = log.data?.pages.flatMap((page) => page.items) ?? [];
  const filtered = filters.actor !== null || filters.action !== null || filters.range !== null;

  const empty = log.isError ? (
    <EmptyState
      icon={ScrollText}
      title={t('schoolSettings.audit.loadFailed')}
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
    <EmptyState icon={ScrollText} title={t('schoolSettings.loading')} />
  ) : (
    <EmptyState
      icon={ScrollText}
      title={filtered ? t('schoolSettings.audit.emptyFiltered') : t('schoolSettings.audit.empty')}
      action={
        filtered ? (
          <Button
            variant="secondary"
            onClick={() => {
              setFilters(NO_AUDIT_FILTERS);
            }}
          >
            {t('schoolSettings.audit.clearFilters')}
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
        {t('schoolSettings.audit.showMore')}
      </Button>
    </div>
  ) : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AuditFilters people={people.data?.items ?? []} value={filters} onChange={setFilters} />
        {canExport ? (
          <Button
            variant="secondary"
            icon={Download}
            disabled={exporting.isPending}
            onClick={() => {
              exporting.mutate(query, {
                onError: (error) => {
                  toast.show(actionMessageFor(error, (key) => t(key)));
                },
              });
            }}
          >
            {t('schoolSettings.audit.export')}
          </Button>
        ) : null}
      </div>
      <Card title={t('schoolSettings.audit.title')} flush>
        <AuditTable
          entries={entries}
          now={now}
          timeZone={timeZone}
          empty={empty}
          footer={footer}
          onOpen={(entry) => {
            setOpened(entry);
            setDrawerOpen(true);
          }}
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
