import { deriveBrand, type BrandMode } from '@quad/tokens';

import type { MeBrand, MeBrandTheme } from '@quad/contracts';

function brandTheme(brandColor: string | null, mode: BrandMode): MeBrandTheme {
  const { fill, fillStrong, ink, text, soft, railActive, railActiveInk } = deriveBrand(
    brandColor,
    mode,
  );
  return { fill, fillStrong, ink, text, soft, railActive, railActiveInk };
}

/**
 * The school's brand tokens for both themes (spec 03 "School brand colour"; D34, D56): colour
 * maths only, from `deriveBrand` in `@quad/tokens`, so the staff portal and the parent app apply
 * the same values and never derive them. A school with no colour, an invalid one or a legacy
 * prototype colour gets Quad lime; a saved colour is kept.
 */
export function brandPalette(brandColor: string | null): MeBrand {
  return {
    color: deriveBrand(brandColor, 'light').raw,
    light: brandTheme(brandColor, 'light'),
    dark: brandTheme(brandColor, 'dark'),
  };
}
