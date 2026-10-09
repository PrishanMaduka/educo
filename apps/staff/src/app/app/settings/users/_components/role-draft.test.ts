import { describe, expect, it } from 'vitest';

import { draftOf, isDirty, permissionsBody, sensitiveLocked, toggleCell } from './role-draft';

import type { Role, RoleMatrix } from '@quad/contracts';

const NONE = { view: false, create: false, edit: false, delete: false, approve: false };
const VIEW = { ...NONE, view: true };
const matrix: RoleMatrix = {
  admissions: NONE,
  crm: NONE,
  sis: VIEW,
  attendance: NONE,
  lms: { ...VIEW, create: true, edit: true },
  fees: NONE,
  finance: NONE,
  transport: VIEW,
  settings: NONE,
};
const role: Role = {
  id: '0190a000-0000-7000-8000-0000000000c1',
  key: 'custom_1',
  name: 'Head of Year',
  description: null,
  color: '#3B4AA8',
  system: false,
  scope: 'school',
  baseRoleKey: 'teacher',
  memberCount: 0,
  pageCount: 5,
  home: 'my_teaching',
  matrix,
  sensitive: ['medical'],
};

describe('toggleCell (spec 05 matrix rules, from @quad/domain)', () => {
  it('ticks View with any other action', () => {
    const next = toggleCell(draftOf(role), 'fees', 'approve', true);
    expect(next.matrix.fees).toEqual({ ...NONE, view: true, approve: true });
    expect(isDirty(next, role)).toBe(true);
  });

  it('clears the row when View is unticked', () => {
    const next = toggleCell(draftOf(role), 'lms', 'view', false);
    expect(next.matrix.lms).toEqual(NONE);
  });

  it('is not dirty when a change is undone', () => {
    const there = toggleCell(draftOf(role), 'fees', 'view', true);
    expect(isDirty(toggleCell(there, 'fees', 'view', false), role)).toBe(false);
  });
});

describe('permissionsBody', () => {
  it('leaves out rows outside the plan, which the API refuses', () => {
    const body = permissionsBody(draftOf(role), ['transport']);
    expect(Object.keys(body.matrix)).not.toContain('transport');
    expect(body.matrix.lms).toEqual(matrix.lms);
    expect(body.sensitive).toEqual(['medical']);
  });
});

describe('sensitiveLocked (spec 08: no giving a key you do not hold)', () => {
  it('locks a key the admin lacks that the role does not have yet', () => {
    expect(sensitiveLocked('safeguarding', [], [])).toBe(true);
  });

  it('leaves a key the role already has free to switch off', () => {
    expect(sensitiveLocked('medical', [], ['medical'])).toBe(false);
  });

  it('leaves a key the admin holds free', () => {
    expect(sensitiveLocked('safeguarding', ['safeguarding'], [])).toBe(false);
  });
});

describe('isDirty and the sensitive keys', () => {
  it('sees a switched key, and not the same keys in another order', () => {
    const both: Role = { ...role, sensitive: ['medical', 'safeguarding'] };
    expect(isDirty({ ...draftOf(both), sensitive: ['safeguarding', 'medical'] }, both)).toBe(false);
    expect(isDirty({ ...draftOf(role), sensitive: [] }, role)).toBe(true);
  });
});
