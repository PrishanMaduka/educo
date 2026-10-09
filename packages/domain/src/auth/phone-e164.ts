/** A country whose mobile numbers parents may sign in with. */
export interface PhoneCountry {
  /** ISO 3166-1 alpha-2. */
  readonly country: string;
  /** The calling code, without the plus. */
  readonly dialCode: string;
  /** How many digits follow the calling code (no trunk 0). */
  readonly nationalDigits: number;
}

/**
 * The countries parent sign-in accepts (spec 05 Parent app step 2). Sri Lanka only for now: the
 * product owner's answer to OQ12 (D35). The list is data, so adding a country is one entry here,
 * by owner decision only.
 */
export const PHONE_COUNTRIES: readonly PhoneCountry[] = Object.freeze([
  Object.freeze({ country: 'LK', dialCode: '94', nationalDigits: 9 }),
]);

export type PhoneParse =
  | { readonly ok: true; readonly e164: string }
  | { readonly ok: false; readonly reason: 'unsupported_country' | 'invalid_number' };

const INVALID: PhoneParse = { ok: false, reason: 'invalid_number' };
const UNSUPPORTED: PhoneParse = { ok: false, reason: 'unsupported_country' };

/** Spaces, dots, hyphens and brackets people type between digits. */
const SEPARATORS = /[\s.()-]/g;

function nationalNumber(phoneCountry: PhoneCountry, digits: string): PhoneParse {
  const pattern = new RegExp(`^[1-9]\\d{${phoneCountry.nationalDigits - 1}}$`);
  return pattern.test(digits) ? { ok: true, e164: `+${phoneCountry.dialCode}${digits}` } : INVALID;
}

/**
 * A mobile number of `country` in E.164, from the national digits (`77 000 0001`) or the full
 * number (`+94 77 000 0001`). The national part has exactly the country's digits and no leading
 * 0 (spec 05: "9 digits after +94, without the leading 0").
 */
export function parsePhone(country: string, input: string): PhoneParse {
  const phoneCountry = PHONE_COUNTRIES.find((candidate) => candidate.country === country);
  if (phoneCountry === undefined) return UNSUPPORTED;
  const compact = input.replace(SEPARATORS, '');
  const prefix = `+${phoneCountry.dialCode}`;
  if (compact.startsWith('+')) {
    return compact.startsWith(prefix)
      ? nationalNumber(phoneCountry, compact.slice(prefix.length))
      : INVALID;
  }
  return nationalNumber(phoneCountry, compact);
}

/**
 * A full number with its calling code (`+94 77 000 0001`), as the parent app sends it: the
 * country comes from the code, and a code that is not on `PHONE_COUNTRIES` is refused.
 */
export function parseInternationalPhone(input: string): PhoneParse {
  const compact = input.replace(SEPARATORS, '');
  if (!/^\+\d+$/.test(compact)) return INVALID;
  const phoneCountry = PHONE_COUNTRIES.find((candidate) =>
    compact.startsWith(`+${candidate.dialCode}`),
  );
  return phoneCountry === undefined ? UNSUPPORTED : parsePhone(phoneCountry.country, compact);
}
