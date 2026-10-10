import { Module } from '@nestjs/common';

import { CONFIG, LOGGER, TURNSTILE } from '../../tokens';

import { CloudflareTurnstile } from './cloudflare-turnstile';
import { LocalTurnstile } from './local-turnstile';

import type { TurnstileVerifier } from './turnstile';
import type { Config } from '../../config';
import type { Logger } from 'pino';

/**
 * Cloudflare when a secret is set; the offline verifier only locally without one (D57). Config
 * already requires the secret and hostname outside local, so the throws are a second lock: the
 * offline verifier can never answer in staging or production.
 */
export function createTurnstileVerifier(config: Config, logger: Logger): TurnstileVerifier {
  const secret = config.TURNSTILE_SECRET_KEY;
  if (secret === undefined) {
    if (config.APP_ENV === 'local') return new LocalTurnstile();
    throw new Error(`TURNSTILE_SECRET_KEY must be set when APP_ENV is ${config.APP_ENV}.`);
  }
  const expectedHostname = config.TURNSTILE_EXPECTED_HOSTNAME;
  if (expectedHostname === undefined) {
    throw new Error('TURNSTILE_EXPECTED_HOSTNAME must be set with TURNSTILE_SECRET_KEY.');
  }
  return new CloudflareTurnstile({ secret, expectedHostname, logger });
}

/** Provides the Turnstile verifier under `TURNSTILE`, for the public demo request route. */
@Module({
  providers: [
    {
      provide: TURNSTILE,
      inject: [CONFIG, LOGGER],
      useFactory: createTurnstileVerifier,
    },
  ],
  exports: [TURNSTILE],
})
export class TurnstileModule {}
