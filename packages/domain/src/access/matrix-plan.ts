import { PERMISSION_MODULE_PLAN, PermissionModule } from '@quad/contracts';

import { normaliseRow } from './matrix';

import type { PermissionMatrix, PermissionRow } from './matrix';
import type { PlanModule } from '@quad/contracts';

/** A matrix split by the school's plan (`planMatrix`). */
export interface PlannedMatrix {
  /** The normalised rows that grant something and whose module is in the plan. */
  readonly granted: PermissionMatrix;
  /** Modules outside the plan whose row would grant something, in matrix order. */
  readonly outsidePlan: readonly PermissionModule[];
}

/**
 * What a role may store under the school's plan (spec 05, Permission matrix and Plan and module
 * guard): every row is normalised (`normaliseRow`: no View, no access), rows with no access are
 * dropped, and a row that grants something on a module the plan does not include cannot be
 * granted. `PUT /roles/:id/permissions` refuses such rows (`module_not_in_plan`), and a role copied
 * from another leaves them out.
 */
export function planMatrix(
  matrix: PermissionMatrix,
  planModules: readonly PlanModule[],
): PlannedMatrix {
  const granted: Partial<Record<PermissionModule, PermissionRow>> = {};
  const outsidePlan: PermissionModule[] = [];
  for (const module of PermissionModule.options) {
    const row = matrix[module];
    if (row === undefined) continue;
    const normalised = normaliseRow(row);
    if (!normalised.view) continue;
    const plan = PERMISSION_MODULE_PLAN[module];
    if (plan === null || planModules.includes(plan)) granted[module] = normalised;
    else outsidePlan.push(module);
  }
  return { granted, outsidePlan };
}
