import { IdSchema } from '@quad/contracts';
import { describe, expect, it } from 'vitest';

import { uuidv7 } from './uuid';

describe('uuidv7', () => {
  it('produces a valid RFC 9562 version 7 uuid', () => {
    const id = uuidv7();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(IdSchema.safeParse(id).success).toBe(true);
  });

  it('encodes the given time in the first 48 bits', () => {
    const at = Date.UTC(2026, 9, 6, 8, 30);
    const hex = uuidv7(at).replaceAll('-', '').slice(0, 12);
    expect(Number.parseInt(hex, 16)).toBe(at);
  });

  it('sorts by creation time', () => {
    const earlier = uuidv7(Date.UTC(2026, 0, 1));
    const later = uuidv7(Date.UTC(2026, 0, 1, 0, 0, 0, 1));
    expect([later, earlier].sort()).toEqual([earlier, later]);
  });

  it('does not repeat', () => {
    const at = Date.UTC(2026, 0, 1);
    const ids = new Set(Array.from({ length: 1000 }, () => uuidv7(at)));
    expect(ids.size).toBe(1000);
  });

  it('rejects a time outside the 48-bit range', () => {
    expect(() => uuidv7(-1)).toThrow(RangeError);
    expect(() => uuidv7(2 ** 48)).toThrow(RangeError);
    expect(() => uuidv7(1.5)).toThrow(RangeError);
  });
});
