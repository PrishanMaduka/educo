/** Colour tokens from docs/spec/03-design-system.md. Values are copied exactly. */
export const colorNames = [
  'canvas',
  'surface',
  'surface-2',
  'line',
  'line-strong',
  'ink',
  'ink-2',
  'ink-3',
  'brand',
  'brand-strong',
  'brand-soft',
  'brand-ink',
  'rail',
  'rail-2',
  'rail-ink',
  'rail-ink-2',
  'rail-active',
  'good',
  'good-soft',
  'warn',
  'warn-soft',
  'bad',
  'bad-soft',
  'info',
  'info-soft',
  'c1',
  'c2',
  'c3',
  'c4',
  'c5',
  'gold',
  'gold-soft',
] as const;

export type TokenName = (typeof colorNames)[number];
export type ColorSet = Record<TokenName, string>;
export type RailOverrides = Pick<ColorSet, 'rail' | 'rail-2' | 'rail-active'>;

const light: ColorSet = {
  canvas: '#FAF8F5',
  surface: '#FFFFFF',
  'surface-2': '#F6F3EF',
  line: '#ECE8E3',
  'line-strong': '#DCD6CF',
  ink: '#1C1B2E',
  'ink-2': '#4E4C63',
  'ink-3': '#7D7A90',
  brand: '#DD4A42',
  'brand-strong': '#C23B34',
  'brand-soft': '#FDE7E5',
  'brand-ink': '#FFFFFF',
  rail: '#1F2559',
  'rail-2': '#2C3370',
  'rail-ink': '#E6E7F5',
  'rail-ink-2': '#A3A6CC',
  'rail-active': '#DD4A42', // the brand colour (staff)
  good: '#1F8A5B',
  'good-soft': '#E3F4EC',
  warn: '#B26A00',
  'warn-soft': '#FFF1DC',
  bad: '#D13A3A',
  'bad-soft': '#FDE6E6',
  info: '#6D5AE6',
  'info-soft': '#EEEAFE',
  c1: '#E5534B',
  c2: '#3B4AA8',
  c3: '#8B7CF6',
  c4: '#F2A93B',
  c5: '#2BB0A0',
  gold: '#8B7CF6',
  'gold-soft': '#EEEAFE',
};

// The spec gives no dark values for rail-2, rail-ink and rail-ink-2: the rail is dark in both
// themes, so the light values are kept.
const dark: ColorSet = {
  canvas: '#13142A',
  surface: '#1B1D3A',
  'surface-2': '#22254A',
  line: '#2E3260',
  'line-strong': '#3D4277',
  ink: '#F1F1FA',
  'ink-2': '#C4C5DD',
  'ink-3': '#9395B5',
  brand: '#FF7A6E',
  'brand-strong': '#FF978C',
  'brand-soft': '#3D1F2A',
  'brand-ink': '#1B1D3A',
  rail: '#0E0F22',
  'rail-2': light['rail-2'],
  'rail-ink': light['rail-ink'],
  'rail-ink-2': light['rail-ink-2'],
  'rail-active': '#FF7A6E', // the brand colour (staff)
  good: '#4CC992',
  'good-soft': '#123326',
  warn: '#F0B357',
  'warn-soft': '#3A2A10',
  bad: '#FF7A7A',
  'bad-soft': '#3D1A1E',
  info: '#A99BFF',
  'info-soft': '#262046',
  c1: '#FF7A6E',
  c2: '#7B8BF0',
  c3: '#A99BFF',
  c4: '#F5B95A',
  c5: '#3CC7B5',
  gold: '#A99BFF',
  'gold-soft': '#262046',
};

/** Console rail overrides (apply under `[data-app="console"]`), light theme. */
const consoleLight: RailOverrides = {
  rail: '#15173A',
  'rail-2': '#23265A',
  'rail-active': '#6D5AE6',
};

/** Console rail overrides in the dark theme; only `rail` is specified, the rest stay as light. */
const consoleDark: RailOverrides = {
  rail: '#0C0D20',
  'rail-2': consoleLight['rail-2'],
  'rail-active': consoleLight['rail-active'],
};

export const colors = { light, dark, console: consoleLight, consoleDark } as const;

/** Tokens whose value is the live brand colour rather than a fixed hex (staff rail-active). */
export const brandLinked: readonly TokenName[] = ['rail-active'];
