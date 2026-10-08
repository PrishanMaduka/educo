/*
 * The hero's ticker and glints (spec 19): every 3.2 s a glint travels from one kite, past Amaya,
 * to another, and the ticker says what just happened.
 */

export const TICKER_INTERVAL_MS = 3200;

/** How long one glint takes to travel. */
export const GLINT_DURATION_MS = 2200;

/** The event after `index`, wrapping round to the first. */
export function nextEvent(index: number, count: number): number {
  return count <= 0 ? 0 : (index + 1) % count;
}

type Point = readonly [number, number];

/**
 * Where a glint is at `progress` (0..1) on its way from `from`, past `via`, to `to`: a quadratic
 * curve with ease-in-out, fading in quickly and out over the last 15 %.
 */
export function glintAt(
  from: Point,
  via: Point,
  to: Point,
  progress: number,
): { at: [number, number]; opacity: number } {
  const k = Math.min(1, Math.max(0, progress));
  const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
  const u = 1 - e;
  const along = (i: 0 | 1) => u * u * from[i] + 2 * u * e * via[i] + e * e * to[i];
  const opacity = k > 0.85 ? (1 - k) / 0.15 : Math.min(1, k * 8);
  return { at: [along(0), along(1)], opacity };
}
