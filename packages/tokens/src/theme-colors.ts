import { colorNames } from './colors';
import { publicColorNames, publicSite } from './public-site';

/**
 * Every colour in the Tailwind theme (`bg-<name>`, `text-<name>`), in the order theme.css lists
 * them. `cn()` in @quad/ui reads it so tailwind-merge knows each name is a colour.
 */
export const themeColorNames: readonly string[] = [
  ...colorNames,
  ...Object.keys(publicSite.light),
  ...publicSite.heat.map((_, i) => `heat-${i}`),
  ...publicColorNames,
];
