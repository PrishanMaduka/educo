'use client';

import { Button, DAY_RANGES, DropdownFilter, type DayRange } from '@quad/ui';
import { Building2, CalendarRange, ListFilter, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PLATFORM_AUDIT_ACTIONS, platformAuditActionOf, platformGroupOf } from './audit-actions';

import type { AuditPerson, PlatformAuditLogAction, PlatformTenant } from '@quad/contracts';

/** What the Audit log is filtered by, as chosen. */
export interface PlatformAuditFilterState {
  readonly actor: string | null;
  readonly tenantId: string | null;
  readonly action: PlatformAuditLogAction | null;
  readonly range: DayRange | null;
}

export const NO_PLATFORM_AUDIT_FILTERS: PlatformAuditFilterState = {
  actor: null,
  tenantId: null,
  action: null,
  range: null,
};

export const isFiltered = (value: PlatformAuditFilterState): boolean =>
  Object.values(value).some((chosen) => chosen !== null);

export interface AuditFiltersProps {
  people: readonly AuditPerson[];
  schools: readonly PlatformTenant[];
  value: PlatformAuditFilterState;
  onChange: (value: PlatformAuditFilterState) => void;
}

/** The Audit log's filters (spec 07): Quad staff member, school, action type and date range. */
export function AuditFilters({ people, schools, value, onChange }: AuditFiltersProps) {
  const { t } = useTranslation();
  const set = (change: Partial<PlatformAuditFilterState>) => {
    onChange({ ...value, ...change });
  };
  return (
    <div
      role="group"
      aria-label={t('console.audit.filters')}
      className="flex flex-wrap items-center gap-2"
    >
      <DropdownFilter
        label={t('console.audit.filter.person')}
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
        label={t('console.audit.filter.school')}
        icon={Building2}
        searchable
        value={value.tenantId}
        options={schools.map((school) => ({ value: school.id, label: school.name }))}
        onChange={(tenantId) => {
          set({ tenantId });
        }}
        onClear={() => {
          set({ tenantId: null });
        }}
      />
      <DropdownFilter
        label={t('console.audit.filter.action')}
        icon={ListFilter}
        searchable
        value={value.action}
        options={PLATFORM_AUDIT_ACTIONS.map((action) => ({
          value: action,
          label: t(`console.audit.action.${action}`),
          group: t(`console.audit.group.${platformGroupOf(action)}`),
        }))}
        onChange={(action) => {
          set({ action: platformAuditActionOf(action) });
        }}
        onClear={() => {
          set({ action: null });
        }}
      />
      <DropdownFilter
        label={t('console.audit.filter.when')}
        icon={CalendarRange}
        value={value.range}
        options={DAY_RANGES.map((range) => ({
          value: range,
          label: t(`console.audit.range.${range}`),
        }))}
        onChange={(range) => {
          set({ range: DAY_RANGES.find((candidate) => candidate === range) ?? null });
        }}
        onClear={() => {
          set({ range: null });
        }}
      />
      {isFiltered(value) ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onChange(NO_PLATFORM_AUDIT_FILTERS);
          }}
        >
          {t('console.audit.clearFilters')}
        </Button>
      ) : null}
    </div>
  );
}
