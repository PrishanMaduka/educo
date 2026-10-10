/**
 * Every cookie and browser storage key that quad-edu.com and console.quad-edu.com set (D57).
 * This is the one list: the API's `cookieNames()`, the web apps' session helpers and storage
 * keys read their names from it, the Cookies page (`/legal/cookies`) renders its tables from it,
 * and the cookie audit fails on anything the browser holds that it does not name.
 *
 * `purpose` and `lifetime` are legal-page text in plain English, like the other legal pages'
 * content (`apps/staff/content/legal`), so they live here beside the names they describe.
 *
 * The bare names live in `cookie-names.ts`, so code that needs only a name does not carry this
 * text.
 */

import {
  CONSOLE_CSRF_COOKIE,
  CONSOLE_SESSION_COOKIE,
  COOKIE_CONSENT_STORAGE_KEY,
  CSRF_COOKIE,
  GA_COOKIE,
  GA_SESSION_COOKIE_PATTERN,
  HOST_PREFIX,
  LAST_SCHOOL_COOKIE,
  RAIL_STORAGE_KEY,
  SESSION_COOKIE,
  THEME_STORAGE_KEY,
  TRUSTED_DEVICE_COOKIE,
  VIEW_STORAGE_KEY,
  hostPrefixedNames,
} from './cookie-names';

export * from './cookie-names';

/** `necessary` needs no consent; `analytics` is set only after the visitor accepts (owner, OQ3). */
export type CookieCategory = 'necessary' | 'analytics';
/** A cookie, or a key in the browser's `localStorage` (which never leaves the device). */
export type StorageKind = 'cookie' | 'local_storage';
/** The host the cookie or key lives on. Locally both are `localhost`. */
export type CookieHost = 'quad-edu.com' | 'console.quad-edu.com';
/** Who writes it: Quad (the API or the page), or Google Analytics' own script. */
export type CookieSetter = 'quad' | 'google_analytics';
/** The environments whose cookie names differ (the `__Host-` prefix needs https). */
export type CookieEnv = 'local' | 'staging' | 'production';

export interface QuadCookie {
  /** Stable id for code; never shown. */
  readonly id: QuadCookieId;
  readonly kind: StorageKind;
  /** The name as the Cookies page shows it: the local name, or a pattern such as `_ga_<id>`. */
  readonly label: string;
  /** Every exact name it can have: for a `__Host-` cookie, the local name and the prefixed one. */
  readonly names: readonly string[];
  /** For a name that varies (`_ga_<id>`): the shape every real name has. */
  readonly pattern?: RegExp;
  /** True when outside local the name carries the `__Host-` prefix (spec 05, D32). */
  readonly hostPrefixed: boolean;
  readonly category: CookieCategory;
  readonly host: CookieHost;
  readonly setBy: CookieSetter;
  /** How long it stays, in plain English. */
  readonly lifetime: string;
  /** What it is for, in plain English, from the visitor's side. */
  readonly purpose: string;
}

export type QuadCookieId =
  | 'session'
  | 'csrf'
  | 'trustedDevice'
  | 'lastSchool'
  | 'consoleSession'
  | 'consoleCsrf'
  | 'theme'
  | 'rail'
  | 'siteView'
  | 'cookieConsent'
  | 'ga'
  | 'gaSession';

type EntryInput = Omit<QuadCookie, 'names' | 'label'> & {
  /** The local name; the prefixed one is derived when `hostPrefixed`. */
  readonly name: string;
  readonly label?: string;
};

function entry({ name, label, ...rest }: EntryInput): QuadCookie {
  const names = rest.hostPrefixed ? hostPrefixedNames(name) : [name];
  return { ...rest, label: label ?? name, names };
}

const necessaryCookie = {
  kind: 'cookie',
  category: 'necessary',
  setBy: 'quad',
} as const;

const necessaryStorage = {
  kind: 'local_storage',
  category: 'necessary',
  setBy: 'quad',
  hostPrefixed: false,
  host: 'quad-edu.com',
} as const;

/** The registry, in the order the Cookies page lists it. */
export const QUAD_COOKIES: readonly QuadCookie[] = [
  entry({
    ...necessaryCookie,
    id: 'session',
    name: SESSION_COOKIE,
    hostPrefixed: true,
    host: 'quad-edu.com',
    lifetime: 'Until you close your browser, or 30 days if you choose to stay signed in',
    purpose: 'Keeps you signed in to the staff portal. Only Quad’s servers can read it.',
  }),
  entry({
    ...necessaryCookie,
    id: 'csrf',
    name: CSRF_COOKIE,
    hostPrefixed: true,
    host: 'quad-edu.com',
    lifetime: 'The same as the sign-in cookie',
    purpose: 'Protects your changes in the staff portal from being sent by another website.',
  }),
  entry({
    ...necessaryCookie,
    id: 'trustedDevice',
    name: TRUSTED_DEVICE_COOKIE,
    hostPrefixed: true,
    host: 'quad-edu.com',
    lifetime: '30 days',
    purpose:
      'Remembers that you chose to trust this device, so two-step sign-in does not ask for a code each time.',
  }),
  entry({
    ...necessaryCookie,
    id: 'lastSchool',
    name: LAST_SCHOOL_COOKIE,
    hostPrefixed: false,
    host: 'quad-edu.com',
    lifetime: '1 year',
    purpose:
      'Remembers the name and logo of the last school you opened, to say “Welcome back” when you sign in.',
  }),
  entry({
    ...necessaryCookie,
    id: 'consoleSession',
    name: CONSOLE_SESSION_COOKIE,
    hostPrefixed: true,
    host: 'console.quad-edu.com',
    lifetime: 'Until you close your browser; Quad ends the session after 8 hours without use',
    purpose: 'Keeps Quad staff signed in to the platform console.',
  }),
  entry({
    ...necessaryCookie,
    id: 'consoleCsrf',
    name: CONSOLE_CSRF_COOKIE,
    hostPrefixed: true,
    host: 'console.quad-edu.com',
    lifetime: 'Until you close your browser',
    purpose: 'Protects changes in the platform console from being sent by another website.',
  }),
  entry({
    ...necessaryStorage,
    id: 'theme',
    name: THEME_STORAGE_KEY,
    lifetime: 'Until you clear your browser’s storage',
    purpose: 'Remembers whether you chose light or dark mode.',
  }),
  entry({
    ...necessaryStorage,
    id: 'rail',
    name: RAIL_STORAGE_KEY,
    lifetime: 'Until you clear your browser’s storage',
    purpose: 'Remembers whether you folded the staff portal’s side menu.',
  }),
  entry({
    ...necessaryStorage,
    id: 'siteView',
    name: VIEW_STORAGE_KEY,
    lifetime: 'Until you clear your browser’s storage',
    purpose: 'Remembers whether you were reading the website as a school or as a parent.',
  }),
  entry({
    ...necessaryStorage,
    id: 'cookieConsent',
    name: COOKIE_CONSENT_STORAGE_KEY,
    lifetime: '12 months, then we ask again',
    purpose: 'Remembers whether you accepted or rejected analytics cookies.',
  }),
  entry({
    id: 'ga',
    kind: 'cookie',
    name: GA_COOKIE,
    hostPrefixed: false,
    category: 'analytics',
    host: 'quad-edu.com',
    setBy: 'google_analytics',
    lifetime: '13 months',
    purpose:
      'Set by Google Analytics on the public website, only if you accept. Tells visits apart with a random id.',
  }),
  {
    id: 'gaSession',
    kind: 'cookie',
    label: '_ga_<id>',
    names: [],
    pattern: GA_SESSION_COOKIE_PATTERN,
    hostPrefixed: false,
    category: 'analytics',
    host: 'quad-edu.com',
    setBy: 'google_analytics',
    lifetime: '13 months',
    purpose:
      'Set by Google Analytics on the public website, only if you accept. Keeps track of the current visit.',
  },
];

/** The registry entry with this id. */
export function registryEntry(id: QuadCookieId): QuadCookie {
  const found = QUAD_COOKIES.find((item) => item.id === id);
  if (found === undefined) throw new Error(`No cookie registry entry ${id}`);
  return found;
}

/** The first exact name of an entry: its local name, or its only name. */
function baseName(id: QuadCookieId): string {
  const [name] = registryEntry(id).names;
  if (name === undefined) throw new Error(`Cookie registry entry ${id} has no fixed name`);
  return name;
}

/**
 * The name a cookie has in an environment: outside local, a `hostPrefixed` cookie carries the
 * `__Host-` prefix, which the browser accepts only with `Secure`, `Path=/` and no `Domain`
 * (spec 05, D32). Locally the API runs on plain http, so the prefix is dropped.
 */
export function cookieNameIn(id: QuadCookieId, appEnv: CookieEnv): string {
  const name = baseName(id);
  return registryEntry(id).hostPrefixed && appEnv !== 'local' ? `${HOST_PREFIX}${name}` : name;
}

/** The registry entry a cookie or storage key belongs to, if any (`kind` narrows the search). */
export function findRegistryEntry(name: string, kind?: StorageKind): QuadCookie | undefined {
  return QUAD_COOKIES.find(
    (item) =>
      (kind === undefined || item.kind === kind) &&
      (item.names.includes(name) || (item.pattern?.test(name) ?? false)),
  );
}

/** True when the registry names this cookie or storage key (the cookie audit, Task 10). */
export function matchesRegistry(name: string, kind?: StorageKind): boolean {
  return findRegistryEntry(name, kind) !== undefined;
}
