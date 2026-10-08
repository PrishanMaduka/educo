/*
 * The sample circle on the public site (spec 19): fictional people at an international school.
 * Names live in en.json (public.people.*); this table only says how each one is drawn
 * (design/landing.html `PEEPS`).
 */

export type PersonId =
  'okafor' | 'tanaka' | 'haddad' | 'priya' | 'asha' | 'daniel' | 'maya' | 'leo' | 'abara';

/** The colour behind each person, by their place in the circle. */
export type Role = 'teach' | 'care' | 'home' | 'child';

export type Hairstyle =
  'short' | 'bun' | 'long' | 'pigtails' | 'curly' | 'grandma' | 'cap' | 'beard' | 'hijab';

/** A `site-*` colour token name. */
type Token = string;

export interface Look {
  role: Role;
  /** `site-skin-*`. */
  skin: `skin-${number}`;
  /** `site-hair-*` (the hijab's colour for a hijab). */
  hair: `hair-${string}`;
  style: Hairstyle;
  /** Head half-width, half-height and jaw width (0 to 1, narrow to square). */
  head: readonly [w: number, h: number, jaw: number];
  /** The top they wear. */
  top: Token;
  /** Brow tilt: 0 level, 1 a little raised, 2 raised. */
  brow: 0 | 1 | 2;
  /** Details: a lanyard (its colour), earrings (their colour), glasses and clothes. */
  staff?: Token;
  ear?: Token;
  glasses?: 'round' | 'square';
  tie?: Token;
  uniform?: true;
  collar?: true;
  jacket?: true;
  whistle?: true;
  scrubs?: true;
  cardigan?: true;
  necklace?: true;
  /** Smile lines by the eyes. */
  lines?: true;
  /** Staggers the blinks, so the faces never blink together. */
  blink: string;
}

export const PEOPLE: Record<PersonId, Look> = {
  okafor: {
    role: 'teach',
    skin: 'skin-6',
    hair: 'hair-black',
    style: 'bun',
    head: [20, 24, 0.5],
    top: 'cloth-navy',
    staff: 'lime',
    ear: 'butter',
    brow: 2,
    blink: '[animation-delay:.38s]',
  },
  tanaka: {
    role: 'care',
    skin: 'skin-1',
    hair: 'hair-black',
    style: 'cap',
    head: [21, 22, 0.82],
    top: 'cloth-indigo',
    jacket: true,
    whistle: true,
    brow: 0,
    blink: '[animation-delay:.38s]',
  },
  haddad: {
    role: 'care',
    skin: 'skin-3',
    hair: 'hair-plum',
    style: 'hijab',
    head: [19, 23, 0.55],
    top: 'cloth-teal',
    scrubs: true,
    staff: 'sky',
    brow: 1,
    blink: '[animation-delay:.38s]',
  },
  priya: {
    role: 'home',
    skin: 'skin-4',
    hair: 'hair-black',
    style: 'long',
    head: [19.5, 23, 0.42],
    top: 'cloth-blue',
    necklace: true,
    ear: 'butter',
    brow: 2,
    blink: '[animation-delay:3.65s]',
  },
  asha: {
    role: 'home',
    skin: 'skin-5',
    hair: 'hair-grey',
    style: 'grandma',
    head: [22, 22, 0.75],
    top: 'cloth-plum',
    cardigan: true,
    glasses: 'round',
    lines: true,
    brow: 1,
    blink: '[animation-delay:2.92s]',
  },
  daniel: {
    role: 'home',
    skin: 'skin-2',
    hair: 'hair-chestnut',
    style: 'beard',
    head: [20, 24, 0.78],
    top: 'cloth-sky',
    collar: true,
    brow: 0,
    blink: '[animation-delay:.38s]',
  },
  maya: {
    role: 'child',
    skin: 'skin-4',
    hair: 'hair-black',
    style: 'pigtails',
    head: [22, 21, 0.7],
    top: 'white',
    uniform: true,
    brow: 1,
    blink: '[animation-delay:2.92s]',
  },
  leo: {
    role: 'teach',
    skin: 'skin-2',
    hair: 'hair-brown',
    style: 'curly',
    head: [21, 22, 0.72],
    top: 'white',
    uniform: true,
    brow: 1,
    blink: '[animation-delay:2.19s]',
  },
  abara: {
    role: 'teach',
    skin: 'skin-7',
    hair: 'hair-black',
    style: 'short',
    head: [21, 24, 0.85],
    top: 'white',
    collar: true,
    tie: 'navy-2',
    staff: 'orange',
    glasses: 'square',
    brow: 0,
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
