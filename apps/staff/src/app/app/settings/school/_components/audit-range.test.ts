import { describe, expect, it } from 'vitest';

import { AUDIT_RANGES, auditRangeFrom } from './audit-range';

describe('auditRangeFrom (the When filter: from the start of a school-local day, to now)', () => {
  // 03:00 on 9 October in Colombo (UTC+05:30) is 21:30 UTC on the 8th.
  const now = new Date('2026-10-08T21:30:00.000Z');

  it.each([
    ['today', '2026-10-08T18:30:00.000Z'],
    ['last7', '2026-10-02T18:30:00.000Z'],
    ['last30', '2026-09-09T18:30:00.000Z'],
    ['last90', '2026-07-11T18:30:00.000Z'],
  ] as const)('%s starts at Colombo midnight, %s', (range, from) => {
    expect(auditRangeFrom(range, now, 'Asia/Colombo')).toBe(from);
  });

  it('follows a clock change: London midnight is 23:00 UTC in summer and 00:00 in winter', () => {
    const afterChange = new Date('2026-10-26T12:00:00.000Z');
    expect(auditRangeFrom('today', afterChange, 'Europe/London')).toBe('2026-10-26T00:00:00.000Z');
    expect(auditRangeFrom('last7', afterChange, 'Europe/London')).toBe('2026-10-19T23:00:00.000Z');
  });

  it('offers the four ranges in order', () => {
    expect(AUDIT_RANGES).toEqual(['today', 'last7', 'last30', 'last90']);
  });
});
