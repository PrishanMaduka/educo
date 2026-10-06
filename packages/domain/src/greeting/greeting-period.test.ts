import { describe, it, expect } from 'vitest';

import { greetingPeriod } from './greeting-period';

describe('greetingPeriod', () => {
  const timeZone = 'Asia/Colombo';

  describe('table-driven test cases', () => {
    it.each<[string, string, 'morning' | 'afternoon' | 'evening' | 'night', string]>([
      // Local time 04:59 → night, "Hello"
      ['2026-10-05T23:29:00Z', '04:59', 'night', 'Hello'],
      // Local time 05:00 → morning, "Good morning"
      ['2026-10-05T23:30:00Z', '05:00', 'morning', 'Good morning'],
      // Local time 11:59 → morning, "Good morning"
      ['2026-10-06T06:29:00Z', '11:59', 'morning', 'Good morning'],
      // Local time 12:00 → afternoon, "Good afternoon"
      ['2026-10-06T06:30:00Z', '12:00', 'afternoon', 'Good afternoon'],
      // Local time 16:59 → afternoon, "Good afternoon"
      ['2026-10-06T11:29:00Z', '16:59', 'afternoon', 'Good afternoon'],
      // Local time 17:00 → evening, "Good evening"
      ['2026-10-06T11:30:00Z', '17:00', 'evening', 'Good evening'],
      // Local time 19:59 → evening, "Good evening"
      ['2026-10-06T14:29:00Z', '19:59', 'evening', 'Good evening'],
      // Local time 20:00 → night, "Good evening"
      ['2026-10-06T14:30:00Z', '20:00', 'night', 'Good evening'],
      // Local time 23:59 → night, "Good evening"
      ['2026-10-06T18:29:00Z', '23:59', 'night', 'Good evening'],
      // Local time 00:00 → night, "Hello"
      ['2026-10-05T18:30:00Z', '00:00', 'night', 'Hello'],
    ])(
      'at $2 ($1) should be $3 with "$4"',
      (utcIsoString, localTime, expectedPeriod, expectedWord) => {
        const now = new Date(utcIsoString);
        const result = greetingPeriod(now, timeZone);

        expect(result.period).toBe(expectedPeriod);
        expect(result.word).toBe(expectedWord);
      },
    );
  });

  it('Review Focus #4: 2026-10-05T23:30:00Z in Asia/Colombo is morning', () => {
    const now = new Date('2026-10-05T23:30:00Z');
    const result = greetingPeriod(now, timeZone);

    expect(result.period).toBe('morning');
    expect(result.word).toBe('Good morning');
  });

  it('throws RangeError for invalid time zone', () => {
    const now = new Date('2026-10-06T00:00:00Z');

    expect(() => greetingPeriod(now, 'Invalid/TimeZone')).toThrow(RangeError);
  });
});
