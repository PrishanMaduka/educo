import { pageAccess } from './page-access';

import type { PermissionKey, PlanModule, RoleScope, StaffPageId } from '@quad/contracts';

/**
 * The page a person starts on (spec 08: teachers start on My teaching, front desk on Attendance),
 * chosen among the pages `pageAccess` opens, so the home is never a hidden page:
 * 1. My teaching, when open (it needs `lms.create`) and the primary role's scope is `own_classes`;
 * 2. else Dashboard, if open;
 * 3. else Attendance, if open;
 * 4. else the first open page in side bar order (Communications at the latest, since every staff
 *    role has it).
 */
export function roleHome(
  perms: ReadonlySet<PermissionKey>,
  primaryRoleScope: RoleScope,
  planModules: readonly PlanModule[],
): StaffPageId {
  const open = pageAccess(perms, planModules)
    .filter((page) => page.access !== 'hidden')
    .map((page) => page.id);
  if (primaryRoleScope === 'own_classes' && open.includes('my_teaching')) return 'my_teaching';
  if (open.includes('dashboard')) return 'dashboard';
  if (open.includes('attendance')) return 'attendance';
  // The earliest open page. Communications needs nothing, so the default is never used.
  const [first = 'communications'] = open;
  return first;
}
