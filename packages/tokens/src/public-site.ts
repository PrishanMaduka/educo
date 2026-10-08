/**
 * Public site tokens (spec 19): the landing page's palette, navy, cream, lime, pink, sky blue and
 * orange, with its dark mode. They become `--quad-site-*` variables and `site-*` Tailwind colours,
 * for the public pages only (the apps and the parent app's QuadColors do not use them).
 */

/** Colours that are the same in light and dark. */
const constant = {
  navy: '#101632',
  'navy-2': '#1D2550',
  'navy-line': '#2F3870',
  'navy-border': '#3A4378',
  phone: '#05081A',
  'phone-edge': '#2A3266',
  paper: '#F7F5F0',
  white: '#FFFFFF',
  lime: '#C8F169',
  pink: '#FF6FAE',
  sky: '#59C3FF',
  orange: '#FF9B45',
  'school-green': '#1B7F53',
  'school-maroon': '#7A1F3D',
  pine: '#2FA36B',
  alert: '#E8355F',
  butter: '#FFE680',
  pancake: '#E8A24A',
  'pancake-edge': '#B8752A',
  peach: '#F1C7A3',
  blush: '#FF7F9C',
  'on-vivid': '#101632',
  'on-navy': '#F7F5F0',
  'on-navy-2': '#C9CBE0',
  'on-navy-3': '#A9ACC8',
  'tag-bad-bg': '#FFE1E7',
  'tag-bad-ink': '#8A1D33',
  'tag-good-bg': '#D8F5C0',
  'tag-good-ink': '#24561A',
  'chip-sky-bg': '#D9EFFF',
  'chip-sky-ink': '#0D4F7A',
  'chip-pink-bg': '#FFE1EE',
  'chip-pink-ink': '#8A1D4C',
  'chip-orange-bg': '#FFE6CF',
  'chip-orange-ink': '#7A3A07',
  'feed-time': '#5F637E',
  'screen-ink-2': '#3D4263',
  'screen-ink-3': '#555A78',
  'screen-track': '#E6E3DC',
  'feed-shadow': 'rgba(16,22,50,.08)',
  'phone-shadow': 'rgba(0,0,0,.45)',
  // The avatars' skin and hair tones.
  'skin-1': '#F1C7A3',
  'skin-2': '#E9B48A',
  'skin-3': '#C98D62',
  'skin-4': '#B57A52',
  'skin-5': '#A8714B',
  'skin-6': '#8D5A3B',
  'skin-7': '#6E4429',
  'hair-black': '#1A1210',
  'hair-dark': '#2B1D14',
  'hair-brown': '#3A2516',
  'hair-chestnut': '#6B4226',
  'hair-grey': '#E4E0D8',
  'hair-plum': '#6D2F5C',
  // The avatars' clothes, and the tones the art mixes for shade and shine.
  'cloth-navy': '#1F3A8A',
  'cloth-indigo': '#26318A',
  'cloth-teal': '#1F9E8F',
  'cloth-blue': '#2F55D4',
  'cloth-plum': '#8A2A4A',
  'cloth-sky': '#3A7BD5',
  'cloth-line': '#D6DBE8',
  'cloth-line-2': '#C9D0E0',
  'cloth-trim': '#E8ECFF',
  'cloth-cream': '#F3E6D0',
  'shine-grey': '#555555',
  'brow-grey': '#8D8A86',
  shade: '#1B0F0C',
} as const;

/** Colours that change with the theme (the prototype's light and dark). */
const light = {
  'hero-bg': '#101632',
  'nav-bg': 'rgba(16,22,50,.92)',
  'page-bg': '#F7F5F0',
  'page-ink': '#101632',
  'page-ink-2': '#3D4263',
  'page-ink-3': '#555A78',
  'card-bg': '#FFFFFF',
  'card-line': '#E2E0D8',
  'band-bg': '#101632',
  'band-edge': 'transparent',
  'sheet-bg': '#F7F5F0',
  'sheet-ink': '#101632',
  'sheet-ink-2': '#555A78',
  'sheet-2': '#ECEBE4',
  'sheet-line': '#E2E0D8',
  'bar-ink': '#101632',
  'card-shadow': 'rgba(0,0,0,.4)',
  focus: '#2F6BFF',
  backdrop: 'rgba(16,22,50,.6)',
} as const;

const dark: Record<keyof typeof light, string> = {
  'hero-bg': '#0A0D24',
  'nav-bg': 'rgba(10,13,36,.92)',
  'page-bg': '#0F1330',
  'page-ink': '#F7F5F0',
  'page-ink-2': '#C9CBE0',
  'page-ink-3': '#A9ACC8',
  'card-bg': '#171D45',
  'card-line': '#2A3266',
  'band-bg': '#161C48',
  'band-edge': '#2A3266',
  'sheet-bg': '#1D2550',
  'sheet-ink': '#F7F5F0',
  'sheet-ink-2': '#C9CBE0',
  'sheet-2': '#141A40',
  'sheet-line': '#2F3870',
  'bar-ink': '#C9CBE0',
  'card-shadow': 'rgba(0,0,0,.55)',
  focus: '#7FA6FF',
  backdrop: 'rgba(5,8,26,.7)',
};

export type SiteTokenName = keyof typeof constant | keyof typeof light;

/**
 * The accent follows the visitor's view ("I run a school" / "I'm a parent"): lime for schools,
 * pink for parents. The view is `data-view` on <html>.
 */
const accent = { school: 'lime', parent: 'pink' } as const satisfies Record<string, SiteTokenName>;

export const publicSite = {
  light: { ...constant, ...light } satisfies Record<SiteTokenName, string>,
  dark: { ...constant, ...dark } satisfies Record<SiteTokenName, string>,
  accent,
} as const;

/** Every public site colour in the Tailwind theme, `site-` prefixed (`bg-site-navy`). */
export const publicColorNames: readonly string[] = [
  ...Object.keys(publicSite.light).map((name) => `site-${name}`),
  'site-accent',
];
