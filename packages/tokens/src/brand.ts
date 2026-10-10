import { contrastRatio, mix, parseHex } from './color';

export { contrastRatio, mix };

export type BrandMode = 'light' | 'dark';

/** The derived brand tokens for one theme (spec 03 "School brand colour"). */
export type DerivedBrand = {
  /** `brand-raw`: the saved colour (legacy and invalid values mapped to the default). */
  raw: string;
  /** `brand-fill` (and `brand`): primary buttons, the active tab, badges, checked controls. */
  fill: string;
  /** `brand-fill-strong` (and `brand-strong`): hover on the fill. */
  fillStrong: string;
  /** `brand-ink`: text on the fill, white or navy. */
  ink: string;
  /** `brand-text`: the brand as text, links and icons. */
  text: string;
  /** `brand-soft`: the tint for selected rows, chips and icon tiles. */
  soft: string;
  /** `rail-active`: the active side-bar item. */
  railActive: string;
  /** `rail-active-ink`: text on `rail-active`. */
  railActiveInk: string;
  /** The measured contrast of the ink on the fill, the text on its worst surface and the rail ink. */
  checks: { ink: number; text: number; rail: number };
};

const NAVY = '#101632';
const WHITE = '#FFFFFF';
const BLACK = '#000000';

/** Quad lime: the colour of a school that has not picked one, and of the console. */
export const DEFAULT_BRAND = '#C8F169';

/** The page surfaces, side bar and caption colour each theme derives against (spec 03). */
export const BRAND_BASE = {
  light: {
    surface: '#FFFFFF',
    canvas: '#F7F5F0',
    surface2: '#F0EEE7',
    rail: '#101632',
    ink3: '#5A5F7B',
  },
  dark: {
    surface: '#171D45',
    canvas: '#0F1330',
    surface2: '#1D2550',
    rail: '#0A0D24',
    ink3: '#A9ACC8',
  },
} as const satisfies Record<BrandMode, Record<string, string>>;

/** Colours older prototypes saved; they map to the default. */
const LEGACY = new Set(['#2F6FED', '#A0412D']);

/** The named colours offered in the console's Branding, Quad lime first (brand.js `PALETTE`). */
export const BRAND_PALETTE = [
  { hex: '#C8F169', name: 'Quad lime (default)' },
  { hex: '#1B7F53', name: 'Greenfield green' },
  { hex: '#7A1F3D', name: 'Maroon' },
  { hex: '#F2B705', name: 'Sunflower' },
  { hex: '#0F7C86', name: 'Teal' },
  { hex: '#3B4AA8', name: 'Indigo' },
  { hex: '#D9640B', name: 'Orange' },
  { hex: '#5B3FA8', name: 'Violet' },
] as const;

/** The colour a school's saved value stands for: the default when none, invalid or legacy. */
export function resolveBrandColour(saved: string | null | undefined): string {
  const hex = parseHex(saved);
  return hex === null || LEGACY.has(hex) ? DEFAULT_BRAND : hex;
}

/** Moves `colour` toward `target` one percent at a time until `ok` passes (or it reaches the target). */
function toward(colour: string, target: string, ok: (c: string) => boolean): string {
  let current = colour;
  for (let share = 1; !ok(current) && share > 0; share = Math.round((share - 0.01) * 100) / 100) {
    current = mix(colour, share, target);
  }
  return ok(current) ? current : target;
}

/** White text when the colour can carry it (3:1 before adjusting), otherwise navy. */
const inkFor = (fill: string): string => (contrastRatio(fill, WHITE) >= 3 ? WHITE : NAVY);
const awayFrom = (ink: string): string => (ink === WHITE ? BLACK : WHITE);
const solid = (colour: string, ink: string): string =>
  toward(colour, awayFrom(ink), (f) => contrastRatio(f, ink) >= 4.5);
const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Turns a school's colour into the brand tokens for one theme, keeping WCAG AA for any input
 * (spec 03 "School brand colour"; a port of `design/system/brand.js`).
 */
export function deriveBrand(saved: string | null | undefined, mode: BrandMode): DerivedBrand {
  const base = BRAND_BASE[mode];
  const raw = resolveBrandColour(saved);

  // 1. Dark only: lift toward white until the colour stands out 3:1 from the card.
  const lifted =
    mode === 'dark' ? toward(raw, WHITE, (f) => contrastRatio(f, base.surface) >= 3) : raw;
  // 2–4. Ink, then the fill moved away from the ink until 4.5:1, and the hover a little further.
  const ink = inkFor(lifted);
  const fill = solid(lifted, ink);
  const fillStrong = mix(fill, 0.86, awayFrom(ink));

  // 5. The tint: 16% (light) or 20% (dark), lowered until ink-3 captions still read 4.5:1 on it.
  let share = mode === 'light' ? 0.16 : 0.2;
  let soft = mix(raw, share, base.surface);
  while (contrastRatio(base.ink3, soft) < 4.5 && share > 0.02) {
    share = Math.round((share - 0.01) * 100) / 100;
    soft = mix(raw, share, base.surface);
  }

  // 6. Brand text: toward black (light) or white (dark) until 4.5:1 on every surface and the tint.
  const surfaces = [base.surface, base.canvas, base.surface2, soft];
  const text = toward(raw, mode === 'light' ? BLACK : WHITE, (f) =>
    surfaces.every((bg) => contrastRatio(f, bg) >= 4.5),
  );

  // 7. The active side-bar item: lifted until 3:1 against the navy bar, then ink and fill as above.
  const railLift = toward(raw, WHITE, (f) => contrastRatio(f, base.rail) >= 3);
  const railActiveInk = inkFor(railLift);
  const railActive = solid(railLift, railActiveInk);

  return {
    raw,
    fill,
    fillStrong,
    ink,
    text,
    soft,
    railActive,
    railActiveInk,
    checks: {
      ink: round2(contrastRatio(fill, ink)),
      text: round2(Math.min(...surfaces.map((bg) => contrastRatio(text, bg)))),
      rail: round2(contrastRatio(railActive, railActiveInk)),
    },
  };
}
