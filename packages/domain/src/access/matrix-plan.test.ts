import { describe, expect, it } from 'vitest';

import { FULL_ACCESS, NO_ACCESS, rowOf } from './matrix';
import { modulesOutsidePlan, planMatrix } from './matrix-plan';

describe('planMatrix (spec 05: a module outside the plan cannot be granted)', () => {
  it('keeps normalised rows with access whose module is in the plan', () => {
    const result = planMatrix({ fees: rowOf('11000'), sis: rowOf('10000') }, ['fees', 'sis']);
    expect(result).toEqual({
      granted: { fees: rowOf('11000'), sis: rowOf('10000') },
      outsidePlan: [],
    });
  });

  it('drops a row without View (no access) wherever its module is', () => {
    const result = planMatrix({ fees: rowOf('01100'), transport: rowOf('00001') }, ['fees']);
    expect(result).toEqual({ granted: {}, outsidePlan: [] });
  });

  it('lists the modules outside the plan that a row would grant, in matrix order', () => {
    const result = planMatrix(
      { transport: FULL_ACCESS, fees: rowOf('10000'), admissions: rowOf('10000'), sis: NO_ACCESS },
      ['sis'],
    );
    expect(result).toEqual({ granted: {}, outsidePlan: ['admissions', 'fees', 'transport'] });
  });

  it('treats attendance as part of sis and settings as in every plan', () => {
    const result = planMatrix({ attendance: rowOf('10000'), settings: rowOf('10000') }, ['sis']);
    expect(result.outsidePlan).toEqual([]);
    expect(Object.keys(result.granted)).toEqual(['attendance', 'settings']);
    expect(planMatrix({ attendance: rowOf('10000') }, []).outsidePlan).toEqual(['attendance']);
  });
});

describe('modulesOutsidePlan (the editor shows these rows Not in plan)', () => {
  it.each([
    [[], ['admissions', 'crm', 'sis', 'attendance', 'lms', 'fees', 'finance', 'transport']],
    [['admissions', 'crm', 'sis', 'lms', 'fees', 'finance', 'parent'], ['transport']],
    [['admissions', 'crm', 'sis', 'lms', 'fees', 'finance', 'parent', 'transport'], []],
    [['sis'], ['admissions', 'crm', 'lms', 'fees', 'finance', 'transport']],
  ] as const)('with the plan %j lists %j in matrix order, never settings', (plan, outside) => {
    expect(modulesOutsidePlan(plan)).toEqual(outside);
  });
});
