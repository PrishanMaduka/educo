/*
 * The sample circle on the public site (spec 19): fictional people at an international school.
 * Names live in en.json (public.people.*); this table only says how each one is drawn.
 */

export type PersonId =
  'okafor' | 'tanaka' | 'haddad' | 'priya' | 'asha' | 'daniel' | 'maya' | 'leo' | 'abara';

/** The colour behind each person, by their place in the circle. */
export type Role = 'teach' | 'care' | 'home' | 'child';

type Hairstyle = 'short' | 'bun' | 'long' | 'pigtails' | 'curly' | 'grandma' | 'cap' | 'beard';

interface Look {
  role: Role;
  /** `site-skin-*` and `site-hair-*` tokens. */
  skin: `skin-${number}`;
  hair: 'hair-black' | 'hair-dark' | 'hair-brown' | 'hair-chestnut' | 'hair-grey';
  style: Hairstyle;
  /** Staggers the blinks, so the faces never blink together. */
  blink: string;
}

export const PEOPLE: Record<PersonId, Look> = {
  okafor: {
    role: 'teach',
    skin: 'skin-6',
    hair: 'hair-black',
    style: 'bun',
    blink: '[animation-delay:.38s]',
  },
  tanaka: {
    role: 'care',
    skin: 'skin-1',
    hair: 'hair-black',
    style: 'cap',
    blink: '[animation-delay:.38s]',
  },
  haddad: {
    role: 'care',
    skin: 'skin-3',
    hair: 'hair-dark',
    style: 'long',
    blink: '[animation-delay:.38s]',
  },
  priya: {
    role: 'home',
    skin: 'skin-4',
    hair: 'hair-black',
    style: 'long',
    blink: '[animation-delay:3.65s]',
  },
  asha: {
    role: 'home',
    skin: 'skin-5',
    hair: 'hair-grey',
    style: 'grandma',
    blink: '[animation-delay:2.92s]',
  },
  daniel: {
    role: 'home',
    skin: 'skin-2',
    hair: 'hair-chestnut',
    style: 'beard',
    blink: '[animation-delay:.38s]',
  },
  maya: {
    role: 'child',
    skin: 'skin-4',
    hair: 'hair-black',
    style: 'pigtails',
    blink: '[animation-delay:2.92s]',
  },
  leo: {
    role: 'teach',
    skin: 'skin-2',
    hair: 'hair-brown',
    style: 'curly',
    blink: '[animation-delay:2.19s]',
  },
  abara: {
    role: 'teach',
    skin: 'skin-7',
    hair: 'hair-black',
    style: 'short',
    blink: '[animation-delay:3.65s]',
  },
};

/** Teachers sky blue, carers lime, home pink, the child orange. */
export const ROLE_COLOUR: Record<Role, string> = {
  teach: 'var(--quad-site-sky)',
  care: 'var(--quad-site-lime)',
  home: 'var(--quad-site-pink)',
  child: 'var(--quad-site-orange)',
};

export const site = (token: string): string => `var(--quad-site-${token})`;
