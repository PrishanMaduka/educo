import { PermissionAction } from '@quad/contracts';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { FULL_ACCESS, NO_ACCESS, bitsOf, normaliseRow, rowOf } from './matrix';

import type { PermissionRow, RowChange } from './matrix';

const row = (bits: string): PermissionRow => rowOf(bits);

const arbRow: fc.Arbitrary<PermissionRow> = fc
  .tuple(fc.boolean(), fc.boolean(), fc.boolean(), fc.boolean(), fc.boolean())
  .map(([view, create, edit, del, approve]) => ({ view, create, edit, delete: del, approve }));
const arbChange: fc.Arbitrary<RowChange> = fc.record({
  action: fc.constantFrom(...PermissionAction.options),
  checked: fc.boolean(),
});
const arbMaybeChange = fc.option(arbChange, { nil: undefined });

describe('rowOf', () => {
  it('reads a row in PermissionAction order, view first (role_permissions.actions bit(5))', () => {
    expect(rowOf('10100')).toEqual({
      view: true,
      create: false,
      edit: true,
      delete: false,
      approve: false,
    });
    expect(rowOf('00000')).toEqual(NO_ACCESS);
    expect(rowOf('11111')).toEqual(FULL_ACCESS);
    expect(Object.isFrozen(rowOf('10000'))).toBe(true);
  });

  it.each(['', '1111', '111111', '1011x', '2'])('refuses %j as a programmer error', (bits) => {
    expect(() => rowOf(bits)).toThrow(/five 0 or 1/);
  });
});

describe('bitsOf', () => {
  it.each(['00000', '10000', '11001', '11111'])('writes %s back as it was read', (bits) => {
    expect(bitsOf(rowOf(bits))).toBe(bits);
  });

  it('round-trips any row (property)', () => {
    fc.assert(
      fc.property(arbRow, (r) => {
        expect(rowOf(bitsOf(r))).toEqual(r);
      }),
    );
  });
});

describe('normaliseRow (spec 05: the prototype matrix rules)', () => {
  it.each<[string, string, RowChange, string]>([
    ['unchecking View clears the whole row', '11111', { action: 'view', checked: false }, '00000'],
    ['checking Create also checks View', '00000', { action: 'create', checked: true }, '11000'],
    ['checking Approve also checks View', '01000', { action: 'approve', checked: true }, '11001'],
    ['checking View alone gives view only', '00000', { action: 'view', checked: true }, '10000'],
    ['unchecking Edit keeps the rest', '11100', { action: 'edit', checked: false }, '11000'],
    [
      'unchecking Delete on an empty row stays empty',
      '00000',
      { action: 'delete', checked: false },
      '00000',
    ],
    [
      'unchecking Create on a row without View clears it',
      '01100',
      { action: 'create', checked: false },
      '00000',
    ],
  ])('%s', (_name, before, change, after) => {
    expect(normaliseRow(row(before), change)).toEqual(row(after));
  });

  it.each<[string, string, string]>([
    ['a row without View is no access', '01111', '00000'],
    ['a row with View keeps its actions', '10110', '10110'],
    ['a full row stays full', '11111', '11111'],
  ])('without a change, %s (least privilege for a whole row from the API)', (_n, before, after) => {
    expect(normaliseRow(row(before))).toEqual(row(after));
  });

  it('returns a new frozen row and leaves the input alone', () => {
    const input = { ...row('01000') };
    const output = normaliseRow(input, { action: 'edit', checked: true });
    expect(input).toEqual(row('01000'));
    expect(output).not.toBe(input);
    expect(Object.isFrozen(output)).toBe(true);
  });

  it('is idempotent (property)', () => {
    fc.assert(
      fc.property(arbRow, arbMaybeChange, (r, change) => {
        const once = normaliseRow(r, change);
        expect(normaliseRow(once, change)).toEqual(once);
        expect(normaliseRow(once)).toEqual(once);
      }),
    );
  });

  it('never returns an action without View (property)', () => {
    fc.assert(
      fc.property(arbRow, arbMaybeChange, (r, change) => {
        const out = normaliseRow(r, change);
        const anyAction = out.create || out.edit || out.delete || out.approve;
        expect(!anyAction || out.view).toBe(true);
      }),
    );
  });

  it('applies the change it was given (property)', () => {
    fc.assert(
      fc.property(arbRow, arbChange, (r, change) => {
        const out = normaliseRow(r, change);
        // Checking always sticks; unchecking always sticks.
        expect(out[change.action]).toBe(change.checked);
      }),
    );
  });
});
