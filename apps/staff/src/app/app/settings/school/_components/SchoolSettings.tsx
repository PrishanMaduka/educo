'use client';

import { Button, Card, EmptyState, Tabs, useToast } from '@quad/ui';
import { PageHead } from '@quad/ui/shell';
import { Mail, MessageSquareText, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ALL_AUDIT, AuditTab, type AuditView } from './AuditTab';
import { GeneralForm } from './GeneralForm';
import { SCHOOL_SETTINGS_TABS, schoolSettingsHref, type SchoolSettingsTab } from './school-tabs';
import { summarySentence } from './settings-summary';
import { SignInRules } from './SignInRules';
import { useSchool } from './use-school-data';

import type { SettingsSummaryNeed } from '@quad/contracts';
import type { ReactNode } from 'react';

export interface SchoolSettingsProps {
  initialTab: SchoolSettingsTab;
  timeZone: string;
  /** `settings.edit`, and no preview or support visit restrictions the API would refuse. */
  canEdit: boolean;
  /** `sensitive.export_data`: Export CSV is offered. */
  canExport: boolean;
}

/** The id of the office email field, which the "Add an office email" action focuses. */
const OFFICE_EMAIL_ID = 'school-office-email';

/**
 * Settings → School settings (spec 08): the summary line from the API, what needs doing, then
 * General, Sign-in and Audit. Other tabs join with their milestones (OQ19).
 */
export function SchoolSettings({ initialTab, timeZone, canEdit, canExport }: SchoolSettingsProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [tab, setTab] = useState<SchoolSettingsTab>(initialTab);
  // Kept here, so they outlive their tab: Radix unmounts the panels that are not shown.
  const [generalDirty, setGeneralDirty] = useState(false);
  const [audit, setAudit] = useState<AuditView>(ALL_AUDIT);
  const school = useSchool();

  const show = (next: SchoolSettingsTab) => {
    setTab(next);
    window.history.replaceState(window.history.state, '', schoolSettingsHref(next));
  };

  const summary = school.data?.summary;
  const needs = summary?.needs ?? [];

  const needText = (
    need: SettingsSummaryNeed,
  ): { icon: typeof Mail; text: string; action?: ReactNode } => {
    switch (need.code) {
      case 'add_office_email':
        return {
          icon: Mail,
          text: t('schoolSettings.need.addOfficeEmail'),
          action: canEdit ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                show('general');
                window.setTimeout(() => document.getElementById(OFFICE_EMAIL_ID)?.focus(), 0);
              }}
            >
              {t('schoolSettings.need.addOfficeEmailAction')}
            </Button>
          ) : undefined,
        };
      case 'sms_sender_pending':
        return {
          icon: MessageSquareText,
          text: t('schoolSettings.need.smsSenderPending', { senderId: need.senderId }),
        };
    }
  };

  const unavailable = (
    <Card>
      <EmptyState
        icon={SlidersHorizontal}
        title={school.isError ? t('schoolSettings.loadFailed') : t('schoolSettings.loading')}
        action={
          school.isError ? (
            <Button
              variant="secondary"
              onClick={() => {
                void school.refetch();
              }}
            >
              {t('common.tryAgain')}
            </Button>
          ) : undefined
        }
      />
    </Card>
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHead
        crumb={t('nav.staff.group.settings')}
        title={t('nav.staff.page.school_settings')}
        description={
          <span aria-live="polite">
            {summary === undefined ? undefined : summarySentence(summary.parts, t)}
          </span>
        }
      />
      {needs.length > 0 ? (
        <Card title={t('schoolSettings.needs.title')} flush>
          <ul className="m-0 list-none p-0">
            {needs.map((need) => {
              const { icon: Icon, text, action } = needText(need);
              return (
                <li
                  key={need.code}
                  className="flex flex-wrap items-center gap-3 border-b border-line px-[18px] py-3 last:border-b-0"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-warn-soft text-ink">
                    <Icon aria-hidden="true" strokeWidth={2} className="size-4" />
                  </span>
                  <p className="m-0 min-w-0 flex-1 text-[13.5px] text-ink">{text}</p>
                  {action}
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}
      <Tabs
        label={t('schoolSettings.tabs.label')}
        value={tab}
        onValueChange={(value) => {
          const next = SCHOOL_SETTINGS_TABS.find((candidate) => candidate === value);
          if (next === undefined || next === tab) return;
          // Leaving General would unmount it and lose the changes: they wait to be saved.
          if (generalDirty) {
            toast.show(t('roles.toast.saveFirst'));
            return;
          }
          show(next);
        }}
        tabs={[
          {
            value: 'general',
            label: t('schoolSettings.tab.general'),
            panel:
              school.data === undefined ? (
                unavailable
              ) : (
                <GeneralForm
                  school={school.data}
                  canEdit={canEdit}
                  officeEmailId={OFFICE_EMAIL_ID}
                  onDirtyChange={setGeneralDirty}
                />
              ),
          },
          {
            value: 'sign-in',
            label: t('schoolSettings.tab.signIn'),
            panel:
              school.data === undefined ? unavailable : <SignInRules rules={school.data.signIn} />,
          },
          {
            value: 'audit',
            label: t('schoolSettings.tab.audit'),
            panel: (
              <AuditTab
                view={audit}
                onViewChange={setAudit}
                timeZone={timeZone}
                canExport={canExport}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
