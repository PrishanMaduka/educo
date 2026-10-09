import { colors, deriveBrand } from '@quad/tokens';

import type { MeBrand } from '@quad/contracts';

/**
 * The school's brand colours for the web shell (spec 03 "School brand colour"; D32): colour
 * maths only, from `deriveBrand` in `@quad/tokens`, so the API and the apps agree. A school
 * with no colour gets Quad's default brand. Dark mode keeps the `brand-ink` token for text on
 * `fillDark`, so only the light ink is returned.
 */
export function brandPalette(brandColor: string | null): MeBrand {
  const hex = brandColor ?? colors.light.brand;
  const light = deriveBrand(hex, 'light');
  return {
    color: light.brand,
    fill: light.brandFill,
    fillDark: deriveBrand(hex, 'dark').brandFill,
    ink: light.brandInk,
  };
}
