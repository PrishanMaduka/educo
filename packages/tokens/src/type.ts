/** Type tokens (spec 03 "Type"). Apps load the font files; tokens only name the families. */
const FALLBACK = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const fontFamily = {
  /** Figtree: body, tables, forms, labels and buttons. */
  sans: `"Figtree", ${FALLBACK}`,
  /** Bricolage Grotesque: greetings, titles, big numbers (Fraunces is retired, D34). */
  display: `"Bricolage Grotesque", "Figtree", ${FALLBACK}`,
} as const;

/** Family names as the Flutter app bundles them. */
export const fontName = { sans: 'Figtree', display: 'Bricolage Grotesque' } as const;

export const type = {
  weights: [400, 500, 600, 700, 800],
  displayWeights: [600, 700, 800],
  headingWeight: 800,
  headingLetterSpacing: '-0.02em',
  size: {
    display: 44,
    pageTitle: 30,
    section: 22,
    cardTitle: 17,
    stat: 32,
    /** The parent app's Today greeting, one line (spec 03). */
    greetingParent: 27,
    bodyWeb: 14.5,
    bodyMobile: 15,
  },
} as const;
