import { SensitiveKey } from '@quad/contracts';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { canGrant } from './grant-checks';

const arbKeys = fc.subarray([...SensitiveKey.options]);

describe('canGrant (spec 08: a school admin cannot give a sensitive key they do not hold)', () => {
  it.each<[string, SensitiveKey[], SensitiveKey[], SensitiveKey[], boolean]>([
    ['no change', [], ['medical'], ['medical'], true],
    ['removing a key, held or not', [], ['medical', 'safeguarding'], ['medical'], true],
    ['removing every key', [], ['export_data'], [], true],
    [
      'keeping a key the granter lacks',
      ['export_data'],
      ['safeguarding'],
      ['safeguarding', 'export_data'],
      true,
    ],
    ['adding a key the granter lacks', ['medical'], [], ['safeguarding'], false],
    ['adding a key the granter holds', ['medical'], [], ['medical'], true],
    ['adding one held and one lacked', ['medical'], [], ['medical', 'finance_reports'], false],
    ['swapping a lacked key for another lacked key', [], ['medical'], ['safeguarding'], false],
  ])('%s', (_name, granter, current, next, expected) => {
    expect(canGrant(granter, current, next)).toBe(expected);
  });

  it('refuses exactly when a key is added that the granter lacks (property)', () => {
    fc.assert(
      fc.property(arbKeys, arbKeys, arbKeys, (granter, current, next) => {
        const added = next.filter((key) => !current.includes(key));
        expect(canGrant(granter, current, next)).toBe(added.every((key) => granter.includes(key)));
      }),
    );
  });

  it('always allows a removal (property)', () => {
    fc.assert(
      fc.property(arbKeys, arbKeys, (granter, current) => {
        expect(canGrant(granter, current, current.slice(1))).toBe(true);
      }),
    );
  });
});
