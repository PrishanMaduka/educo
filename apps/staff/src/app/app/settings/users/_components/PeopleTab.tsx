'use client';

import { Button, Card, Chip, EmptyState, Input } from '@quad/ui';
import { Search, UserSearch } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ConfirmDeactivateDrawer } from '../_drawers/ConfirmDeactivateDrawer';

import { PeopleTable } from './PeopleTable';
import { PreviewRoleCard } from './PreviewRoleCard';

import type { RowAction } from './people';
import type { StaffFilter, UsersActions, useStaff } from './use-users-data';
import type { Role, StaffMember } from '@quad/contracts';
import type { ReactNode } from 'react';

export interface PeopleTabProps {
  staff: ReturnType<typeof useStaff>;
  roles: readonly Role[];
  filter: StaffFilter;
  onFilterChange: (filter: StaffFilter) => void;
  /** What the search box shows (the filter follows it a moment later). */
  search: string;
  onSearchChange: (value: string) => void;
  timeZone: string;
  actions: UsersActions;
  /** Preview a role, or null when the card is not offered (a preview is already on). */
  preview: { busy: boolean; start: (role: Role) => void } | null;
}

/**
 * People (spec 08; prototype `V.users` people tab): Preview a role, then search, role chips and
 * the staff with their row actions.
 */
export function PeopleTab({
  staff,
  roles,
  filter,
  onFilterChange,
  search,
  onSearchChange,
  timeZone,
  actions,
  preview,
}: PeopleTabProps) {
  const { t } = useTranslation();
  const [deactivating, setDeactivating] = useState<StaffMember | null>(null);
  const [confirming, setConfirming] = useState(false);
  const members = staff.data?.pages.flatMap((page) => page.items) ?? [];
  const busy =
    actions.changeRole.isPending ||
    actions.setStatus.isPending ||
    actions.remind.isPending ||
    actions.resetPassword.isPending ||
    actions.signOutEverywhere.isPending ||
    actions.resendInvite.isPending;

  const onAction = (action: RowAction, member: StaffMember) => {
    switch (action) {
      case 'remind_two_step':
        actions.remind.mutate(member);
        break;
      case 'reset_password':
        actions.resetPassword.mutate(member);
        break;
      case 'resend_invite':
        actions.resendInvite.mutate(member);
        break;
      case 'sign_out_everywhere':
        actions.signOutEverywhere.mutate(member);
        break;
      case 'deactivate':
        setDeactivating(member);
        setConfirming(true);
        break;
      case 'reactivate':
        actions.setStatus.mutate({ member, status: 'active' });
        break;
    }
  };

  let body: ReactNode;
  if (staff.isError && members.length === 0) {
    body = (
      <EmptyState
        icon={UserSearch}
        title={t('users.loadFailed')}
        action={
          <Button
            variant="secondary"
            onClick={() => {
              void staff.refetch();
            }}
          >
            {t('common.tryAgain')}
          </Button>
        }
      />
    );
  } else if (staff.isPending) {
    body = (
      <div role="status" aria-label={t('users.loading')} className="flex flex-col gap-2 p-[18px]">
        {[0, 1, 2].map((row) => (
          <div
            key={row}
            className="h-11 animate-pulse rounded-lg bg-surface-2 motion-reduce:animate-none"
          />
        ))}
      </div>
    );
  } else {
    body = (
      <PeopleTable
        members={members}
        roles={roles}
        timeZone={timeZone}
        now={new Date(staff.dataUpdatedAt)}
        busy={busy}
        empty={
          <EmptyState
            icon={UserSearch}
            title={t('users.empty.title')}
            description={t('users.empty.body')}
          />
        }
        footer={
          <>
            <span className="flex-1">{t('users.footer', { count: members.length })}</span>
            {staff.hasNextPage ? (
              <Button
                variant="secondary"
                size="sm"
                disabled={staff.isFetchingNextPage}
                onClick={() => {
                  void staff.fetchNextPage();
                }}
              >
                {t('users.more')}
              </Button>
            ) : null}
          </>
        }
        onRoleChange={(member, role) => {
          actions.changeRole.mutate({ member, role });
        }}
        onAction={onAction}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {preview === null ? null : (
        <PreviewRoleCard roles={roles} busy={preview.busy} onPreview={preview.start} />
      )}
      <Card flush>
        <div className="flex flex-col gap-3 border-b border-line px-[18px] py-3.5">
          <div className="relative max-w-[360px]">
            <Search
              aria-hidden="true"
              strokeWidth={2}
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-2"
            />
            <Input
              type="search"
              aria-label={t('users.search.label')}
              placeholder={t('users.search.label')}
              value={search}
              className="pl-9"
              onChange={(event) => {
                onSearchChange(event.target.value);
              }}
            />
          </div>
          <div role="group" aria-label={t('users.filter.label')} className="flex flex-wrap gap-2">
            <Chip
              selected={filter.roleId === null}
              onClick={() => {
                onFilterChange({ ...filter, roleId: null });
              }}
            >
              {t('users.filter.everyone')}
            </Chip>
            {roles.map((role) => (
              <Chip
                key={role.id}
                selected={filter.roleId === role.id}
                count={role.memberCount}
                onClick={() => {
                  onFilterChange({ ...filter, roleId: role.id });
                }}
              >
                {role.name}
              </Chip>
            ))}
          </div>
        </div>
        {body}
      </Card>
      <ConfirmDeactivateDrawer
        open={confirming}
        member={deactivating}
        busy={actions.setStatus.isPending}
        onCancel={() => {
          setConfirming(false);
        }}
        onConfirm={(member) => {
          actions.setStatus.mutate(
            { member, status: 'deactivated' },
            {
              onSuccess: () => {
                setConfirming(false);
              },
            },
          );
        }}
      />
    </div>
  );
}
