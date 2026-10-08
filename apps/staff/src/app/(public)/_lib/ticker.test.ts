import { describe, expect, it } from 'vitest';

import { glintAt, nextEvent, TICKER_INTERVAL_MS } from './ticker';

describe('nextEvent', () => {
  it('moves to the next event and wraps round after the last', () => {
    expect(nextEvent(0, 6)).toBe(1);
    expect(nextEvent(4, 6)).toBe(5);
    expect(nextEvent(5, 6)).toBe(0);
  });

  it('stays on the only event, and on 0 when there are none', () => {
    expect(nextEvent(0, 1)).toBe(0);
    expect(nextEvent(0, 0)).toBe(0);
  });

  it('cycles every 3.2 seconds (spec 19)', () => {
    expect(TICKER_INTERVAL_MS).toBe(3200);
  });
});

describe('glintAt', () => {
  const from = [100, 100] as const;
  const via = [200, 300] as const;
  const to = [300, 100] as const;

  it('starts at the sender, passes the child and ends at the receiver', () => {
    expect(glintAt(from, via, to, 0).at).toEqual([100, 100]);
    expect(glintAt(from, via, to, 1).at).toEqual([300, 100]);
    const middle = glintAt(from, via, to, 0.5).at;
    expect(middle[0]).toBeCloseTo(200);
    expect(middle[1]).toBeCloseTo(200);
  });

  it('fades in quickly and out over the last 15%', () => {
    expect(glintAt(from, via, to, 0).opacity).toBe(0);
    expect(glintAt(from, via, to, 0.5).opacity).toBe(1);
    expect(glintAt(from, via, to, 0.925).opacity).toBeCloseTo(0.5);
    expect(glintAt(from, via, to, 1).opacity).toBe(0);
  });

  it('clamps progress outside 0..1', () => {
    expect(glintAt(from, via, to, 2).at).toEqual([300, 100]);
    expect(glintAt(from, via, to, -1).at).toEqual([100, 100]);
  });
});
