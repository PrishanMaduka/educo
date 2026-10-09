import {
  PERMISSION_MODULE_PLAN,
  PermissionAction,
  PermissionModule,
  USERS_MANAGE,
  matrixPermissionKey,
  sensitivePermissionKey,
} from '@quad/contracts';

import { normaliseRow } from './matrix';
import { systemRoleMatrix } from './system-roles';

import type { RoleGrant } from './matrix';
import type { PermissionKey, PlanModule, SensitiveKey } from '@quad/contracts';

export interface EffectivePermissionsInput {
  /** The member's own roles in this school (a membership may have several). */
  readonly roles: readonly RoleGrant[];
  /** The school's plan modules (`tenant_modules`). */
  readonly planModules: readonly PlanModule[];
  /** The role being previewed (`preview_role_id` on the session), if any. */
  readonly preview?: RoleGrant;
  /** True in a Quad support session ("Open as school admin"). */
  readonly support?: boolean;
}

/** Support never sees safeguarding or medical records, whatever the role (spec 05). */
const HIDDEN_FROM_SUPPORT: readonly SensitiveKey[] = ['safeguarding', 'medical'];

const ADMIN = systemRoleMatrix('admin');
const SUPPORT: RoleGrant = {
  matrix: ADMIN.matrix,
  sensitive: ADMIN.sensitive.filter((key) => !HIDDEN_FROM_SUPPORT.includes(key)),
};

/** Whether the school's plan switches a matrix row on (`settings` is in every plan). */
function inPlan(module: PermissionModule, planModules: readonly PlanModule[]): boolean {
  const plan = PERMISSION_MODULE_PLAN[module];
  return plan === null || planModules.includes(plan);
}

/**
 * The permission keys a request acts with (spec 05; the API's `@Can` and `GET /me/permissions`):
 * - the union of the roles' matrices and sensitive keys, rows normalised (no action without View);
 * - a row whose module is outside the school's plan is dropped (`settings` is always in);
 * - `users.manage` comes with `settings.edit` (OQ3);
 * - a preview uses the previewed role instead of the member's own, and keeps only the sensitive
 *   keys some role in `roles` holds (spec 06, spec 08: previewing never grants a sensitive key);
 * - a support session uses the `admin` defaults minus `sensitive.safeguarding` and
 *   `sensitive.medical`, whatever the roles; a preview inside it is capped the same way.
 *
 * Scope (`own_classes`, `campus`) is not applied here: it filters rows, not keys (M3/M5).
 */
export function effectivePermissions(input: EffectivePermissionsInput): ReadonlySet<PermissionKey> {
  const { planModules, preview, support = false } = input;
  const own = support ? [SUPPORT] : input.roles;
  // The cap on a preview is derived here, never passed in: the member's own keys, or support's.
  const ownSensitive = own.flatMap((grant) => grant.sensitive);
  const grants: readonly RoleGrant[] = preview
    ? [
        {
          matrix: preview.matrix,
          sensitive: preview.sensitive.filter((k) => ownSensitive.includes(k)),
        },
      ]
    : own;

  const keys = new Set<PermissionKey>();
  for (const grant of grants) {
    for (const module of PermissionModule.options) {
      const row = grant.matrix[module];
      if (!row || !inPlan(module, planModules)) continue;
      const normalised = normaliseRow(row);
      for (const action of PermissionAction.options) {
        if (normalised[action]) keys.add(matrixPermissionKey(module, action));
      }
    }
    for (const key of grant.sensitive) keys.add(sensitivePermissionKey(key));
  }
  if (keys.has('settings.edit')) keys.add(USERS_MANAGE);
  return keys;
}
