import { TURNSTILE_DUMMY_TOKEN } from '@quad/contracts';

import type {
  TurnstileCheck,
  TurnstileOutcome,
  TurnstileResult,
  TurnstileVerifier,
} from './turnstile';

const OUTCOMES: ReadonlyMap<string, TurnstileOutcome> = new Map([
  [TURNSTILE_DUMMY_TOKEN, 'pass'],
  ['unavailable', 'unavailable'],
]);

/**
 * The offline verifier for `APP_ENV=local` with no `TURNSTILE_SECRET_KEY` (D57), so the e2e
 * stack and integration tests need no network. It passes Cloudflare's dummy token (what the test
 * site keys produce in the browser), answers `unavailable` for the token `unavailable`, and fails
 * every other token, `fail` included.
 */
export class LocalTurnstile implements TurnstileVerifier {
  verify(check: TurnstileCheck): Promise<TurnstileResult> {
    return Promise.resolve({ outcome: OUTCOMES.get(check.token) ?? 'fail' });
  }
}
