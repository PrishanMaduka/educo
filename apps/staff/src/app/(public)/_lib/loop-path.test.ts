import { describe, expect, it } from 'vitest';

import { curveSegments, loopPath } from './loop-path';

describe('curveSegments', () => {
  it('draws one segment between each pair, and back to the start when closed', () => {
    const square = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ] as const;
    expect(curveSegments(square, false)).toHaveLength(3);
    const closed = curveSegments(square, true);
    expect(closed).toHaveLength(4);
    expect(closed[3]).toMatch(/^M0 10C.* 0 0$/);
  });
});

describe('loopPath', () => {
  it('closes the loop when picture 4 sits beside picture 2 (wide layout)', () => {
    const path = loopPath([
      [200, 50],
      [350, 200],
      [200, 350],
      [50, 200],
    ]);
    expect(path?.closed).toBe(true);
    expect(path?.segments).toHaveLength(4);
    // Drawn 42 % towards the middle (200, 200): picture 1 at (200, 113).
    expect(path?.segments[0]).toMatch(/^M200 113/);
  });

  it('runs down the side and returns to 1 with a dotted line when stacked', () => {
    const path = loopPath([
      [80, 50],
      [80, 200],
      [80, 350],
      [80, 500],
    ]);
    expect(path?.closed).toBe(false);
    expect(path?.segments).toHaveLength(4);
    expect(path?.segments[3]).toMatch(/^M80 500C80 540 -9 540 -9 480V70/);
    expect(path?.route.match(/M/g)).toHaveLength(1);
  });

  it('needs all four pictures', () => {
    expect(loopPath([[0, 0]])).toBeNull();
  });
});
