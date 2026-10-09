import { describe, expect, it } from 'vitest';

import { strictestTwoStep } from './two-step-rule';

import type { TwoStepRow } from './two-step-rule';
import type { TwoStepRule } from '@quad/contracts';

const row = (twoStep: TwoStepRule, roleKeys: readonly string[]): TwoStepRow => ({
  twoStep,
  roleKeys,
});

describe('strictestTwoStep (spec 05 step 4: the strictest rule that covers the person wins)', () => {
  it.each<[string, readonly TwoStepRow[], TwoStepRule, boolean]>([
    ['no schools', [], 'off', false],
    ['a school with two-step off', [row('off', ['admin'])], 'off', false],
    ['admins, and the person is an admin there', [row('admins', ['admin'])], 'admins', true],
    ['admins, and the person is a teacher there', [row('admins', ['teacher'])], 'off', false],
    ['admins, and the person has no role there', [row('admins', [])], 'off', false],
    [
      'admins, with admin among several roles',
      [row('admins', ['finance', 'admin', 'teacher'])],
      'admins',
      true,
    ],
    ['staff covers every staff member', [row('staff', ['teacher'])], 'staff', true],
    ['all covers every staff member', [row('all', [])], 'all', true],
    [
      'a teacher in an admins school and a staff school: staff wins',
      [row('admins', ['teacher']), row('staff', ['teacher'])],
      'staff',
      true,
    ],
    [
      'an admin in an admins school and an off school: admins wins',
      [row('off', ['admin']), row('admins', ['admin'])],
      'admins',
      true,
    ],
    [
      'all beats staff whatever the order',
      [row('all', ['teacher']), row('staff', ['teacher']), row('admins', ['admin'])],
      'all',
      true,
    ],
  ])('%s', (_name, rows, rule, required) => {
    expect(strictestTwoStep(rows)).toEqual({ rule, required });
  });

  it('does not depend on the order of the rows', () => {
    const rows = [row('admins', ['admin']), row('staff', ['teacher']), row('off', [])];
    expect(strictestTwoStep([...rows].reverse())).toEqual(strictestTwoStep(rows));
  });
});
