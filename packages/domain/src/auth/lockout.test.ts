import { describe, expect, it } from 'vitest';

import {
  LOCKOUT_FAILURES,
  LOCKOUT_MINUTES,
  LOCKOUT_WINDOW_MINUTES,
  isLockedAt,
  lockoutState,
} from './lockout';

const MINUTE = 60_000;
const NOW = new Date(Date.UTC(2026, 9, 8, 9, 30));
const ago = (ms: number) => new Date(NOW.getTime() - ms);

describe('lockoutState (spec 05 step 7)', () => {
  it('locks after five failures in 15 minutes, for 15 minutes', () => {
    expect(LOCKOUT_FAILURES).toBe(5);
    expect(LOCKOUT_WINDOW_MINUTES).toBe(15);
    expect(LOCKOUT_MINUTES).toBe(15);
  });

  it.each<[string, readonly Date[], boolean, number]>([
    ['no failures', [], false, 0],
    ['four failures just now', [NOW, NOW, NOW, NOW], false, 4],
    ['exactly five failures just now', [NOW, NOW, NOW, NOW, NOW], true, 5],
    ['six failures', [NOW, NOW, NOW, NOW, NOW, NOW], true, 6],
    [
      'five failures, the oldest 14:59 ago',
      [ago(14 * MINUTE + 59_000), ago(MINUTE), ago(MINUTE), NOW, NOW],
      true,
      5,
    ],
    [
      'five failures, the oldest exactly 15:00 ago (outside the window)',
      [ago(15 * MINUTE), ago(MINUTE), ago(MINUTE), NOW, NOW],
      false,
      4,
    ],
    [
      'five failures, the oldest 15:01 ago',
      [ago(15 * MINUTE + 1000), NOW, NOW, NOW, NOW],
      false,
      4,
    ],
    ['five old failures', Array.from({ length: 5 }, () => ago(20 * MINUTE)), false, 0],
  ])('%s', (_name, failures, locked, recentFailures) => {
    const state = lockoutState(failures, NOW);
    expect(state.locked).toBe(locked);
    expect(state.recentFailures).toBe(recentFailures);
    expect(state.lockedUntil).toEqual(locked ? new Date(NOW.getTime() + 15 * MINUTE) : null);
  });

  it('ignores failures stamped after now (clock skew)', () => {
    const later = new Date(NOW.getTime() + MINUTE);
    expect(lockoutState([later, later, later, later, later], NOW).locked).toBe(false);
  });

  it('does not change its input', () => {
    const failures = Object.freeze([NOW, NOW]);
    lockoutState(failures, NOW);
    expect(failures).toHaveLength(2);
  });
});

describe('isLockedAt', () => {
  it.each<[string, Date | null, boolean]>([
    ['never locked', null, false],
    ['locked until a minute from now', new Date(NOW.getTime() + MINUTE), true],
    ['the lock ends exactly now', NOW, false],
    ['the lock ended a minute ago', ago(MINUTE), false],
  ])('%s', (_name, lockedUntil, locked) => {
    expect(isLockedAt(lockedUntil, NOW)).toBe(locked);
  });
});
