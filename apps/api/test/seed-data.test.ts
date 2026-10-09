import { SystemRoleKey } from '@quad/contracts';
import { SEED_SYSTEM_ROLES } from '@quad/db';
import { systemRoleMatrix } from '@quad/domain';
import { describe, expect, it } from 'vitest';

/**
 * `packages/db` cannot import `packages/domain`, so the seed spells each system role's scope
 * itself; this checks it against the fixed defaults the API grants from (Task 17).
 */
describe('the seeded system roles', () => {
  it('are the seven system roles', () => {
    expect(Object.keys(SEED_SYSTEM_ROLES).sort()).toEqual([...SystemRoleKey.options].sort());
  });

  it.each(SystemRoleKey.options)('%s has the scope of its fixed defaults', (key) => {
    expect(SEED_SYSTEM_ROLES[key].scope).toBe(systemRoleMatrix(key).scope);
  });
});
