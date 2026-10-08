/** Shape, space and elevation (spec 03). Radii and spacing are in px. */
export const radius = { card: 16, scene: 24, input: 12, pill: 999 } as const;

export const shadow = {
  card: '0 1px 2px rgba(28,27,46,.05), 0 8px 24px -12px rgba(28,27,46,.18)',
  lg: '0 24px 60px -18px rgba(28,27,46,.35)',
} as const;

/** The spec's spacing scale, as data. Tailwind's default 4px scale is not overridden. */
export const spacing = [4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32] as const;
