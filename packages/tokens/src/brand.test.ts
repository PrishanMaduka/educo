import { describe, expect, it } from 'vitest';

import {
  BRAND_BASE,
  BRAND_PALETTE,
  DEFAULT_BRAND,
  contrastRatio,
  deriveBrand,
  mix,
  type BrandMode,
} from './brand';

const MODES: readonly BrandMode[] = ['light', 'dark'];

describe('contrastRatio', () => {
  it.each([
    ['#000000', '#FFFFFF', 21],
    ['#FFFFFF', '#FFFFFF', 1],
    ['#767676', '#FFFFFF', 4.54],
  ])('%s on %s is %d:1', (a, b, ratio) => {
    expect(contrastRatio(a, b)).toBeCloseTo(ratio, 2);
  });
});

describe('mix', () => {
  it.each([
    ['#FFFFFF', 0.5, '#000000', '#808080'],
    ['#DD4A42', 1, '#000000', '#DD4A42'],
    ['#C8F169', 0.86, '#FFFFFF', '#D0F37E'],
  ])('mix(%s, %d, %s) is %s', (a, share, b, out) => {
    expect(mix(a, share, b)).toBe(out);
  });
});

describe('the named palette (brand.js PALETTE)', () => {
  it('offers Quad lime first as the default, then the named school colours', () => {
    expect(BRAND_PALETTE.map((p) => p.hex)).toEqual([
      '#C8F169',
      '#1B7F53',
      '#7A1F3D',
      '#F2B705',
      '#0F7C86',
      '#3B4AA8',
      '#D9640B',
      '#5B3FA8',
    ]);
    expect(BRAND_PALETTE[0]).toEqual({ hex: DEFAULT_BRAND, name: 'Quad lime (default)' });
    expect(DEFAULT_BRAND).toBe('#C8F169');
  });
});

describe('deriveBrand: the default colour', () => {
  it.each([
    ['no colour', null],
    ['an empty value', ''],
    ['an invalid value', 'blue'],
    ['the legacy blue', '#2F6FED'],
    ['the legacy brown, any case', '#a0412d'],
  ])('maps %s to Quad lime', (_, input) => {
    expect(deriveBrand(input, 'light').raw).toBe('#C8F169');
  });

  it.each([
    ['#DD4A42', '#DD4A42'],
    ['#2bb0a0', '#2BB0A0'],
    ['1B7F53', '#1B7F53'],
  ])('keeps a saved colour %s as %s', (input, raw) => {
    expect(deriveBrand(input, 'light').raw).toBe(raw);
  });
});

/** Spec 03 "Worked examples" and the default block in design/system/tokens.css. */
describe('deriveBrand: worked examples', () => {
  it.each([
    // colour, mode, fill, ink, fillStrong, text, soft, railActive, railActiveInk
    [
      '#C8F169',
      'light',
      '#C8F169',
      '#101632',
      '#D0F37E',
      '#5E7131',
      '#F6FDE7',
      '#C8F169',
      '#101632',
    ],
    [
      '#C8F169',
      'dark',
      '#C8F169',
      '#101632',
      '#D0F37E',
      '#C8F169',
      '#37434B',
      '#C8F169',
      '#101632',
    ],
    [
      '#1B7F53',
      'light',
      '#1B7F53',
      '#FFFFFF',
      undefined,
      '#19764D',
      '#DBEBE3',
      '#1B7F53',
      '#FFFFFF',
    ],
    [
      '#1B7F53',
      'dark',
      '#1B7F53',
      '#FFFFFF',
      undefined,
      '#5DA485',
      '#183148',
      '#1B7F53',
      '#FFFFFF',
    ],
    [
      '#7A1F3D',
      'light',
      '#7A1F3D',
      '#FFFFFF',
      undefined,
      '#7A1F3D',
      '#EADBE0',
      '#964E66',
      '#FFFFFF',
    ],
    [
      '#7A1F3D',
      'dark',
      '#9B576E',
      '#FFFFFF',
      undefined,
      '#B58292',
      '#2B1D43',
      '#924760',
      '#FFFFFF',
    ],
    [
      '#D9640B',
      'light',
      '#BF580A',
      '#FFFFFF',
      undefined,
      '#A94E09',
      '#F9E6D8',
      '#BF580A',
      '#FFFFFF',
    ],
    [
      '#D9640B',
      'dark',
      '#BF580A',
      '#FFFFFF',
      undefined,
      '#E08037',
      '#3E2B39',
      '#BF580A',
      '#FFFFFF',
    ],
  ] as const)(
    '%s in %s',
    (colour, mode, fill, ink, fillStrong, text, soft, railActive, railActiveInk) => {
      const d = deriveBrand(colour, mode);
      expect(d.raw).toBe(colour);
      expect(d.fill).toBe(fill);
      expect(d.ink).toBe(ink);
      if (fillStrong) expect(d.fillStrong).toBe(fillStrong);
      expect(d.text).toBe(text);
      expect(d.soft).toBe(soft);
      expect(d.railActive).toBe(railActive);
      expect(d.railActiveInk).toBe(railActiveInk);
    },
  );
});

describe('deriveBrand: steps', () => {
  it('lifts a deep colour toward white in dark mode until it is 3:1 on the card', () => {
    const d = deriveBrand('#7A1F3D', 'dark');
    expect(contrastRatio('#7A1F3D', BRAND_BASE.dark.surface)).toBeLessThan(3);
    expect(contrastRatio(d.fill, BRAND_BASE.dark.surface)).toBeGreaterThanOrEqual(3);
  });

  it('does not lift in light mode', () => {
    expect(deriveBrand('#7A1F3D', 'light').fill).toBe('#7A1F3D');
  });

  it.each([
    ['#C8F169', '#101632'],
    ['#F2B705', '#101632'],
    ['#FFFF00', '#101632'],
    ['#1B7F53', '#FFFFFF'],
    ['#3B4AA8', '#FFFFFF'],
  ])('chooses %s ink as %s (white when the colour carries it 3:1)', (colour, ink) => {
    expect(deriveBrand(colour, 'light').ink).toBe(ink);
  });

  it('moves the hover fill further from the ink, so contrast only goes up', () => {
    for (const mode of MODES) {
      for (const { hex } of BRAND_PALETTE) {
        const d = deriveBrand(hex, mode);
        expect(contrastRatio(d.fillStrong, d.ink)).toBeGreaterThanOrEqual(
          contrastRatio(d.fill, d.ink),
        );
      }
    }
  });

  it('keeps brand-raw as the saved colour, unchanged', () => {
    expect(deriveBrand('#7A1F3D', 'dark').raw).toBe('#7A1F3D');
  });
});

/** Spec 03 "Guarantees, for any input colour in both themes". */
function expectGuarantees(colour: string, mode: BrandMode): void {
  const d = deriveBrand(colour, mode);
  const base = BRAND_BASE[mode];
  const at = `${colour} ${mode}`;
  // Button and badge text 4.5:1 on the fill and the hover fill.
  expect(contrastRatio(d.fill, d.ink), at).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(d.fillStrong, d.ink), at).toBeGreaterThanOrEqual(4.5);
  // Brand text and icons 4.5:1 on every page surface and on brand-soft.
  for (const bg of [base.surface, base.canvas, base.surface2, d.soft]) {
    expect(contrastRatio(d.text, bg), at).toBeGreaterThanOrEqual(4.5);
  }
  // Captions (ink-3) 4.5:1 on brand-soft.
  expect(contrastRatio(base.ink3, d.soft), at).toBeGreaterThanOrEqual(4.5);
  // The active side-bar item 3:1 against the bar, with 4.5:1 text.
  expect(contrastRatio(d.railActive, base.rail), at).toBeGreaterThanOrEqual(3);
  expect(contrastRatio(d.railActive, d.railActiveInk), at).toBeGreaterThanOrEqual(4.5);
  // Dark-mode fills 3:1 against cards.
  if (mode === 'dark') {
    expect(contrastRatio(d.fill, base.surface), at).toBeGreaterThanOrEqual(3);
  }
  // The measured checks agree.
  expect(d.checks.ink, at).toBeGreaterThanOrEqual(4.5);
  expect(d.checks.text, at).toBeGreaterThanOrEqual(4.5);
  expect(d.checks.rail, at).toBeGreaterThanOrEqual(4.5);
}

/** A small deterministic generator (mulberry32), so the sweep is the same on every run. */
function seededColours(seed: number, count: number): string[] {
  let state = seed;
  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return Array.from(
    { length: count },
    () =>
      `#${Math.floor(next() * 0x1000000)
        .toString(16)
        .padStart(6, '0')
        .toUpperCase()}`,
  );
}

describe('deriveBrand: contrast guarantees', () => {
  const EDGES = [
    '#FFFFFF',
    '#FEFEFE',
    '#000000',
    '#010101',
    '#FFFF00',
    '#101632',
    '#DD4A42',
    '#2BB0A0',
    '#808080',
  ];
  const COLOURS = [...BRAND_PALETTE.map((p) => p.hex), ...EDGES];
  const cases = MODES.flatMap((mode) => COLOURS.map((colour) => [colour, mode] as const));

  it.each(cases)('%s in %s meets every limit', (colour, mode) => {
    expectGuarantees(colour, mode);
  });

  it('holds for 400 seeded colours in both themes', () => {
    for (const colour of seededColours(20261010, 400)) {
      for (const mode of MODES) expectGuarantees(colour, mode);
    }
  });
});
