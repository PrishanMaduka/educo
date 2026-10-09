import { describe, expect, it } from 'vitest';

import { formatRelative } from './relative';

const NOW = new Date('2026-10-09T06:00:00Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const MIN = 60_000;

describe('formatRelative', () => {
  it.each([
    [ago(20_000), 'now'],
    [ago(10 * MIN), '10 minutes ago'],
    [ago(60 * MIN), '1 hour ago'],
    [ago(5 * 60 * MIN), '5 hours ago'],
    [ago(24 * 60 * MIN), 'yesterday'],
    [ago(2 * 24 * 60 * MIN), '2 days ago'],
    [ago(6 * 24 * 60 * MIN), '6 days ago'],
  ])('says %s is %s', (at, expected) => {
    expect(formatRelative(at, NOW, 'Asia/Colombo')).toBe(expected);
  });

  it('gives the date in the school’s time zone from a week back', () => {
    expect(formatRelative('2026-09-30T20:00:00Z', NOW, 'Asia/Colombo')).toBe('1 Oct');
  });

  it('treats a time a little ahead of the clock as now', () => {
    expect(formatRelative(new Date(NOW.getTime() + 5_000), NOW, 'Asia/Colombo')).toBe('now');
  });
});
