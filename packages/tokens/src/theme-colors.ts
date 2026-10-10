import { colorNames } from './colors';
import { publicColorNames } from './public-site';

/**
 * Every colour in the Tailwind theme (`bg-<name>`, `text-<name>`), in the order theme.css lists
 * them. `cn()` in @quad/ui reads it so tailwind-merge knows each name is a colour.
 */
export const themeColorNames: readonly string[] = [...colorNames, 'scrim', ...publicColorNames];
