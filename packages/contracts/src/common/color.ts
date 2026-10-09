import { z } from 'zod';

/** A `#RRGGBB` colour stored as data (a school's brand, a role's swatch); never a style. */
export const HexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, { message: 'must be a hex colour' });
export type HexColor = z.infer<typeof HexColor>;
