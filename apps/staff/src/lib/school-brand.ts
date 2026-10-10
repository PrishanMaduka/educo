import type { MeBrand, MeBrandTheme } from '@quad/contracts';
import type { BrandTokenName } from '@quad/tokens';
import type { CSSProperties } from 'react';

/** The brand tokens one theme of the API's palette sets (names from `@quad/tokens`). */
function brandTokenValues(color: string, theme: MeBrandTheme): Record<BrandTokenName, string> {
  return {
    brand: theme.fill,
    'brand-strong': theme.fillStrong,
    'brand-soft': theme.soft,
    'brand-ink': theme.ink,
    'brand-fill': theme.fill,
    'brand-fill-strong': theme.fillStrong,
    'brand-text': theme.text,
    'brand-raw': color,
    'rail-active': theme.railActive,
    'rail-active-ink': theme.railActiveInk,
  };
}

/**
 * The school's brand as CSS variables (spec 03 "School brand colour"; D34, D56): the API computes
 * the tokens for both themes, and the generated theme maps `--school-light-*` and `--school-dark-*`
 * onto the token variables under `[data-school-brand]`, so switching theme needs no recalculation.
 * Values only ever reach CSS variables, never class names.
 */
export function schoolBrandStyle(brand: MeBrand): CSSProperties {
  const style: Record<string, string> = {};
  for (const mode of ['light', 'dark'] as const) {
    for (const [name, value] of Object.entries(brandTokenValues(brand.color, brand[mode]))) {
      style[`--school-${mode}-${name}`] = value;
    }
  }
  return style;
}
