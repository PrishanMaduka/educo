/** Shape, space and elevation (spec 03). Radii and spacing are in px. */
export const radius = { card: 20, scene: 28, input: 12, pill: 999 } as const;

/** Navy-tinted shadows (spec 03 "Space, shape, elevation and focus"), per theme. */
export const shadow = {
  light: {
    sm: '0 1px 2px rgba(16,22,50,.06)',
    card: '0 1px 2px rgba(16,22,50,.05), 0 10px 28px -18px rgba(16,22,50,.30)',
    lg: '0 30px 70px -24px rgba(16,22,50,.45)',
  },
  dark: {
    sm: '0 1px 2px rgba(0,0,0,.3)',
    card: '0 1px 2px rgba(0,0,0,.3), 0 12px 30px -18px rgba(0,0,0,.7)',
    lg: '0 30px 70px -24px rgba(0,0,0,.8)',
  },
} as const;

export type ShadowName = keyof typeof shadow.light;

/** Behind drawers and dialogs, per theme. */
export const scrim = { light: 'rgba(16,22,50,.45)', dark: 'rgba(5,8,26,.6)' } as const;

/** The spec's spacing scale, as data. Tailwind's default 4px scale is not overridden. */
export const spacing = [4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32] as const;
