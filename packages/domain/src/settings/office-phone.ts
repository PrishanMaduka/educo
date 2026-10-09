import { PHONE_COUNTRIES, compactPhone } from '../auth/phone-e164';

import type { PhoneParse } from '../auth/phone-e164';

const INVALID: PhoneParse = { ok: false, reason: 'invalid_number' };

/** E.164: a plus, a country code that does not start with 0, and 8 to 15 digits in all. */
const E164 = /^\+[1-9]\d{7,14}$/;

/** The national part of `compact` for `prefix`: after the code, or as typed, without one trunk 0. */
function nationalPart(compact: string, prefix: string): string | null {
  if (compact.startsWith('+'))
    return compact.startsWith(prefix) ? compact.slice(prefix.length) : null;
  return compact.startsWith('0') ? compact.slice(1) : compact;
}

/**
 * A school's office phone in E.164, checked against the school's own country (D35: a school's
 * phone country comes from its country, never a Sri Lankan default). Unlike parent sign-in, any
 * number of the country's plan is taken, landlines included, as people write it locally
 * (`011 234 5678`) or in full (`+94 11 234 5678`). A country whose plan is not on
 * `PHONE_COUNTRIES` yet takes only a full international number (D32).
 */
export function parseOfficePhone(country: string, input: string): PhoneParse {
  const compact = compactPhone(input);
  const plan = PHONE_COUNTRIES.find((candidate) => candidate.country === country);
  if (plan === undefined) return E164.test(compact) ? { ok: true, e164: compact } : INVALID;
  const national = nationalPart(compact, `+${plan.dialCode}`);
  return national !== null &&
    national.length === plan.nationalDigits &&
    new RegExp(`^${plan.numberPattern}$`).test(national)
    ? { ok: true, e164: `+${plan.dialCode}${national}` }
    : INVALID;
}
