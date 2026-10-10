'use client';

import { AuditLogTable } from '@quad/ui';
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

/** The school's audit log (spec 08) in the shared `AuditLogTable`: when, who and the line. */
export function AuditTable({ entries, now, timeZone, onOpen, empty, footer }: AuditTableProps) {
  const { t } = useTranslation();
  return (
    <AuditLogTable
      entries={entries}
      now={now}
      timeZone={timeZone}
      onOpen={onOpen}
      who={(entry) => <AuditWho actor={entry.actor} />}
      labels={{
        caption: t('schoolSettings.audit.table'),
        when: t('schoolSettings.audit.col.when'),
        who: t('schoolSettings.audit.col.who'),
        what: t('schoolSettings.audit.col.what'),
        open: (summary) => t('schoolSettings.audit.open', { summary }),
      }}
      empty={empty}
      footer={footer}
    />
  );
}
