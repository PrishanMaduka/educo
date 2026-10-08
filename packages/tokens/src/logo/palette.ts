/**
 * Logo colours (spec 03 "Logo"). `white` is for dark backgrounds. `theme` reads the public site's
 * `mark-*` tokens, so one mark follows light and dark mode; its wordmark takes the text colour.
 */
export type LogoVariant = 'color' | 'white' | 'theme';

export const logoPalette = {
  color: { school: '#1F2559', people: '#8B7CF6', students: '#E5534B', word: '#1F2559' },
  white: { school: '#FFFFFF', people: '#C9C4F5', students: '#FF7A6E', word: '#FFFFFF' },
  theme: {
    school: 'var(--quad-mark-school)',
    people: 'var(--quad-mark-people)',
    students: 'var(--quad-mark-students)',
    word: 'currentColor',
  },
} as const;
