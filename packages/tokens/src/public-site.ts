import { mix } from './color';

import type { ColorSet } from './colors';

/** Public landing page tokens (spec 03 "Public landing page", spec 19). */
const tags = {
  'band-tag-teal-bg': '#1D4F4A',
  'band-tag-teal-ink': '#9BEADF',
  'band-tag-coral-bg': '#5A2430',
  'band-tag-coral-ink': '#FFC3BC',
  'band-tag-amber-bg': '#5A4317',
  'band-tag-amber-ink': '#FFDDA1',
  'band-tag-lilac-bg': '#3A3170',
  'band-tag-lilac-ink': '#D9D2FF',
} as const;

export type PublicTokenName =
  'band' | 'band-2' | 'band-ink' | 'band-ink-2' | 'band-line' | keyof typeof tags;
export type PublicSet = Record<PublicTokenName, string>;

const light: PublicSet = {
  band: '#1F2559',
  'band-2': '#2A3170',
  'band-ink': '#F3F2FB',
  'band-ink-2': '#C9C6EC',
  'band-line': '#3A4285',
  ...tags,
};

const dark: PublicSet = {
  band: '#0D0E22',
  'band-2': '#181A38',
  'band-ink': '#F3F2FB',
  'band-ink-2': '#B8B6DC',
  'band-line': '#2E3260',
  ...tags,
};

type HeatStep = { color: 'c1' | 'c5'; percent: number };

/** heat-0..3: coral 30%, teal 30%, teal 60%, teal, each mixed with the theme surface. */
const heat: readonly HeatStep[] = [
  { color: 'c1', percent: 30 },
  { color: 'c5', percent: 30 },
  { color: 'c5', percent: 60 },
  { color: 'c5', percent: 100 },
];

export const publicSite = { light, dark, heat } as const;

/** Resolved hex for a heat step on a theme (CSS uses color-mix; Dart needs the hex). */
export function heatHex(set: Pick<ColorSet, 'c1' | 'c5' | 'surface'>, step: number): string {
  const s = heat[step];
  if (!s) throw new RangeError(`heat step ${step} is not 0..3`);
  return mix(set[s.color], s.percent / 100, set.surface);
}
