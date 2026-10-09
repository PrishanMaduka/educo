import type { SensitiveKey } from '@quad/contracts';

/**
 * Whether someone holding `granterSensitive` may give a role the `requested` sensitive keys
 * (spec 08, Users & roles: a school admin cannot give a sensitive key they do not hold). Pass the
 * keys being added; keys a role already has are not being given. `granterSensitive` is the
 * granter's own keys from their real roles, never a previewed role's.
 */
export function canGrant(
  granterSensitive: readonly SensitiveKey[],
  requested: readonly SensitiveKey[],
): boolean {
  return requested.every((key) => granterSensitive.includes(key));
}
