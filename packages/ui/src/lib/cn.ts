import { themeColorNames } from '@quad/tokens';
import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';


/** Colour names from the generated `@theme` (packages/tokens), so they merge like built-in colours. */
const tokenColors = [...themeColorNames];

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
