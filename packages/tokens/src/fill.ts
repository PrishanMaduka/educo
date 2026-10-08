import { contrastRatio, mix } from './color';

export const MIN_CONTRAST = 4.5;

/**
 * Colour for filled surfaces that carry `ink` text (primary buttons, active nav pill, badges).
 * Keeps `brand` when it already passes 4.5:1, otherwise moves it toward black (`darken`, white ink
 * on light) or white (`lighten`, dark ink on dark) one percent at a time until it passes.
 */
export function fillFor(brand: string, ink: string, direction: 'darken' | 'lighten'): string {
  const target = direction === 'darken' ? '#000000' : '#FFFFFF';
  let fill = brand;
  for (let share = 0.99; contrastRatio(ink, fill) < MIN_CONTRAST && share >= 0; share -= 0.01) {
    fill = mix(brand, share, target);
  }
  return fill;
}

/** Hover colour for a fill: 80% fill and 20% black (light) or white (dark). */
export function fillStrongFor(fill: string, direction: 'darken' | 'lighten'): string {
  return mix(fill, 0.8, direction === 'darken' ? '#000000' : '#FFFFFF');
}
