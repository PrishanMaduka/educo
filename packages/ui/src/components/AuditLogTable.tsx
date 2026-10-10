'use client';

import { ChevronRight } from 'lucide-react';

import { formatDate } from '../format/date';
import { formatRelative } from '../format/relative';
import { cn } from '../lib/cn';
import { focusRing } from '../lib/motion';

import { Table, type TableColumn } from './Table';

import type { ReactNode } from 'react';

/** What every audit entry has: an id, its instant and its readable line. */
export interface AuditLogRow {
  readonly id: string;
  readonly at: string;
  readonly summary: string;
}

export interface AuditLogTableLabels {
  /** Names the list for screen readers ("Audit log entries"). */
  caption: string;
  when: string;
  who: string;
  what: string;
  /** The line's button name: "Open the details of {summary}". */
  open: (summary: string) => string;
}

export interface AuditLogTableProps<T extends AuditLogRow> {
  entries: readonly T[];
  /** "Now" for the relative times (when the log was read), never the clock. */
  now: Date;
  timeZone: string;
  onOpen: (entry: T) => void;
  /** Who did it: a person, a support pill or the system. */
  who: (entry: T) => ReactNode;
  /** Columns after What (the console's School); on phones they join the line under What. */
  extraColumns?: readonly TableColumn<T>[];
  labels: AuditLogTableLabels;
  /** Shown when there are no entries. */
  empty: ReactNode;
  /** Under the list: Show more entries. */
  footer?: ReactNode;
}

/**
 * An audit log (spec 07 and 08): when, who and the readable line, newest first. Each line is a
 * button that opens the entry's detail. A table from 768 px up; one card per entry below. Shared
 * by the school's Audit tab and the console's Audit log (D50).
 */
export function AuditLogTable<T extends AuditLogRow>({
  entries,
  now,
  timeZone,
  onOpen,
  who,
  extraColumns = [],
  labels,
  empty,
  footer,
}: AuditLogTableProps<T>) {
  const when = (entry: T) => (
    <time
      dateTime={entry.at}
      title={formatDate(entry.at, timeZone, 'dateTime')}
      className="whitespace-nowrap text-ink-2"
    >
      {formatRelative(entry.at, now, timeZone)}
    </time>
  );
  const what = (entry: T) => (
    <button
      type="button"
      aria-label={labels.open(entry.summary)}
      onClick={() => {
        onOpen(entry);
      }}
      className={cn(
        'inline-flex max-w-full cursor-pointer items-center gap-1 rounded-md text-left font-medium text-ink underline-offset-2 hover:underline max-sm:min-h-11',
        focusRing,
      )}
    >
      <span className="min-w-0">{entry.summary}</span>
      <ChevronRight aria-hidden="true" strokeWidth={2} className="size-4 shrink-0 text-ink-3" />
    </button>
  );

  const columns: TableColumn<T>[] = [
    { key: 'when', header: labels.when, cell: when, className: 'w-40' },
    { key: 'who', header: labels.who, cell: who, className: 'w-56' },
    { key: 'what', header: labels.what, cell: what },
    ...extraColumns,
  ];

  return (
    <>
      <div className="max-md:hidden">
        <Table
          caption={labels.caption}
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
          <ul aria-label={labels.caption} className="m-0 list-none p-0">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-col gap-1.5 border-b border-line px-[18px] py-3"
              >
                {what(entry)}
                {extraColumns.map((column) => (
                  <div key={column.key} className="text-xs text-ink-2">
                    {column.cell?.(entry)}
                  </div>
                ))}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  {who(entry)}
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
