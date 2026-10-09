'use client';

import { Button, DropdownFilter } from '@quad/ui';
import { CalendarRange, ListFilter, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { AUDIT_ACTIONS, auditActionOf, groupOf } from './audit-actions';
import { AUDIT_RANGES, type AuditRange } from './audit-range';

import type { AuditAction, AuditPerson } from '@quad/contracts';

/** What the Audit tab is filtered by, as chosen. */
export interface AuditFilterState {
  readonly actor: string | null;
  readonly action: AuditAction | null;
  readonly range: AuditRange | null;
}

export const NO_AUDIT_FILTERS: AuditFilterState = { actor: null, action: null, range: null };

export interface AuditFiltersProps {
  people: readonly AuditPerson[];
  value: AuditFilterState;
  onChange: (value: AuditFilterState) => void;
}

/** The Audit tab's filters (spec 08): person, action type and date range. */
export function AuditFilters({ people, value, onChange }: AuditFiltersProps) {
  const { t } = useTranslation();
  const set = (change: Partial<AuditFilterState>) => {
    onChange({ ...value, ...change });
  };
  const any = value.actor !== null || value.action !== null || value.range !== null;
  return (
    <div
      role="group"
      aria-label={t('schoolSettings.audit.filters')}
      className="flex flex-wrap items-center gap-2"
    >
      <DropdownFilter
        label={t('schoolSettings.audit.filter.person')}
        icon={UserRound}
        searchable
        value={value.actor}
        options={people.map((person) => ({ value: person.id, label: person.name }))}
        onChange={(actor) => {
          set({ actor });
        }}
        onClear={() => {
          set({ actor: null });
        }}
      />
      <DropdownFilter
        label={t('schoolSettings.audit.filter.action')}
        icon={ListFilter}
        value={value.action}
        options={AUDIT_ACTIONS.map((action) => ({
          value: action,
          label: t(`schoolSettings.audit.action.${action}`),
          group: t(`schoolSettings.audit.group.${groupOf(action)}`),
        }))}
        onChange={(action) => {
          set({ action: auditActionOf(action) });
        }}
        onClear={() => {
          set({ action: null });
        }}
      />
      <DropdownFilter
        label={t('schoolSettings.audit.filter.when')}
        icon={CalendarRange}
        value={value.range}
        options={AUDIT_RANGES.map((range) => ({
          value: range,
          label: t(`schoolSettings.audit.range.${range}`),
        }))}
        onChange={(range) => {
          set({ range: AUDIT_RANGES.find((candidate) => candidate === range) ?? null });
        }}
        onClear={() => {
          set({ range: null });
        }}
      />
      {any ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onChange(NO_AUDIT_FILTERS);
          }}
        >
          {t('schoolSettings.audit.clearFilters')}
        </Button>
      ) : null}
    </div>
  );
}
