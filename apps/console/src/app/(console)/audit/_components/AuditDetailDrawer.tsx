'use client';

import { Button, Drawer, DrawerClose, MetaList, SettingRow, formatDate, metaLines } from '@quad/ui';
import { ScrollText, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { platformAuditActionOf } from './audit-actions';
import { AuditWho } from './AuditWho';

import type { PlatformAuditEntry } from '@quad/contracts';

export interface AuditDetailDrawerProps {
  /** The entry shown; the drawer keeps the last one while it closes. */
  entry: PlatformAuditEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timeZone: string;
}

/**
 * One console audit entry in full (spec 07: "the metadata JSON in a readable layout"): when, who,
 * the action, the school, the address, the support-visit marker and everything recorded.
 */
export function AuditDetailDrawer({ entry, open, onOpenChange, timeZone }: AuditDetailDrawerProps) {
  const { t } = useTranslation();
  if (entry === null) return null;
  const action = platformAuditActionOf(entry.action);
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      eyebrow={t('console.audit.detail.eyebrow')}
      title={entry.summary}
      icon={ScrollText}
      footer={
        <DrawerClose asChild>
          <Button variant="secondary">{t('console.audit.detail.close')}</Button>
        </DrawerClose>
      }
    >
      <div className="flex flex-col gap-4">
        {entry.viaSupport ? (
          <p className="m-0 flex items-start gap-2 rounded-xl bg-info-soft px-3.5 py-2.5 text-[13px] text-ink">
            <ShieldCheck aria-hidden="true" strokeWidth={2} className="mt-px size-4 shrink-0" />
            {t('console.audit.detail.viaSupport')}
          </p>
        ) : null}
        <dl className="m-0 overflow-hidden rounded-xl border border-line">
          <SettingRow label={t('console.audit.detail.when')}>
            <time dateTime={entry.at}>{formatDate(entry.at, timeZone, 'dateTime')}</time>
          </SettingRow>
          <SettingRow label={t('console.audit.detail.who')}>
            <AuditWho actor={entry.actor} />
          </SettingRow>
          <SettingRow label={t('console.audit.detail.action')}>
            {action === null ? entry.action : t(`console.audit.action.${action}`)}
          </SettingRow>
          <SettingRow label={t('console.audit.detail.school')}>
            {entry.school?.name ?? t('console.audit.noSchool')}
          </SettingRow>
          <SettingRow label={t('console.audit.detail.ip')}>
            {entry.ip ?? t('console.audit.detail.noIp')}
          </SettingRow>
        </dl>
        <MetaList title={t('console.audit.detail.details')} lines={metaLines(entry.meta)} />
      </div>
    </Drawer>
  );
}
