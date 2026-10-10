import { z } from 'zod';

/**
 * Cloudflare Turnstile on the public demo form (D57). The widget sends an action, and the API
 * passes a token only when siteverify reports the same one, so a token minted for another form
 * cannot be replayed here.
 */
export const TurnstileAction = z.enum(['demo-request']);
export type TurnstileAction = z.infer<typeof TurnstileAction>;

/**
 * The token Cloudflare's test site keys produce in the browser. The API's offline verifier
 * passes it locally, so the e2e stack needs no network.
 */
export const TURNSTILE_DUMMY_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';

/**
 * Cloudflare's published test secrets: always passes, always fails, and "token already spent".
 * Anyone can read them, so the API refuses them outside local (D57, like D25's placeholders).
 */
export const CLOUDFLARE_TEST_SECRETS = [
  '1x0000000000000000000000000000000AA',
  '2x0000000000000000000000000000000AA',
  '3x0000000000000000000000000000000AA',
] as const;

/**
 * Cloudflare's published test site keys: passes and blocks (visible), passes and blocks
 * (invisible), and forces an interactive challenge. Refused in staging and production builds.
 */
export const CLOUDFLARE_TEST_SITE_KEYS = [
  '1x00000000000000000000AA',
  '2x00000000000000000000AB',
  '1x00000000000000000000BB',
  '2x00000000000000000000BB',
  '3x00000000000000000000FF',
] as const;

const TEST_SECRETS: ReadonlySet<string> = new Set(CLOUDFLARE_TEST_SECRETS);
const TEST_SITE_KEYS: ReadonlySet<string> = new Set(CLOUDFLARE_TEST_SITE_KEYS);

/** True for one of Cloudflare's published test secrets. */
export function isCloudflareTestSecret(value: string): boolean {
  return TEST_SECRETS.has(value.trim());
}

/** True for one of Cloudflare's published test site keys. */
export function isCloudflareTestSiteKey(value: string): boolean {
  return TEST_SITE_KEYS.has(value.trim());
}
