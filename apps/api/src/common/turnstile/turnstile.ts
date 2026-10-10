import type { TurnstileAction } from '@quad/contracts';

/**
 * Cloudflare's server-side validation endpoint. A constant, not a setting, so the secret can
 * only ever be posted to Cloudflare (D57).
 */
export const TURNSTILE_SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** One token to check: from the request body, the client IP and the form's action. */
export interface TurnstileCheck {
  readonly token: string;
  readonly remoteIp: string;
  readonly action: TurnstileAction;
}

/**
 * `pass` lets the request through; `fail` is 400 `captcha_failed`; `unavailable` (Cloudflare
 * could not be asked) is 503 `captcha_unavailable`: the check fails closed (D57).
 */
export type TurnstileOutcome = 'pass' | 'fail' | 'unavailable';

export interface TurnstileResult {
  readonly outcome: TurnstileOutcome;
}

/** Verifies a Turnstile token (`TURNSTILE` token; tests pass `FakeTurnstile`). */
export interface TurnstileVerifier {
  verify(check: TurnstileCheck): Promise<TurnstileResult>;
}
