'use client';

import { Button, Drawer } from '@quad/ui';
import { UserX } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { StaffMember } from '@quad/contracts';

export interface ConfirmDeactivateDrawerProps {
  open: boolean;
  /** The member to deactivate; kept while the drawer closes, so its title does not change. */
  member: StaffMember | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (member: StaffMember) => void;
}

/**
 * Deactivate, with confirmation (spec 08): a danger drawer saying what happens (signed out of this
 * school everywhere, no sign-in until reactivated, records kept).
 */
export function ConfirmDeactivateDrawer({
  open,
  member,
  busy,
  onCancel,
  onConfirm,
}: ConfirmDeactivateDrawerProps) {
  const { t } = useTranslation();
  const name = member?.name ?? '';
  return (
    <Drawer
      open={open && member !== null}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
      title={t('users.deactivate.title', { name })}
      icon={UserX}
      tone="danger"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            disabled={busy}
            onClick={() => {
              if (member !== null) onConfirm(member);
            }}
          >
            {t('users.deactivate.confirm', { name })}
          </Button>
        </>
      }
    >
      <p className="m-0 text-[14px] leading-normal text-ink">{t('users.deactivate.body')}</p>
    </Drawer>
  );
}
