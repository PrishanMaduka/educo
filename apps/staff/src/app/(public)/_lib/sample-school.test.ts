import { describe, expect, it } from 'vitest';

import { heatStep } from './sample-school';

describe('heatStep', () => {
  it.each([
    [58, 0],
    [69, 0],
    [70, 1],
    [79, 1],
    [80, 2],
    [89, 2],
    [90, 3],
    [100, 3],
  ])('puts %i%% in step %i', (percent, step) => {
    expect(heatStep(percent)).toBe(step);
  });
});
