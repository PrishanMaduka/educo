import { PermissionModule, SensitiveKey } from '@quad/contracts';
import { canGrant, normaliseRow } from '@quad/domain';

import type { PermissionAction, Role, RoleMatrix, RolePermissionsInput } from '@quad/contracts';

/** The matrix and sensitive keys being edited for one role. */
export interface RoleDraft {
  readonly matrix: RoleMatrix;
  readonly sensitive: readonly SensitiveKey[];
}

export function draftOf(role: Pick<Role, 'matrix' | 'sensitive'>): RoleDraft {
  return { matrix: role.matrix, sensitive: role.sensitive };
}

/** One box clicked, by the matrix rules in `@quad/domain` (`normaliseRow`). */
export function toggleCell(
  draft: RoleDraft,
  module: PermissionModule,
  action: PermissionAction,
  checked: boolean,
): RoleDraft {
  const row = normaliseRow(draft.matrix[module], { action, checked });
  return { ...draft, matrix: { ...draft.matrix, [module]: { ...row } } };
}

/** One sensitive switch flipped; the keys stay in `SensitiveKey` order. */
export function toggleSensitive(draft: RoleDraft, key: SensitiveKey, on: boolean): RoleDraft {
  const next = new Set(draft.sensitive);
  if (on) next.add(key);
  else next.delete(key);
  return { ...draft, sensitive: SensitiveKey.options.filter((option) => next.has(option)) };
}

/** Whether the draft differs from what the role has now. */
export function isDirty(draft: RoleDraft, role: Pick<Role, 'matrix' | 'sensitive'>): boolean {
  const rowsDiffer = PermissionModule.options.some(
    (module) => JSON.stringify(draft.matrix[module]) !== JSON.stringify(role.matrix[module]),
  );
  const inOrder = (keys: readonly SensitiveKey[]) =>
    SensitiveKey.options.filter((key) => keys.includes(key)).join();
  return rowsDiffer || inOrder(draft.sensitive) !== inOrder(role.sensitive);
}

/**
 * `PUT /roles/:id/permissions`: the whole matrix but the rows outside the plan (the API refuses
 * those with `module_not_in_plan`; a module left out is no access), and the keys.
 */
export function permissionsBody(
  draft: RoleDraft,
  outsidePlan: readonly PermissionModule[],
): RolePermissionsInput {
  const matrix: RolePermissionsInput['matrix'] = {};
  for (const row of PermissionModule.options) {
    if (!outsidePlan.includes(row)) matrix[row] = draft.matrix[row];
  }
  return { matrix, sensitive: [...draft.sensitive] };
}

/**
 * A sensitive switch the admin cannot turn on (spec 08): a key they do not hold that the role
 * does not have yet (`canGrant`, the API's own check). Turning one off is always allowed.
 */
export function sensitiveLocked(
  key: SensitiveKey,
  held: readonly SensitiveKey[],
  stored: readonly SensitiveKey[],
): boolean {
  return !canGrant(held, stored, [key]);
}
