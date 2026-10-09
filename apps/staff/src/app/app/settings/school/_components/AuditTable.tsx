'use client';

import { Table, formatDate, formatRelative, type TableColumn } from '@quad/ui';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { AuditWho } from './AuditWho';

import type { AuditEntry } from '@quad/contracts';
import type { ReactNode } from 'react';

export interface AuditTableProps {
  entries: readonly AuditEntry[];
  now: Date;
  timeZone: string;
  onOpen: (entry: AuditEntry) => void;
  /** Shown when there are no entries. */
  empty: ReactNode;
  /** Under the list: Show more entries. */
  footer?: ReactNode;
}

/**
 * The audit log (spec 08): when, who and the readable line, newest first. Each line is a button
 * that opens the entry's detail. A table from 768 px up; one card per entry below.
 */
export function AuditTable({ entries, now, timeZone, onOpen, empty, footer }: AuditTableProps) {
  const { t } = useTranslation();

  const when = (entry: AuditEntry) => (
    <time
      dateTime={entry.at}
      title={formatDate(entry.at, timeZone, 'dateTime')}
      className="whitespace-nowrap text-ink-2"
    >
      {formatRelative(entry.at, now, timeZone)}
    </time>
  );
  const what = (entry: AuditEntry) => (
    <button
      type="button"
      aria-label={t('schoolSettings.audit.open', { summary: entry.summary })}
      onClick={() => {
        onOpen(entry);
      }}
      className="inline-flex max-w-full cursor-pointer items-center gap-1 rounded-md text-left font-medium text-ink underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand focus-visible:outline-solid max-sm:min-h-11"
    >
      <span className="min-w-0">{entry.summary}</span>
      <ChevronRight aria-hidden="true" strokeWidth={2} className="size-4 shrink-0 text-ink-3" />
    </button>
  );

  const columns: TableColumn<AuditEntry>[] = [
    { key: 'when', header: t('schoolSettings.audit.col.when'), cell: when, className: 'w-40' },
    {
      key: 'who',
      header: t('schoolSettings.audit.col.who'),
      cell: (entry) => <AuditWho actor={entry.actor} />,
      className: 'w-56',
    },
    { key: 'what', header: t('schoolSettings.audit.col.what'), cell: what },
  ];

  return (
    <>
      <div className="max-md:hidden">
        <Table
          caption={t('schoolSettings.audit.table')}
          columns={columns}
          rows={entries}
          getRowId={(entry) => entry.id}
          rowLabel={(entry) => entry.summary}
          empty={empty}
          footer={footer}
        />
      </div>
      <div className="md:hidden">
        {entries.length === 0 ? (
          <div className="px-[18px] py-6">{empty}</div>
        ) : (
          <ul aria-label={t('schoolSettings.audit.table')} className="m-0 list-none p-0">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-col gap-1.5 border-b border-line px-[18px] py-3"
              >
                {what(entry)}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <AuditWho actor={entry.actor} />
                  {when(entry)}
                </div>
              </li>
            ))}
          </ul>
        )}
        {footer}
      </div>
    </>
  );
}
