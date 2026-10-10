'use client';

import { Avatar, Card, cn } from '@quad/ui';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { Role } from '@quad/contracts';

export interface PreviewRoleCardProps {
  roles: readonly Role[];
  busy: boolean;
  onPreview: (role: Role) => void;
}

/**
 * Preview a role (spec 08; prototype `rvCard()`): every role with how many pages it opens and
 * where it starts, and **Preview**, which re-opens the portal as that role (read only).
 */
export function PreviewRoleCard({ roles, busy, onPreview }: PreviewRoleCardProps) {
  const { t } = useTranslation();
  return (
    <Card
      title={t('preview.card.title')}
      actions={
        <span className="text-[12.5px] text-ink-2 max-sm:hidden">{t('preview.card.subtitle')}</span>
      }
    >
      <p className="m-0 mb-3 text-[12.5px] text-ink-2 sm:hidden">{t('preview.card.subtitle')}</p>
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2.5 p-0">
        {roles.map((role) => (
          <li key={role.id}>
            <button
              type="button"
              disabled={busy}
              aria-label={t('preview.card.button', { role: role.name })}
              onClick={() => {
                onPreview(role);
              }}
              className={cn(
                'flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5 text-left hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60 max-sm:min-h-11',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
              )}
            >
              <Avatar name={role.name} size="sm" decorative />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-bold text-ink">{role.name}</span>
                <span className="block truncate text-xs text-ink-2">
                  {t('preview.card.detail', {
                    count: role.pageCount,
                    home: t(`nav.staff.page.${role.home}`),
                  })}
                </span>
              </span>
              <ArrowRight
                aria-hidden="true"
                strokeWidth={2}
                className="size-4 shrink-0 text-ink-2"
              />
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
