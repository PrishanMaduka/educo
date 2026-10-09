import { sensitiveKeysOf } from '@quad/domain';

import { UsersRoles } from './_components/UsersRoles';

import type { PermissionKey } from '@quad/contracts';
import type { Metadata } from 'next';

import { NoAccess } from '@/components/shell/NoAccess';
import { accessOf, roleNameOf } from '@/components/shell/staff-nav';
import { t } from '@/i18n';
import { requireSignedIn } from '@/lib/server-session';

export const metadata: Metadata = { title: t('nav.staff.page.users_roles') };

interface UsersRolesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Settings → Users & roles (spec 08; `users.manage`). The server checks the page is part of the
 * person's role (or the previewed one) before anything renders; the staff and roles are read in
 * the browser, where the page's writes refresh them.
 */
export default async function UsersRolesPage({ searchParams }: UsersRolesPageProps) {
  const session = await requireSignedIn();
  if (session.kind !== 'ready') return null;
  const { me, permissions } = session;
  if (accessOf(permissions.pages, 'users_roles') === 'hidden') {
    return (
      <NoAccess
        page="users_roles"
        roleName={roleNameOf(me) ?? t('shell.role.support')}
        home={permissions.home}
      />
    );
  }
  const query = await searchParams;
  const keys: ReadonlySet<PermissionKey> = new Set(permissions.keys);
  return (
    <UsersRoles
      initialTab={query.tab === 'roles' ? 'roles' : 'people'}
      initialRoleId={typeof query.role === 'string' ? query.role : null}
      timeZone={me.school.timeZone}
      held={sensitiveKeysOf(keys)}
      canPreview={me.preview === null && me.support === null && keys.has('users.manage')}
    />
  );
}
