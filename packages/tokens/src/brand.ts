import { contrastRatio, mix, normalizeHex } from './color';
import { colors } from './colors';

export { contrastRatio, mix };

export type BrandMode = 'light' | 'dark';

export type DerivedBrand = {
  /** Brand colour for buttons and active states; adjusted so the ink on it passes 4.5:1. */
  brand: string;
  brandStrong: string;
  brandSoft: string;
  rail: string;
  rail2: string;
  /** Text colour on `brand`. */
  brandInk: string;
  /** The school's own colour, for decoration (unadjusted, legacy colours mapped). */
  decoration: string;
};

const MIN_CONTRAST = 4.5;
/** Older prototypes saved these; they map to the default brand colour. */
const LEGACY = new Set(['#2F6FED', '#A0412D']);
const DEFAULT_BRAND = colors.light.brand;

const BASE = {
  light: { surface: '#FFFFFF', rail: colors.light.rail, ink: '#FFFFFF' },
  dark: { surface: colors.dark.surface, rail: colors.dark.rail, ink: colors.dark['brand-ink'] },
} as const;
const RAIL_2_BASE = colors.light['rail-2'];

/**
 * Derives the brand variables from a school's colour (spec 03 "School brand colour").
 * Light mode puts white text on the brand and darkens the colour until it passes 4.5:1.
 * Dark mode (not in the spec) puts the dark surface colour on the brand and lightens it instead.
 */
export function deriveBrand(hex: string, mode: BrandMode): DerivedBrand {
  const normalized = normalizeHex(hex);
  const decoration = LEGACY.has(normalized) ? DEFAULT_BRAND : normalized;
  const base = BASE[mode];

  let brand = decoration;
  const target = mode === 'light' ? '#000000' : '#FFFFFF';
  for (
    let share = 0.99;
    contrastRatio(base.ink, brand) < MIN_CONTRAST && share >= 0;
    share -= 0.01
  ) {
    brand = mix(decoration, share, target);
  }

  return {
    brand,
    brandStrong: mix(brand, 0.8, '#000000'),
    brandSoft: mix(brand, 0.13, base.surface),
    rail: mix(brand, 0.06, base.rail),
    rail2: mix(brand, 0.1, RAIL_2_BASE),
    brandInk: base.ink,
    decoration,
  };
}
