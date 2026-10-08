import { describe, expect, it } from 'vitest';

import {
  CYCLE_MS,
  feedMoment,
  hasLanded,
  isSenderLit,
  PHONE_TARGET,
  ringArcs,
  tokenFlight,
  visibleFeed,
} from './hero-feed';

const feed = ['okafor', 'priya', 'asha', 'haddad', 'tanaka', 'daniel'];

describe('visibleFeed', () => {
  it('opens with two messages, newest first', () => {
    expect(visibleFeed(feed, 2)).toEqual(['priya', 'okafor']);
  });

  it('keeps only the three newest', () => {
    expect(visibleFeed(feed, 5)).toEqual(['tanaka', 'haddad', 'asha']);
    expect(visibleFeed(feed, 6)).toEqual(['daniel', 'tanaka', 'haddad']);
  });
});

describe('feedMoment', () => {
  it('starts with the third message on its way, one per 3.4 s, round again after the sixth', () => {
    expect(CYCLE_MS).toBe(3400);
    expect(feedMoment(0, 6)).toEqual({ cycle: 0, index: 2, phase: 0 });
    expect(feedMoment(3400 * 3 + 500, 6)).toEqual({ cycle: 3, index: 5, phase: 0.5 });
    expect(feedMoment(3400 * 4, 6).index).toBe(0);
  });

  it('lights the sender first and lands the message once the token arrives', () => {
    expect(isSenderLit(0.2)).toBe(true);
    expect(isSenderLit(1.7)).toBe(false);
    expect(hasLanded(1.4)).toBe(false);
    expect(hasLanded(1.5)).toBe(true);
  });
});

describe('tokenFlight', () => {
  it('is only in the air between 0.25 s and 1.5 s', () => {
    expect(tokenFlight([6, 14], 0.1)).toBeNull();
    expect(tokenFlight([6, 14], 1.6)).toBeNull();
    expect(tokenFlight([6, 14], 0.8)).not.toBeNull();
  });

  it('leaves the sender, arches over and arrives at the phone', () => {
    const start = tokenFlight([6, 14], 0.2501);
    expect(start?.x).toBeCloseTo(6, 1);
    expect(start?.y).toBeCloseTo(14, 1);
    const end = tokenFlight([6, 14], 1.4999);
    expect(end?.x).toBeCloseTo(PHONE_TARGET[0], 0);
    expect(end?.y).toBeCloseTo(PHONE_TARGET[1], 0);
    const middle = tokenFlight([6, 14], 0.85);
    expect(middle?.y).toBeLessThan(14);
    expect(middle?.scale).toBeCloseTo(1.5, 1);
  });
});

describe('ringArcs', () => {
  it('splits the ring into one arc per message with gaps', () => {
    const arcs = ringArcs(6, 27);
    const circumference = 2 * Math.PI * 27;
    expect(arcs).toHaveLength(6);
    expect(arcs[0]?.offset).toBeCloseTo(0);
    expect(arcs[3]?.offset).toBeCloseTo((-3 * circumference) / 6);
    expect(arcs[0]?.dash.startsWith(String(circumference / 6 - 5))).toBe(true);
  });
});
