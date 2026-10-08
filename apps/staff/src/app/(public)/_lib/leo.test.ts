import { describe, expect, it } from 'vitest';

import { leoBars } from './leo';

describe('leoBars', () => {
  it('shows four steady weeks, then four slipping weeks before a plan', () => {
    expect(leoBars(false).map((bar) => bar.tone)).toEqual([
      'steady',
      'steady',
      'steady',
      'steady',
      'down',
      'down',
      'down',
      'down',
    ]);
    expect(leoBars(false).at(-1)?.height).toBe(50);
  });

  it('shows the last two weeks back up after the plan', () => {
    const after = leoBars(true);
    expect(after.map((bar) => bar.tone).slice(4)).toEqual(['steady', 'steady', 'up', 'up']);
    expect(after.at(-1)?.height).toBe(92);
  });
});
