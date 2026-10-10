import { sensitiveKeysOf } from '@quad/domain';

import { NewRoleForm } from './_components/NewRoleForm';

import type { PermissionKey } from '@quad/contracts';
import type { Metadata } from 'next';

import { NoAccess } from '@/components/shell/NoAccess';
import { accessOf, hiddenByOf, roleNameOf } from '@/components/shell/staff-nav';
import { t } from '@/i18n';
import { requireSignedIn } from '@/lib/server-session';

export const metadata: Metadata = { title: t('roles.new') };

/**
 * Users & roles → New role (spec 08; prototype `ukRolePage`): name, description, colour, the
 * role it starts from, where it applies, the matrix and sensitive access.
 */
export default async function NewRolePage() {
  const session = await requireSignedIn();
  if (session.kind !== 'ready') return null;
  const { me, permissions } = session;
  if (accessOf(permissions.pages, 'users_roles') === 'hidden') {
    return (
      <NoAccess
        page="users_roles"
        roleName={roleNameOf(me) ?? t('shell.role.support')}
        home={permissions.home}
        hiddenBy={hiddenByOf(permissions.pages, 'users_roles')}
      />
    );
  }
  const keys: ReadonlySet<PermissionKey> = new Set(permissions.keys);
  return <NewRoleForm held={sensitiveKeysOf(keys)} />;
}
