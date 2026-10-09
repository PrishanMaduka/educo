'use client';

import { ActionMenu, Button, type ActionMenuItem } from '@quad/ui';
import { KeyRound, LogOut, MailPlus, UserX } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { rowActionsFor, type RowAction } from './people';

import type { MessageKey } from '@/i18n';
import type { StaffMember } from '@quad/contracts';
import type { LucideIcon } from 'lucide-react';

/** What each action is called and its icon; Remind is the two-step pill's own button. */
const MENU: Partial<Record<RowAction, { label: MessageKey; icon: LucideIcon }>> = {
  resend_invite: { label: 'users.action.resendInvite', icon: MailPlus },
  reset_password: { label: 'users.action.resetPassword', icon: KeyRound },
  sign_out_everywhere: { label: 'users.action.signOutEverywhere', icon: LogOut },
  deactivate: { label: 'users.action.deactivate', icon: UserX },
};

export interface RowActionsProps {
  member: StaffMember;
  busy: boolean;
  onAction: (action: RowAction, member: StaffMember) => void;
}

/**
 * A member's actions (spec 08): **Resend invite** and **Reactivate** as buttons, as in the
 * prototype, and the rest in a menu. Your own row says "You". There is no "Sign in as".
 */
export function RowActions({ member, busy, onAction }: RowActionsProps) {
  const { t } = useTranslation();
  if (member.you) {
    return <span className="text-xs font-semibold text-ink-2">{t('users.you')}</span>;
  }
  const actions = rowActionsFor(member);
  const items: ActionMenuItem[] = actions.flatMap((action) => {
    const entry = MENU[action];
    if (entry === undefined) return [];
    return [
      {
        id: action,
        label: t(entry.label),
        icon: entry.icon,
        tone: action === 'deactivate' ? 'danger' : 'default',
        disabled: busy,
        onSelect: () => {
          onAction(action, member);
        },
      },
    ];
  });
  const primary = actions.includes('resend_invite')
    ? 'resend_invite'
    : actions.includes('reactivate')
      ? 'reactivate'
      : null;
  return (
    <div className="flex items-center justify-end gap-1.5">
      {primary === null ? null : (
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => {
            onAction(primary, member);
          }}
        >
          {t(primary === 'resend_invite' ? 'users.action.resendInvite' : 'users.action.reactivate')}
        </Button>
      )}
      <ActionMenu
        label={t('users.actions.label', { name: member.name })}
        items={items.filter((item) => item.id !== primary)}
      />
    </div>
  );
}
