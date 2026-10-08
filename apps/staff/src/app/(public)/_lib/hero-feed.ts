/*
 * The hero's phone (spec 19): moments arrive from Maya's circle one by one. Every 3.4 s someone
 * lights up, a star or heart flies from them to the phone, and their message lands on top of
 * Maya's day. These pure functions drive it; HeroStage draws it.
 */

/** One cycle: the sender lights up, the token flies, the message lands. */
export const CYCLE_MS = 3400;

/** The phone opens with this many messages already in. */
export const FIRST_SHOWN = 2;

/** How many messages the phone shows at once. */
export const FEED_ROWS = 3;

/** The newest `rows` of the first `shown` messages, newest first. */
export function visibleFeed<T>(items: readonly T[], shown: number, rows = FEED_ROWS): T[] {
  return items.slice(0, shown).reverse().slice(0, rows);
}

export interface FeedMoment {
  /** Which cycle this is, counting from 0. */
  cycle: number;
  /** The message on its way (index into the feed). */
  index: number;
  /** Seconds into the cycle. */
  phase: number;
}

/** Where the loop is `elapsed` ms after it started. */
export function feedMoment(elapsed: number, count: number): FeedMoment {
  const t = Math.max(0, elapsed);
  const cycle = Math.floor(t / CYCLE_MS);
  return { cycle, index: (cycle + FIRST_SHOWN) % count, phase: (t - cycle * CYCLE_MS) / 1000 };
}

/** The sender is lit for the first 1.6 s of a cycle. */
export const isSenderLit = (phase: number): boolean => phase < 1.6;

/** The message lands once the token arrives. */
export const hasLanded = (phase: number): boolean => phase > 1.45;

type Point = readonly [x: number, y: number];

/** The phone's screen, where tokens land (percent of the stage). */
export const PHONE_TARGET: Point = [50, 44];

/**
 * The token between 0.25 s and 1.5 s into a cycle: an eased curve from the sender to the phone,
 * arching above both, spinning once and swelling on the way. Null when it is not in the air.
 */
export function tokenFlight(
  from: Point,
  phase: number,
  to: Point = PHONE_TARGET,
): { x: number; y: number; rotate: number; scale: number } | null {
  if (phase <= 0.25 || phase >= 1.5) return null;
  const k = Math.min(1, Math.max(0, (phase - 0.25) / 1.2));
  const u = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
  const w = 1 - u;
  const control: Point = [(from[0] + to[0]) / 2, Math.min(from[1], to[1]) - 20];
  return {
    x: w * w * from[0] + 2 * w * u * control[0] + u * u * to[0],
    y: w * w * from[1] + 2 * w * u * control[1] + u * u * to[1],
    rotate: u * 360,
    scale: 1 + Math.sin(u * Math.PI) * 0.5,
  };
}

/** The day ring around Maya: one coloured arc per message, with a small gap between arcs. */
export function ringArcs(count: number, radius = 27): { dash: string; offset: number }[] {
  const circumference = 2 * Math.PI * radius;
  const arc = circumference / count;
  return Array.from({ length: count }, (_, i) => ({
    dash: `${arc - 5} ${circumference}`,
    offset: -i * arc,
  }));
}
