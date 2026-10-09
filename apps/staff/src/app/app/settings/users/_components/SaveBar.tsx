'use client';

import { Button } from '@quad/ui';
import { useTranslation } from 'react-i18next';

export interface SaveBarProps {
  roleName: string;
  saving: boolean;
  onDiscard: () => void;
  onSave: () => void;
}

/**
 * The sticky bar under a custom role's matrix while it has unsaved changes (prototype `.savebar`):
 * what is unsaved, **Discard** and **Save changes**.
 */
export function SaveBar({ roleName, saving, onDiscard, onSave }: SaveBarProps) {
  const { t } = useTranslation();
  return (
    <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-2.5 rounded-b-card border-t border-line bg-surface px-[18px] py-3 shadow-card">
      <p role="status" className="m-0 min-w-0 flex-1 text-[13px] font-semibold text-ink">
        {t('roles.saveBar.unsaved', { role: roleName })}
      </p>
      <Button variant="secondary" size="sm" disabled={saving} onClick={onDiscard}>
        {t('roles.saveBar.discard')}
      </Button>
      <Button size="sm" disabled={saving} onClick={onSave}>
        {t('roles.saveBar.save')}
      </Button>
    </div>
  );
}
