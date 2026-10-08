/**
 * Logo colours (spec 03 "Logo", design/brand): the four-petal mark in sky, pink, lime and orange,
 * and the "quad" wordmark. `color` is for light grounds (navy wordmark); `white` is the mark on
 * dark grounds, with a cream wordmark; `mono` is the one-colour white mark; `theme` reads the
 * public site's `site-*` tokens and takes the wordmark from the text colour.
 */
export type LogoVariant = 'color' | 'white' | 'mono' | 'theme';

interface LogoColours {
  /** Top left, top right, bottom left, bottom right. */
  petals: readonly [string, string, string, string];
  word: string;
}

const PETALS = ['#59C3FF', '#FF6FAE', '#C8F169', '#FF9B45'] as const;

export const logoPalette: Record<LogoVariant, LogoColours> = {
  color: { petals: PETALS, word: '#101632' },
  white: { petals: PETALS, word: '#F7F5F0' },
  mono: { petals: ['#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF'], word: '#FFFFFF' },
  theme: {
    petals: [
      'var(--quad-site-sky)',
      'var(--quad-site-pink)',
      'var(--quad-site-lime)',
      'var(--quad-site-orange)',
    ],
    word: 'currentColor',
  },
};
