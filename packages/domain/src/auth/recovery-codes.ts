/** A source of random bytes (`crypto.randomBytes` in the API; deterministic in tests). */
export type RandomBytes = (length: number) => Uint8Array;

/** Spec 05 step 4: 10 recovery codes. */
export const RECOVERY_CODE_COUNT = 10;

/**
 * 32 characters without the look-alikes i, l, o and u (Crockford's base32, lower-case), so a
 * byte's low five bits pick one without bias.
 */
const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz';
const HALF = 5;

/** Two groups of five: `xxxxx-xxxxx` (50 random bits). */
export const RECOVERY_CODE_PATTERN = /^[0-9a-hjkmnp-tv-z]{5}-[0-9a-hjkmnp-tv-z]{5}$/;

/** Enough tries that only a broken byte source runs out. */
const MAX_DRAWS = 100;

function draw(rng: RandomBytes): string {
  const bytes = rng(2 * HALF);
  const chars = Array.from(bytes, (byte) => ALPHABET.charAt(byte & 31)).join('');
  return `${chars.slice(0, HALF)}-${chars.slice(HALF)}`;
}

/**
 * Ten distinct recovery codes from `rng` (spec 05 step 4). Each is shown once and stored only as
 * a hash; each works once.
 */
export function generateRecoveryCodes(rng: RandomBytes): string[] {
  const codes = new Set<string>();
  for (let draws = 0; codes.size < RECOVERY_CODE_COUNT; draws += 1) {
    if (draws === MAX_DRAWS) {
      throw new Error('The random bytes kept repeating, so no recovery codes were made.');
    }
    codes.add(draw(rng));
  }
  return [...codes];
}

/**
 * A typed recovery code in its stored form: lower-case, spaces and the dash ignored, then
 * `xxxxx-xxxxx`; null when it cannot be one.
 */
export function normaliseRecoveryCode(input: string): string | null {
  const chars = input.toLowerCase().replace(/[\s-]/g, '');
  const code = `${chars.slice(0, HALF)}-${chars.slice(HALF)}`;
  return chars.length === 2 * HALF && RECOVERY_CODE_PATTERN.test(code) ? code : null;
}
