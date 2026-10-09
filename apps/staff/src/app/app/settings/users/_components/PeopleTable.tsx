'use client';

import { Avatar, Button, Pill, Table, formatRelative, type TableColumn } from '@quad/ui';
import { useTranslation } from 'react-i18next';

import { rowActionsFor, type RowAction } from './people';
import { RoleSelect } from './RoleSelect';
import { RowActions } from './RowActions';

import type { MembershipStatus, Role, StaffMember } from '@quad/contracts';
import type { ReactNode } from 'react';

const STATUS_TONE = { active: 'good', invited: 'info', deactivated: 'neutral' } as const;

export interface PeopleTableProps {
  members: readonly StaffMember[];
  roles: readonly Role[];
  timeZone: string;
  /** "Now" for "10 minutes ago", passed in so a render never reads the clock twice. */
  now: Date;
  busy: boolean;
  empty: ReactNode;
  footer: ReactNode;
  onRoleChange: (member: StaffMember, role: Role) => void;
  onAction: (action: RowAction, member: StaffMember) => void;
}

/**
 * The People table (spec 08; prototype `V.users` people tab): person, role, two-step sign-in with
 * **Remind**, last active, status and actions. Below 1024 px wide it becomes one card per person.
 */
export function PeopleTable({
  members,
  roles,
  timeZone,
  now,
  busy,
  empty,
  footer,
  onRoleChange,
  onAction,
}: PeopleTableProps) {
  const { t } = useTranslation();

  const person = (member: StaffMember) => (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar name={member.name} size="sm" decorative />
      <div className="min-w-0">
        <p className="m-0 truncate font-bold text-ink">{member.name}</p>
        {member.email === null ? null : (
          <p className="m-0 truncate text-xs text-ink-2">{member.email}</p>
        )}
      </div>
    </div>
  );
  const role = (member: StaffMember) => (
    <RoleSelect
      member={member}
      roles={roles}
      busy={busy}
      onChange={(next) => {
        onRoleChange(member, next);
      }}
    />
  );
  const twoStep = (member: StaffMember) => (
    <div className="flex items-center gap-1.5">
      <Pill tone={member.twoStepOn ? 'good' : 'warn'}>
        {member.twoStepOn ? t('users.twoStep.on') : t('users.twoStep.off')}
      </Pill>
      {rowActionsFor(member).includes('remind_two_step') ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          aria-label={t('users.remind.label', { name: member.name })}
          onClick={() => {
            onAction('remind_two_step', member);
          }}
        >
          {t('users.remind.button')}
        </Button>
      ) : null}
    </div>
  );
  const lastActive = (member: StaffMember) =>
    member.status === 'invited' && member.inviteSentAt !== null
      ? t('users.lastActive.inviteSent', {
          when: formatRelative(member.inviteSentAt, now, timeZone),
        })
      : member.lastSignInAt === null
        ? t('users.lastActive.never')
        : formatRelative(member.lastSignInAt, now, timeZone);
  const status = (value: MembershipStatus) => (
    <Pill tone={STATUS_TONE[value]}>{t(`users.state.${value}`)}</Pill>
  );
  const actions = (member: StaffMember) => (
    <RowActions member={member} busy={busy} onAction={onAction} />
  );

  const columns: TableColumn<StaffMember>[] = [
    { key: 'name', header: t('users.col.person'), cell: person },
    { key: 'role', header: t('users.col.role'), cell: role },
    { key: 'twoStep', header: t('users.col.twoStep'), cell: twoStep },
    {
      key: 'lastActive',
      header: t('users.col.lastActive'),
      cell: (member) => <span className="text-ink-2">{lastActive(member)}</span>,
    },
    { key: 'status', header: t('users.col.status'), cell: (member) => status(member.status) },
    { key: 'actions', header: t('users.col.actions'), align: 'right', cell: actions },
  ];

  return (
    <>
      <div className="max-lg:hidden">
        <Table
          caption={t('users.table.caption')}
          columns={columns}
          rows={members}
          getRowId={(member) => member.id}
          rowLabel={(member) => member.name}
          empty={empty}
          footer={footer}
        />
      </div>
      <div className="lg:hidden">
        {members.length === 0 ? (
          <div className="px-[18px] py-6">{empty}</div>
        ) : (
          <ul aria-label={t('users.table.caption')} className="m-0 list-none p-0">
            {members.map((member) => (
              <li
                key={member.id}
                className="flex flex-col gap-3 border-b border-line px-[18px] py-3.5"
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">{person(member)}</div>
                  {status(member.status)}
                </div>
                {role(member)}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {twoStep(member)}
                  <span className="text-xs text-ink-2">{lastActive(member)}</span>
                </div>
                {actions(member)}
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-2.5 px-[18px] py-2.5 text-[12.5px] text-ink-2">
          {footer}
        </div>
      </div>
    </>
  );
}
