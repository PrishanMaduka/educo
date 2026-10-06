import { contrastRatio, mix, normalizeHex } from './color';
import { colors } from './colors';
import { fillFor, fillStrongFor } from './fill';

export { contrastRatio, mix };

export type BrandMode = 'light' | 'dark';

export type DerivedBrand = {
  /** The school's colour (legacy colours mapped): decoration, icons, outlines and tints. */
  brand: string;
  /** Colour for filled surfaces carrying `brandInk` text; passes 4.5:1. */
  brandFill: string;
  brandFillStrong: string;
  brandStrong: string;
  brandSoft: string;
  rail: string;
  rail2: string;
  /** Text colour on `brand`. */
  brandInk: string;
  /** Same as `brand`, kept for callers that name it by purpose. */
  decoration: string;
};

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
 * `brand` is the school's colour as is. `brandFill` is what filled surfaces use: light mode puts
 * white text on it and darkens until 4.5:1; dark mode (not in the spec) puts the dark surface
 * colour on it and lightens instead.
 */
export function deriveBrand(hex: string, mode: BrandMode): DerivedBrand {
  const normalized = normalizeHex(hex);
  const decoration = LEGACY.has(normalized) ? DEFAULT_BRAND : normalized;
  const base = BASE[mode];

  const direction = mode === 'light' ? 'darken' : 'lighten';
  const brand = decoration;
  const brandFill = fillFor(brand, base.ink, direction);

  return {
    brand,
    brandFill,
    brandFillStrong: fillStrongFor(brandFill, direction),
    brandStrong: mix(brand, 0.8, '#000000'),
    brandSoft: mix(brand, 0.13, base.surface),
    rail: mix(brand, 0.06, base.rail),
    rail2: mix(brand, 0.1, RAIL_2_BASE),
    brandInk: base.ink,
    decoration,
  };
}
