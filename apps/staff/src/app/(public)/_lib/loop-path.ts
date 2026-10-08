/*
 * The painted loop in "How the circle works" (spec 19 §5): a brush-stroke path through the four
 * pictures, clockwise from 1 and back to 1. Above 620 px the pictures sit round a circle, so the
 * path is closed; at 620 px and below they stack, so it runs down the side and a dotted line
 * returns to 1.
 */

export type Point = readonly [number, number];

/** Catmull-Rom-like cubic segments through the points (one `M…C…` path per segment). */
export function curveSegments(points: readonly Point[], closed: boolean): string[] {
  const n = points.length;
  const at = (i: number): Point => {
    const index = closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i));
    return points[index] ?? [0, 0];
  };
  const segments: string[] = [];
  for (let i = 0; i < (closed ? n : n - 1); i += 1) {
    const [a, b, c, d] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    segments.push(
      `M${b[0]} ${b[1]}C${b[0] + (c[0] - a[0]) / 5} ${b[1] + (c[1] - a[1]) / 5} ${c[0] - (d[0] - b[0]) / 5} ${c[1] - (d[1] - b[1]) / 5} ${c[0]} ${c[1]}`,
    );
  }
  return segments;
}

export interface LoopPath {
  /** Each brush stroke; the last one is the dotted return when `closed` is false. */
  segments: string[];
  closed: boolean;
  /** The whole route as one path, for the travelling glint. */
  route: string;
}

/**
 * The loop through the centres of pictures 1–4. When 4 sits beside 2 (wide layout), the points
 * are drawn 42 % towards the middle and the loop closes; otherwise a return line runs up the left.
 */
export function loopPath(centres: readonly Point[]): LoopPath | null {
  const [p1, p2, p3, p4] = centres;
  if (!p1 || !p2 || !p3 || !p4) return null;
  const closed = p4[1] < p3[1] - 10;
  let points: readonly Point[] = centres;
  if (closed) {
    const mx = (p2[0] + p4[0]) / 2;
    const my = (p1[1] + p3[1]) / 2;
    points = centres.map(([x, y]): Point => [x + (mx - x) * 0.42, y + (my - y) * 0.42]);
  }
  const segments = curveSegments(points, closed);
  if (!closed) {
    const [f, l] = [points[0] ?? p1, points[3] ?? p4];
    const x = -9;
    segments.push(
      `M${l[0]} ${l[1]}C${l[0]} ${l[1] + 40} ${x} ${l[1] + 40} ${x} ${l[1] - 20}V${f[1] + 20}C${x} ${f[1] - 40} ${f[0]} ${f[1] - 50} ${f[0]} ${f[1] - 30}`,
    );
  }
  const route = segments.map((d, i) => (i === 0 ? d : d.replace(/^M[^C]+/, ''))).join('');
  return { segments, closed, route };
}
