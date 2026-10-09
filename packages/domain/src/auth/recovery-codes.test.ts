import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  RECOVERY_CODE_COUNT,
  RECOVERY_CODE_PATTERN,
  generateRecoveryCodes,
  normaliseRecoveryCode,
} from './recovery-codes';

import type { RandomBytes } from './recovery-codes';

/** A deterministic byte source: a counter, so every call gives new bytes. */
function counterRng(start = 0): RandomBytes {
  let next = start;
  return (length) => Uint8Array.from({ length }, () => next++ % 256);
}

describe('generateRecoveryCodes (spec 05 step 4: 10 recovery codes)', () => {
  it('makes 10 codes shaped xxxxx-xxxxx', () => {
    const codes = generateRecoveryCodes(counterRng());
    expect(RECOVERY_CODE_COUNT).toBe(10);
    expect(codes).toHaveLength(10);
    for (const code of codes) expect(code).toMatch(RECOVERY_CODE_PATTERN);
  });

  it('is deterministic for the same byte source', () => {
    expect(generateRecoveryCodes(counterRng(7))).toEqual(generateRecoveryCodes(counterRng(7)));
  });

  it('uses only unambiguous lower-case characters (no i, l, o or u)', () => {
    const joined = generateRecoveryCodes(counterRng()).join('');
    expect(joined).not.toMatch(/[ilou]/);
    expect(joined).toMatch(/^[0-9a-z-]+$/);
  });

  it('never repeats a code, even when the byte source repeats itself', () => {
    let calls = 0;
    // The first three calls give the same bytes, then a counter takes over.
    const fallback = counterRng(1);
    const repeating: RandomBytes = (length) =>
      calls++ < 3 ? new Uint8Array(length) : fallback(length);
    const codes = generateRecoveryCodes(repeating);
    expect(new Set(codes).size).toBe(10);
  });

  it('gives up on a byte source that never changes', () => {
    expect(() => generateRecoveryCodes((length) => new Uint8Array(length))).toThrow(/random bytes/);
  });

  it('always gives 10 distinct well-formed codes (property)', () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 200, maxLength: 200 }), (pool) => {
        let offset = 0;
        const fallback = counterRng(3);
        const rng: RandomBytes = (length) => {
          if (offset + length > pool.length) return fallback(length);
          const bytes = pool.slice(offset, offset + length);
          offset += length;
          return bytes;
        };
        const codes = generateRecoveryCodes(rng);
        return (
          codes.length === 10 &&
          new Set(codes).size === 10 &&
          codes.every((code) => RECOVERY_CODE_PATTERN.test(code))
        );
      }),
    );
  });
});

describe('normaliseRecoveryCode', () => {
  it.each<[string, string | null]>([
    ['abcde-fghjk', 'abcde-fghjk'],
    ['ABCDE-FGHJK', 'abcde-fghjk'],
    ['  abcde fghjk ', 'abcde-fghjk'],
    ['abcdefghjk', 'abcde-fghjk'],
    ['abcde-fghj', null],
    ['abcde-fghjkk', null],
    ['abcde-fghji', null],
    ['', null],
  ])('%j gives %j', (input, normalised) => {
    expect(normaliseRecoveryCode(input)).toBe(normalised);
  });
});
