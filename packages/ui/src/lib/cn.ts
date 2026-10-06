import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/** Colour names from the generated `@theme` (packages/tokens/dist/theme.css), so they merge like built-in colours. */
const tokenColors = [
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
  'brand-fill',
  'brand-fill-strong',
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
  'band',
  'band-2',
  'band-ink',
  'band-ink-2',
  'band-line',
  'heat-0',
  'heat-1',
  'heat-2',
  'heat-3',
];

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: tokenColors,
      radius: ['card', 'scene', 'input', 'pill'],
      shadow: ['card'],
      font: ['sans', 'accent'],
    },
  },
});

/** Joins class names (clsx) and resolves Tailwind conflicts so the later utility wins (tailwind-merge). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
