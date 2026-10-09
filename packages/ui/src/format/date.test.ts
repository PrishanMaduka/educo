import { describe, expect, it } from 'vitest';

import { formatDate } from './date';

describe('formatDate', () => {
  const d = new Date('2026-10-05T10:00:00Z');
  it('formats the three styles', () => {
    expect(formatDate(d, 'Asia/Colombo', 'short')).toBe('5 Oct');
    expect(formatDate(d, 'Asia/Colombo', 'long')).toBe('5 October 2026');
    expect(formatDate(d, 'Asia/Colombo', 'weekday')).toBe('Monday 5 October');
  });
  it('uses the school time zone, not the machine one', () => {
    const lateUtc = new Date('2026-10-05T20:00:00Z');
    expect(formatDate(lateUtc, 'Asia/Colombo', 'short')).toBe('6 Oct');
    expect(formatDate(lateUtc, 'UTC', 'short')).toBe('5 Oct');
  });
  it('adds the school-local time, 24-hour, with dateTime', () => {
    expect(formatDate(d, 'Asia/Colombo', 'dateTime')).toBe('5 October 2026, 15:30');
    expect(formatDate('2026-10-05T20:05:00Z', 'Asia/Colombo', 'dateTime')).toBe(
      '6 October 2026, 01:35',
    );
  });
  it('accepts ISO strings', () => {
    expect(formatDate('2026-10-05T10:00:00Z', 'Asia/Colombo', 'long')).toBe('5 October 2026');
  });
});
