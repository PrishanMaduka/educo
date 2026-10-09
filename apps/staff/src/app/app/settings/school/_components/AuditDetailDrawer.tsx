'use client';

import { Button, Drawer, DrawerClose, formatDate } from '@quad/ui';
import { ScrollText, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { auditActionOf } from './audit-actions';
import { changesOf, detailsOf } from './audit-detail';
import { AuditWho } from './AuditWho';
import { SettingRow } from './SettingRow';

import type { MessageKey } from '@/i18n';
import type { AuditEntry } from '@quad/contracts';

/** School settings fields as the General tab names them. */
const FIELD_LABELS: Readonly<Record<string, MessageKey>> = {
  name: 'schoolSettings.general.name',
  officeEmail: 'schoolSettings.general.officeEmail',
  officePhone: 'schoolSettings.general.officePhone',
  address: 'schoolSettings.general.address',
  smsSenderId: 'schoolSettings.general.smsSenderId',
};

export interface AuditDetailDrawerProps {
  /** The entry shown; the drawer keeps the last one while it closes. */
  entry: AuditEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timeZone: string;
}

/**
 * One audit entry in full (spec 08: "a readable detail of each entry"): when, who, the action,
 * the address, the support-visit marker, a School settings change field by field, and the rest of
 * what was recorded. Reading it is not itself audited: the API audits exports, not views.
 */
export function AuditDetailDrawer({ entry, open, onOpenChange, timeZone }: AuditDetailDrawerProps) {
  const { t } = useTranslation();
  if (entry === null) return null;
  const action = auditActionOf(entry.action);
  const changes = changesOf(entry.action, entry.meta);
  const details = detailsOf(entry.meta, entry.action);
  const shown = (value: unknown) =>
    value === null || value === '' ? (
      <span className="text-ink-3">{t('schoolSettings.audit.detail.none')}</span>
    ) : typeof value === 'string' ? (
      value
    ) : (
      JSON.stringify(value)
    );

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      eyebrow={t('schoolSettings.audit.detail.eyebrow')}
      title={entry.summary}
      icon={ScrollText}
      footer={
        <DrawerClose asChild>
          <Button variant="secondary">{t('schoolSettings.audit.detail.close')}</Button>
        </DrawerClose>
      }
    >
      <div className="flex flex-col gap-4">
        {entry.viaSupport ? (
          <p className="m-0 flex items-start gap-2 rounded-xl bg-info-soft px-3.5 py-2.5 text-[13px] text-ink">
            <ShieldCheck aria-hidden="true" strokeWidth={2} className="mt-px size-4 shrink-0" />
            {t('schoolSettings.audit.detail.viaSupport')}
          </p>
        ) : null}
        <dl className="m-0 overflow-hidden rounded-xl border border-line">
          <SettingRow label={t('schoolSettings.audit.detail.when')}>
            <time dateTime={entry.at}>{formatDate(entry.at, timeZone, 'dateTime')}</time>
          </SettingRow>
          <SettingRow label={t('schoolSettings.audit.detail.who')}>
            <AuditWho actor={entry.actor} />
          </SettingRow>
          <SettingRow label={t('schoolSettings.audit.detail.action')}>
            {action === null ? entry.action : t(`schoolSettings.audit.action.${action}`)}
          </SettingRow>
          <SettingRow label={t('schoolSettings.audit.detail.ip')}>
            {entry.ip ?? t('schoolSettings.audit.detail.noIp')}
          </SettingRow>
        </dl>
        {changes.length > 0 ? (
          <section aria-labelledby="audit-changes" className="flex flex-col gap-2">
            <h3 id="audit-changes" className="m-0 text-[13px] font-bold text-ink">
              {t('schoolSettings.audit.detail.changes')}
            </h3>
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full border-collapse text-[13px] text-ink">
                <thead>
                  <tr className="bg-surface-2 text-left text-[11.5px] font-bold tracking-[0.04em] text-ink-2 uppercase">
                    <th scope="col" className="px-3 py-2">
                      {t('schoolSettings.audit.detail.field')}
                    </th>
                    <th scope="col" className="px-3 py-2">
                      {t('schoolSettings.audit.detail.before')}
                    </th>
                    <th scope="col" className="px-3 py-2">
                      {t('schoolSettings.audit.detail.after')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {changes.map((change) => {
                    const label = FIELD_LABELS[change.field];
                    return (
                      <tr key={change.field} className="border-t border-line align-top">
                        <th scope="row" className="px-3 py-2 text-left font-semibold">
                          {label === undefined ? change.field : t(label)}
                        </th>
                        <td className="px-3 py-2 break-words whitespace-pre-line">
                          {shown(change.before)}
                        </td>
                        <td className="px-3 py-2 break-words whitespace-pre-line">
                          {shown(change.after)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
        {details.length > 0 ? (
          <section aria-labelledby="audit-details" className="flex flex-col gap-2">
            <h3 id="audit-details" className="m-0 text-[13px] font-bold text-ink">
              {t('schoolSettings.audit.detail.details')}
            </h3>
            <dl className="m-0 flex flex-col gap-1.5 rounded-xl bg-surface-2 px-3.5 py-3">
              {details.map((detail) => (
                <div key={detail.key} className="flex flex-wrap gap-x-3 gap-y-0.5 text-[13px]">
                  <dt className="font-mono text-ink-2">{detail.key}</dt>
                  <dd className="m-0 min-w-0 font-mono break-all text-ink">{detail.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}
      </div>
    </Drawer>
  );
}
