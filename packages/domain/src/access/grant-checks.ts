import { SensitiveKey, sensitivePermissionKey } from '@quad/contracts';

import type { PermissionKey } from '@quad/contracts';

/**
 * Whether a change to a set of sensitive keys is allowed (spec 08, Users & roles: a school admin
 * cannot give a sensitive key they do not hold). Only the keys being added (`next` minus
 * `current`) are checked against `granterSensitive`: keeping a key the granter lacks is not
 * giving it, and removing a key is always allowed.
 *
 * - `current` must come from the database (`role_sensitive`), never from the request, or a
 *   caller could claim a key is already there.
 * - `granterSensitive` is the union of the granter's real roles' keys (never a previewed role's),
 *   or the support set in a support session.
 * - The same check applies when assigning a role to a user: `current` is the user's effective
 *   sensitive keys before, `next` after the role's keys are added.
 */
export function canGrant(
  granterSensitive: readonly SensitiveKey[],
  current: readonly SensitiveKey[],
  next: readonly SensitiveKey[],
): boolean {
  return next.every((key) => current.includes(key) || granterSensitive.includes(key));
}

/**
 * The sensitive keys among effective permission keys (`effectivePermissions`), in `SensitiveKey`
 * order: what a granter may give (`canGrant`'s `granterSensitive`). Call it with the granter's own
 * keys, never a preview's (a write is refused while previewing anyway), and in a support session
 * with the support set, which already lacks safeguarding and medical.
 */
export function sensitiveKeysOf(perms: ReadonlySet<PermissionKey>): SensitiveKey[] {
  return SensitiveKey.options.filter((key) => perms.has(sensitivePermissionKey(key)));
}
