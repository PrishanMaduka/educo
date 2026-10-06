/** Type tokens (spec 03). Apps load the font files; tokens only name the families. */
export const fontFamily = {
  sans: '"Figtree", system-ui, -apple-system, "Segoe UI", sans-serif',
  accent: '"Fraunces", Georgia, "Times New Roman", serif',
} as const;

/** Family names as the Flutter app bundles them. */
export const fontName = { sans: 'Figtree', accent: 'Fraunces' } as const;

export const type = {
  weights: [400, 500, 600, 700, 800],
  headingWeight: 800,
  headingLetterSpacing: '-0.02em',
  size: {
    pageTitle: 30,
    pageTitleParent: 29,
    cardTitle: 18,
    bodyWeb: 14.5,
    bodyMobile: 15,
  },
} as const;
