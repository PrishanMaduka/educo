/** Logo colours (spec 03 "Logo"). `white` is for dark backgrounds. */
export type LogoVariant = 'color' | 'white';

export const logoPalette = {
  color: { school: '#1F2559', people: '#8B7CF6', students: '#E5534B', word: '#1F2559' },
  white: { school: '#FFFFFF', people: '#C9C4F5', students: '#FF7A6E', word: '#FFFFFF' },
} as const;
