'use client';

import { Button, buttonVariants, Card, EmptyState, Tabs, useLeaveGuard, useToast } from '@quad/ui';
import { PageHead } from '@quad/ui/shell';
import { Plus, ShieldAlert, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { InviteStaffDrawer } from '../_drawers/InviteStaffDrawer';

import { PeopleTab } from './PeopleTab';
import { hasUnsaved, type RoleEdit } from './role-draft';
import { RolesTab } from './RolesTab';
import { useRoles, useStaff, useUsersActions, type StaffFilter } from './use-users-data';

import type { SensitiveKey } from '@quad/contracts';

import { useShellActions } from '@/components/shell/use-shell-actions';

export type UsersTab = 'people' | 'roles';

/** Where this page lives, and the address of one tab (and role) of it. */
export const USERS_PATH = '/app/settings/users';

export function usersHref(tab: UsersTab, roleId?: string): string {
  if (tab === 'people') return USERS_PATH;
  const query = new URLSearchParams({ tab });
  if (roleId !== undefined) query.set('role', roleId);
  return `${USERS_PATH}?${query.toString()}`;
}

/** How long the search waits for typing to stop before it asks the API. */
const SEARCH_DELAY_MS = 250;

export interface UsersRolesProps {
  initialTab: UsersTab;
  initialRoleId: string | null;
  timeZone: string;
  /** The sensitive keys the signed-in admin holds. */
  held: readonly SensitiveKey[];
  /** Preview a role is offered (users.manage, and no preview or support visit on). */
  canPreview: boolean;
}

/**
 * Settings → Users & roles (spec 08): the story ("14 staff · 3 haven't turned on two-step
 * sign-in"), then People and Roles & permissions. Everything shown comes from the API; the page
 * only applies the matrix rules from `@quad/domain` while a role is edited.
 */
export function UsersRoles({
  initialTab,
  initialRoleId,
  timeZone,
  held,
  canPreview,
}: UsersRolesProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<UsersTab>(initialTab);
  const [roleId, setRoleId] = useState<string | null>(initialRoleId);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StaffFilter>({ q: '', roleId: null });
  const [inviting, setInviting] = useState(false);
  const [edit, setEdit] = useState<RoleEdit | null>(null);
  const toast = useToast();
  const staff = useStaff(filter);
  const roles = useRoles();
  const actions = useUsersActions();
  const shell = useShellActions();
  // A role's unsaved changes stay until saved or discarded: the tabs wait, and leaving asks.
  const unsaved = hasUnsaved(edit, roles.data?.items ?? []);
  useLeaveGuard(unsaved, t('common.leaveUnsaved'));

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilter((current) =>
        current.q === search.trim() ? current : { ...current, q: search.trim() },
      );
    }, SEARCH_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [search]);

  // The tab and role are in the address, so a reload or a shared link opens the same view.
  const show = (nextTab: UsersTab, nextRole: string | null) => {
    setTab(nextTab);
    setRoleId(nextRole);
    window.history.replaceState(
      window.history.state,
      '',
      usersHref(nextTab, nextTab === 'roles' ? (nextRole ?? undefined) : undefined),
    );
  };

  const summary = staff.data?.pages[0]?.summary;
  const story =
    tab === 'roles'
      ? t('roles.story')
      : summary === undefined
        ? undefined
        : t('users.story', { staff: summary.staff, without: summary.withoutTwoStep });
  const roleItems = roles.data?.items ?? [];

  const rolesUnavailable = (
    <Card>
      <EmptyState
        icon={ShieldAlert}
        title={roles.isError ? t('users.loadFailed') : t('users.loading')}
        action={
          roles.isError ? (
            <Button
              variant="secondary"
              onClick={() => {
                void roles.refetch();
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
        title={t('nav.staff.page.users_roles')}
        description={<span aria-live="polite">{story}</span>}
        actions={
          tab === 'people' ? (
            <Button
              icon={UserPlus}
              disabled={roleItems.length === 0}
              onClick={() => {
                setInviting(true);
              }}
            >
              {t('users.invite.open')}
            </Button>
          ) : (
            <Link href={`${USERS_PATH}/roles/new`} className={buttonVariants()}>
              <Plus aria-hidden="true" strokeWidth={2} className="size-4" />
              {t('roles.new')}
            </Link>
          )
        }
      />
      <Tabs
        label={t('users.tabs.label')}
        value={tab}
        onValueChange={(value) => {
          if (unsaved) {
            toast.show(t('roles.toast.saveFirst'));
            return;
          }
          show(value === 'roles' ? 'roles' : 'people', roleId);
        }}
        tabs={[
          {
            value: 'people',
            label: t('users.tab.people'),
            panel: (
              <PeopleTab
                staff={staff}
                roles={roleItems}
                filter={filter}
                onFilterChange={setFilter}
                search={search}
                onSearchChange={setSearch}
                timeZone={timeZone}
                actions={actions}
                preview={
                  canPreview && roleItems.length > 0
                    ? {
                        busy: shell.startPreview.isPending,
                        start: (role) => {
                          shell.startPreview.mutate({
                            roleId: role.id,
                            needsSample: role.scope === 'own_classes',
                            previewing: false,
                          });
                        },
                      }
                    : null
                }
              />
            ),
          },
          {
            value: 'roles',
            label: t('users.tab.roles'),
            panel:
              roles.data === undefined ? (
                rolesUnavailable
              ) : (
                <RolesTab
                  roles={roles.data}
                  selectedId={roleId}
                  onSelect={(id) => {
                    show('roles', id);
                  }}
                  held={held}
                  actions={actions}
                  edit={edit}
                  onEdit={setEdit}
                />
              ),
          },
        ]}
      />
      <InviteStaffDrawer
        open={inviting}
        onOpenChange={setInviting}
        roles={roleItems}
        invite={actions.invite}
      />
    </div>
  );
}
