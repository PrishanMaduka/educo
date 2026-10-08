import { mix } from './color';
import { logoPalette } from './logo/palette';

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

// Spec 19 "Palette B tokens (chosen)": the deep twilight-blue band (light) and Soft charcoal (dark).
const light: PublicSet = {
  band: '#1A2A5E',
  'band-2': '#24387A',
  'band-ink': '#F3F2FB',
  'band-ink-2': '#CDD5F2',
  'band-line': '#34498F',
  ...tags,
};

const dark: PublicSet = {
  band: '#0F0F13',
  'band-2': '#1D1D23',
  'band-ink': '#F3F2FB',
  'band-ink-2': '#D0CFCA',
  'band-line': '#33333C',
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

/**
 * Palette B "Sky blue" (light) and Soft charcoal (dark), spec 19. They replace the app's background,
 * surface and line tokens (and, in dark, the ink) inside the public site only, under
 * `[data-site="public"]`, so the landing page uses the usual utilities (`bg-canvas`, `bg-surface`).
 */
export type PaletteTokenName =
  'canvas' | 'surface' | 'surface-2' | 'line' | 'ink' | 'ink-2' | 'ink-3';

const palette: {
  light: Record<'canvas' | 'surface' | 'surface-2' | 'line', string>;
  dark: Record<PaletteTokenName, string>;
} = {
  light: { canvas: '#EEF5FB', surface: '#FFFFFF', 'surface-2': '#E4EDF7', line: '#D2DEEC' },
  dark: {
    canvas: '#18181D',
    surface: '#222228',
    'surface-2': '#2A2A31',
    line: '#36363F',
    ink: '#F3F2EE',
    'ink-2': '#CFCDC6',
    'ink-3': '#9C9A93',
  },
};

const landingNames = [
  'coral-ink',
  'coral-fill',
  'coral-fill-ink',
  'heat-ink',
  'wash-1',
  'wash-2',
  'coral-soft',
  'amber-soft',
  'teal-soft',
  'lilac-soft',
  'band-eyebrow',
  'band-accent',
  'mark-school',
  'mark-people',
  'mark-students',
] as const;
export type LandingTokenName = (typeof landingNames)[number];

/**
 * Colours only the public site uses (spec 19 "Design tokens to add"). Not part of the parent app's
 * QuadColors. `coral-fill` carries `coral-fill-ink` (white) text (primary buttons, the hero name tag, the campus pins);
 * `coral-ink` is coral text. The `mark-*` colours paint the Quad mark inside the illustrations.
 */
const landing: Record<'light' | 'dark', Record<LandingTokenName, string>> = {
  light: {
    'coral-ink': '#C23A33',
    'coral-fill': '#C23A33',
    'coral-fill-ink': '#FFFFFF',
    'heat-ink': '#1C1B2E',
    'wash-1': '#E8E3FA',
    'wash-2': '#FAF0C8',
    'coral-soft': '#FDE7E5',
    'amber-soft': '#FDF1DC',
    'teal-soft': '#DDF4F1',
    'lilac-soft': '#EEEAFE',
    'band-eyebrow': '#FFA399',
    'band-accent': '#FFB8AF',
    'mark-school': logoPalette.color.school,
    'mark-people': logoPalette.color.people,
    'mark-students': logoPalette.color.students,
  },
  dark: {
    'coral-ink': '#FF8F84',
    'coral-fill': '#C23A33',
    'coral-fill-ink': '#FFFFFF',
    'heat-ink': '#000000',
    'wash-1': '#24232C',
    'wash-2': '#2C2A24',
    'coral-soft': '#3A2526',
    'amber-soft': '#342B1D',
    'teal-soft': '#1C302E',
    'lilac-soft': '#2A2638',
    'band-eyebrow': '#FFA399',
    'band-accent': '#FFB8AF',
    'mark-school': logoPalette.white.people,
    'mark-people': '#A99BFF',
    'mark-students': logoPalette.white.students,
  },
};

const pigmentNames = [
  'paper',
  'peach',
  'apricot',
  'sky',
  'lilac',
  'teal',
  'sea',
  'ochre',
  'olive',
  'charcoal',
  'rose',
  'roof',
  'white',
  'window',
  'skin',
  'hair',
  'uniform',
  'moonlight',
  'glint',
  'glint-core',
  'light',
  'shade',
] as const;
export type PigmentName = (typeof pigmentNames)[number];

/**
 * Watercolour pigments (`wc-*`, spec 19): every illustration paints with these only. Dark mode is
 * the dusk version of each scene. `moonlight`, `glint` and `glint-core` light the moon and the
 * travelling glints; `light` is pure white for highlights and the painted vignette masks; `shade`
 * is the black of the paper-grain layer.
 */
const pigments: Record<'light' | 'dark', Record<PigmentName, string>> = {
  light: {
    paper: '#F4F1EA',
    peach: '#E8B79C',
    apricot: '#F0C899',
    sky: '#9CBAD5',
    lilac: '#B7A8D4',
    teal: '#5F9C95',
    sea: '#3F8783',
    ochre: '#D29A4C',
    olive: '#8B8F52',
    charcoal: '#4A4850',
    rose: '#D98B7C',
    roof: '#C4673F',
    white: '#FBFAF5',
    window: '#F5C15A',
    skin: '#B67C56',
    hair: '#3A2B2A',
    uniform: '#FDFCF8',
    moonlight: '#F3EBD2',
    glint: '#FFE7A8',
    'glint-core': '#FFF6DA',
    light: '#FFFFFF',
    shade: '#000000',
  },
  dark: {
    paper: '#1F1F25',
    peach: '#4E4550',
    apricot: '#7A5A58',
    sky: '#33384A',
    lilac: '#4A4466',
    teal: '#2E5250',
    sea: '#2A4244',
    ochre: '#8C6B3C',
    olive: '#3F4234',
    charcoal: '#0E0E12',
    rose: '#8A5458',
    roof: '#6E3A30',
    white: '#C4C2BC',
    window: '#FFD47C',
    skin: '#94653F',
    hair: '#1A1216',
    uniform: '#D9D7D0',
    moonlight: '#F3EBD2',
    glint: '#FFE7A8',
    'glint-core': '#FFF6DA',
    light: '#FFFFFF',
    shade: '#000000',
  },
};

/** Washes multiply in light mode so overlapping washes build up pigment; dark mode blends normally. */
const blend = { light: 'multiply', dark: 'normal' } as const;

export const publicSite = {
  light,
  dark,
  heat,
  palette,
  landing,
  landingNames,
  pigments,
  pigmentNames,
  blend,
} as const;

/** Resolved hex for a heat step on a theme (CSS uses color-mix; Dart needs the hex). */
export function heatHex(set: Pick<ColorSet, 'c1' | 'c5' | 'surface'>, step: number): string {
  const s = heat[step];
  if (!s) throw new RangeError(`heat step ${step} is not 0..3`);
  return mix(set[s.color], s.percent / 100, set.surface);
}

/** Every colour the public site adds to the Tailwind theme, beyond the band tokens. */
export const publicColorNames: readonly string[] = [
  ...landingNames,
  ...pigmentNames.map((name) => `wc-${name}`),
];
