'use client';

import { useToast } from '@quad/ui';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import type { Role, RolePermissionsInput, StaffInviteInput, StaffMember } from '@quad/contracts';

import { staffApi, unwrap, unwrapEmpty } from '@/lib/api';
import { actionMessageFor } from '@/lib/error-copy';

/** Every query of this page starts with one of these, so a write refreshes them all. */
const USERS = ['users'] as const;
const ROLES = ['roles'] as const;

/** One page of staff: as many as the API gives at once (spec 06 paging). */
const PAGE = 200;

export interface StaffFilter {
  /** Name or address; empty for everyone. */
  readonly q: string;
  /** A role's id; null for everyone. */
  readonly roleId: string | null;
}

/** `GET /users` for the People tab, page by page, with the whole school's story summary. */
export function useStaff(filter: StaffFilter) {
  return useInfiniteQuery({
    queryKey: [...USERS, 'list', filter],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      unwrap(
        staffApi().GET('/api/v1/users', {
          params: {
            query: {
              limit: PAGE,
              ...(pageParam === undefined ? {} : { cursor: pageParam }),
              ...(filter.q === '' ? {} : { q: filter.q }),
              ...(filter.roleId === null ? {} : { roleId: filter.roleId }),
            },
          },
        }),
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: (previous) => previous,
  });
}

/** `GET /roles`: the school's roles, and the matrix rows outside its plan. */
export function useRoles() {
  return useQuery({
    queryKey: [...ROLES, 'list'],
    queryFn: () => unwrap(staffApi().GET('/api/v1/roles')),
  });
}

/**
 * The page's writes (spec 08 Users & roles), each confirmed by a toast that says what happened
 * and refused with the API's own sentence. Staff and roles are read again after each one (a role
 * change moves member counts too).
 */
export function useUsersActions() {
  const { t } = useTranslation();
  const toast = useToast();
  const queries = useQueryClient();
  const refresh = async () => {
    await Promise.all([
      queries.invalidateQueries({ queryKey: USERS }),
      queries.invalidateQueries({ queryKey: ROLES }),
    ]);
  };
  const fail = (error: unknown) => {
    toast.show(actionMessageFor(error, (key) => t(key)));
  };
  const done = async (message: string) => {
    toast.show(message);
    await refresh();
  };
  const path = (member: StaffMember) => ({ params: { path: { id: member.id } } });

  const invite = useMutation({
    mutationFn: (body: StaffInviteInput) =>
      unwrap(staffApi().POST('/api/v1/users/invite', { body })),
    onSuccess: (result) => done(t('users.toast.invited', { count: result.items.length })),
  });

  const changeRole = useMutation({
    mutationFn: ({ member, role }: { member: StaffMember; role: Role }) =>
      unwrap(
        staffApi().PATCH('/api/v1/users/{id}', { ...path(member), body: { roleId: role.id } }),
      ),
    onSuccess: (member, { role }) =>
      done(t('users.toast.roleChanged', { name: member.name, role: role.name })),
    onError: fail,
  });

  const setStatus = useMutation({
    mutationFn: ({ member, status }: { member: StaffMember; status: 'active' | 'deactivated' }) =>
      unwrap(staffApi().PATCH('/api/v1/users/{id}', { ...path(member), body: { status } })),
    onSuccess: (member) =>
      done(
        member.status === 'deactivated'
          ? t('users.toast.deactivated', { name: member.name })
          : member.status === 'invited'
            ? t('users.toast.reinvited', { name: member.name })
            : t('users.toast.reactivated', { name: member.name }),
      ),
    onError: fail,
  });

  const remind = useMutation({
    mutationFn: (member: StaffMember) =>
      unwrapEmpty(staffApi().POST('/api/v1/users/{id}/remind-two-step', path(member))),
    onSuccess: (_, member) => done(t('users.toast.reminded', { name: member.name })),
    onError: fail,
  });

  const resetPassword = useMutation({
    mutationFn: (member: StaffMember) =>
      unwrapEmpty(staffApi().POST('/api/v1/users/{id}/reset-password', path(member))),
    onSuccess: (_, member) => done(t('users.toast.resetSent', { email: member.email ?? '' })),
    onError: fail,
  });

  const signOutEverywhere = useMutation({
    mutationFn: (member: StaffMember) =>
      unwrapEmpty(staffApi().POST('/api/v1/users/{id}/sign-out-everywhere', path(member))),
    onSuccess: (_, member) => done(t('users.toast.signedOut', { name: member.name })),
    onError: fail,
  });

  const resendInvite = useMutation({
    mutationFn: (member: StaffMember) =>
      unwrapEmpty(staffApi().POST('/api/v1/users/{id}/resend-invite', path(member))),
    onSuccess: (_, member) => done(t('users.toast.resent', { email: member.email ?? '' })),
    onError: fail,
  });

  const savePermissions = useMutation({
    mutationFn: ({ role, body }: { role: Role; body: RolePermissionsInput }) =>
      unwrap(
        staffApi().PUT('/api/v1/roles/{id}/permissions', {
          params: { path: { id: role.id } },
          body,
        }),
      ),
    onSuccess: (role) => done(t('roles.toast.saved', { role: role.name })),
    onError: fail,
  });

  return {
    invite,
    changeRole,
    setStatus,
    remind,
    resetPassword,
    signOutEverywhere,
    resendInvite,
    savePermissions,
    refresh,
    fail,
  };
}

export type UsersActions = ReturnType<typeof useUsersActions>;
