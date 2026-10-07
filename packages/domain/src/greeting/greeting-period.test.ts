import { describe, it, expect } from 'vitest';

import { greetingPeriod } from './greeting-period';

// Keep the bands in sync with the parent app's offline fallback,
// apps/parent/lib/core/greeting.dart (cases in apps/parent/test/core/greeting_test.dart).
describe('greetingPeriod', () => {
  const timeZone = 'Asia/Colombo';

  describe('table-driven test cases', () => {
    it.each<{
      iso: string;
      localTime: string;
      period: 'morning' | 'afternoon' | 'evening' | 'night';
      word: string;
    }>([
      { iso: '2026-10-05T23:29:00Z', localTime: '04:59', period: 'night', word: 'Hello' },
      { iso: '2026-10-05T23:30:00Z', localTime: '05:00', period: 'morning', word: 'Good morning' },
      { iso: '2026-10-06T06:29:00Z', localTime: '11:59', period: 'morning', word: 'Good morning' },
      {
        iso: '2026-10-06T06:30:00Z',
        localTime: '12:00',
        period: 'afternoon',
        word: 'Good afternoon',
      },
      {
        iso: '2026-10-06T11:29:00Z',
        localTime: '16:59',
        period: 'afternoon',
        word: 'Good afternoon',
      },
      { iso: '2026-10-06T11:30:00Z', localTime: '17:00', period: 'evening', word: 'Good evening' },
      { iso: '2026-10-06T14:29:00Z', localTime: '19:59', period: 'evening', word: 'Good evening' },
      { iso: '2026-10-06T14:30:00Z', localTime: '20:00', period: 'night', word: 'Good evening' },
      { iso: '2026-10-06T18:29:00Z', localTime: '23:59', period: 'night', word: 'Good evening' },
      { iso: '2026-10-05T18:30:00Z', localTime: '00:00', period: 'night', word: 'Hello' },
    ])(
      'at $localTime is $period with "$word"',
      ({ iso, period: expectedPeriod, word: expectedWord }) => {
        const now = new Date(iso);
        const result = greetingPeriod(now, timeZone);

        expect(result.period).toBe(expectedPeriod);
        expect(result.word).toBe(expectedWord);
      },
    );
  });

  it('treats a UTC time on the previous calendar day as local morning in Colombo', () => {
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
