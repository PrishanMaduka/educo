import { SensitiveKey } from '@quad/contracts';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { canGrant } from './grant-checks';

const arbKeys = fc.subarray([...SensitiveKey.options]);

describe('canGrant (spec 08: a school admin cannot give a sensitive key they do not hold)', () => {
  it.each<[string, SensitiveKey[], SensitiveKey[], boolean]>([
    ['nothing asked', [], [], true],
    ['a key they hold', ['medical', 'export_data'], ['medical'], true],
    ['every key they hold', ['medical', 'export_data'], ['export_data', 'medical'], true],
    ['a key they lack', ['medical'], ['safeguarding'], false],
    ['one held and one lacked', ['medical'], ['medical', 'safeguarding'], false],
    ['anything, holding nothing', [], ['finance_reports'], false],
  ])('%s', (_name, granter, requested, expected) => {
    expect(canGrant(granter, requested)).toBe(expected);
  });

  it('allows exactly the subsets of what the granter holds (property)', () => {
    fc.assert(
      fc.property(arbKeys, arbKeys, (granter, requested) => {
        const subset = requested.every((key) => granter.includes(key));
        expect(canGrant(granter, requested)).toBe(subset);
      }),
    );
  });
});
