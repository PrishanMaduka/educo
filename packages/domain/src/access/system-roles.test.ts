import { PermissionModule, SystemRoleKey } from '@quad/contracts';
import { describe, expect, it } from 'vitest';

import { bitsOf, normaliseRow } from './matrix';
import { systemRoleMatrix } from './system-roles';

import type { RoleScope, SensitiveKey } from '@quad/contracts';

/** Rows in `PermissionModule` order: admissions crm sis attendance lms fees finance transport settings. */
type Rows = readonly [string, string, string, string, string, string, string, string, string];

const ALL = '11111';
const NONE = '00000';
const VIEW = '10000';

describe('systemRoleMatrix (spec 05 School roles; prototype rolePerms where the spec is silent, OQ5)', () => {
  it.each<[SystemRoleKey, Rows, readonly SensitiveKey[], RoleScope]>([
    [
      'admin',
      [ALL, ALL, ALL, ALL, ALL, ALL, ALL, ALL, ALL],
      ['safeguarding', 'medical', 'finance_reports', 'export_data'],
      'school',
    ],
    [
      'principal',
      ['11101', '11101', '11101', '11101', '11101', '11101', '11101', '11101', VIEW],
      [],
      'school',
    ],
    ['finance', [NONE, NONE, VIEW, NONE, NONE, ALL, ALL, NONE, NONE], [], 'school'],
    ['admissions', ['11100', '11100', VIEW, NONE, NONE, NONE, NONE, NONE, NONE], [], 'school'],
    ['teacher', [NONE, NONE, VIEW, '11100', '11100', NONE, NONE, NONE, NONE], [], 'own_classes'],
    [
      'counsellor',
      [NONE, '11000', '11000', NONE, NONE, NONE, NONE, NONE, NONE],
      ['medical'],
      'school',
    ],
    ['frontdesk', [NONE, NONE, VIEW, '11100', NONE, NONE, NONE, VIEW, NONE], [], 'school'],
  ])('%s', (key, rows, sensitive, scope) => {
    const role = systemRoleMatrix(key);
    expect(PermissionModule.options.map((m) => bitsOf(role.matrix[m]))).toEqual(rows);
    expect(role.sensitive).toEqual(sensitive);
    expect(role.scope).toBe(scope);
  });

  it.each(SystemRoleKey.options)(
    '%s has a row for every module, each already normalised',
    (key) => {
      const { matrix } = systemRoleMatrix(key);
      for (const module of PermissionModule.options) {
        expect(normaliseRow(matrix[module])).toEqual(matrix[module]);
      }
    },
  );

  it.each(SystemRoleKey.options)('%s is frozen all the way down', (key) => {
    const role = systemRoleMatrix(key);
    expect(Object.isFrozen(role)).toBe(true);
    expect(Object.isFrozen(role.matrix)).toBe(true);
    expect(Object.isFrozen(role.sensitive)).toBe(true);
    for (const module of PermissionModule.options)
      expect(Object.isFrozen(role.matrix[module])).toBe(true);
  });

  it('gives the same object every time (deterministic)', () => {
    expect(systemRoleMatrix('teacher')).toBe(systemRoleMatrix('teacher'));
  });

  it('keeps sensitive keys off by default except where spec 05 says otherwise', () => {
    const holders = SystemRoleKey.options.filter((k) => systemRoleMatrix(k).sensitive.length > 0);
    expect(holders).toEqual(['admin', 'counsellor']);
  });
});
