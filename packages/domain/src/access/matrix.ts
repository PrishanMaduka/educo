import { PermissionAction } from '@quad/contracts';

import type { PermissionModule, SensitiveKey } from '@quad/contracts';

/** One row of a role's permission matrix: which actions the role has on one module (spec 05). */
export type PermissionRow = Readonly<Record<PermissionAction, boolean>>;

/** A role's matrix. A module with no row is no access (only stored rows come back). */
export type PermissionMatrix = Readonly<Partial<Record<PermissionModule, PermissionRow>>>;

/** One checkbox click in the matrix editor. */
export interface RowChange {
  readonly action: PermissionAction;
  readonly checked: boolean;
}

export const NO_ACCESS: PermissionRow = Object.freeze({
  view: false,
  create: false,
  edit: false,
  delete: false,
  approve: false,
});

export const FULL_ACCESS: PermissionRow = Object.freeze({
  view: true,
  create: true,
  edit: true,
  delete: true,
  approve: true,
});

const BITS = /^[01]{5}$/;

/**
 * A row from five `0`/`1` characters in `PermissionAction` order, view first: the text form of
 * `role_permissions.actions bit(5)` (`'10000'` is view only). Anything else is a programmer error.
 */
export function rowOf(bits: string): PermissionRow {
  if (!BITS.test(bits)) throw new Error(`A permission row is five 0 or 1 characters: ${bits}`);
  const row = { ...NO_ACCESS };
  PermissionAction.options.forEach((action, i) => {
    row[action] = bits[i] === '1';
  });
  return Object.freeze(row);
}

/** The `bit(5)` text of a row, the inverse of `rowOf`. */
export function bitsOf(row: PermissionRow): string {
  return PermissionAction.options.map((action) => (row[action] ? '1' : '0')).join('');
}

/**
 * A row after one click, following the matrix rules (spec 05, mirroring the prototype): unchecking
 * View clears the whole row, and checking any other action checks View. Without a change (a whole
 * row arriving from the API) View decides: a row without View is no access, the least privilege
 * reading of a row the editor could never produce. Returns a new frozen row.
 */
export function normaliseRow(row: PermissionRow, change?: RowChange): PermissionRow {
  const next = change ? { ...row, [change.action]: change.checked } : { ...row };
  if (change?.checked) next.view = true;
  return next.view ? Object.freeze(next) : NO_ACCESS;
}

/** What one role grants: its matrix and its sensitive keys (`role_permissions`, `role_sensitive`). */
export interface RoleGrant {
  readonly matrix: PermissionMatrix;
  readonly sensitive: readonly SensitiveKey[];
}
