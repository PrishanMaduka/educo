/** A country whose mobile numbers parents may sign in with. */
export interface PhoneCountry {
  /** ISO 3166-1 alpha-2. */
  readonly country: string;
  /** The calling code, without the plus. */
  readonly dialCode: string;
  /** How many digits follow the calling code (no trunk 0). */
  readonly nationalDigits: number;
  /** The national part of a mobile number, as a regular expression source (SMS needs one). */
  readonly mobilePattern: string;
}

/**
 * The countries parent sign-in accepts (spec 05 Parent app step 2). Sri Lanka only for now: the
 * product owner's answer to OQ12 (D35). The list is data, so adding a country is one entry here,
 * by owner decision only.
 */
export const PHONE_COUNTRIES: readonly PhoneCountry[] = Object.freeze([
  Object.freeze({ country: 'LK', dialCode: '94', nationalDigits: 9, mobilePattern: '7\\d{8}' }),
]);

export type PhoneParse =
  | { readonly ok: true; readonly e164: string }
  | { readonly ok: false; readonly reason: 'unsupported_country' | 'invalid_number' };

const INVALID: PhoneParse = { ok: false, reason: 'invalid_number' };
const UNSUPPORTED: PhoneParse = { ok: false, reason: 'unsupported_country' };

/** Spaces, dots, hyphens and brackets people type between digits. */
const SEPARATORS = /[\s.()-]/g;

function nationalNumber(phoneCountry: PhoneCountry, digits: string): PhoneParse {
  // One trunk 0, as people write it locally (`077 …`), is dropped; the rest must be a mobile.
  const national = digits.startsWith('0') ? digits.slice(1) : digits;
  const pattern = new RegExp(`^${phoneCountry.mobilePattern}$`);
  return national.length === phoneCountry.nationalDigits && pattern.test(national)
    ? { ok: true, e164: `+${phoneCountry.dialCode}${national}` }
    : INVALID;
}

/** `0094 …` is the same as `+94 …` (the international prefix dialled from Sri Lanka). */
const withPlus = (compact: string): string =>
  compact.startsWith('00') ? `+${compact.slice(2)}` : compact;

/**
 * A mobile number of `country` in E.164, from the national digits (`77 000 0001`, or with one
 * trunk 0, `077 000 0001`) or the full number (`+94 77 000 0001`, `0094 77 000 0001`). Only
 * mobiles are accepted, because the code goes by SMS: in Sri Lanka 7 and 8 more digits (spec 05:
 * "9 digits after +94, without the leading 0").
 */
export function parsePhone(country: string, input: string): PhoneParse {
  const phoneCountry = PHONE_COUNTRIES.find((candidate) => candidate.country === country);
  if (phoneCountry === undefined) return UNSUPPORTED;
  const compact = withPlus(input.replace(SEPARATORS, ''));
  const prefix = `+${phoneCountry.dialCode}`;
  if (compact.startsWith('+')) {
    return compact.startsWith(prefix)
      ? nationalNumber(phoneCountry, compact.slice(prefix.length))
      : INVALID;
  }
  return nationalNumber(phoneCountry, compact);
}

/**
 * A full number with its calling code (`+94 77 000 0001` or `0094 77 000 0001`), as the parent
 * app sends it: the country comes from the code, and a code that is not on `PHONE_COUNTRIES` is
 * refused.
 */
export function parseInternationalPhone(input: string): PhoneParse {
  const compact = withPlus(input.replace(SEPARATORS, ''));
  if (!/^\+\d+$/.test(compact)) return INVALID;
  const phoneCountry = PHONE_COUNTRIES.find((candidate) =>
    compact.startsWith(`+${candidate.dialCode}`),
  );
  return phoneCountry === undefined ? UNSUPPORTED : parsePhone(phoneCountry.country, compact);
}
