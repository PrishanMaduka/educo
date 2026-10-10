import { Global, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { describe, expect, it } from 'vitest';

import { CloudflareTurnstile } from '../../src/common/turnstile/cloudflare-turnstile';
import { LocalTurnstile } from '../../src/common/turnstile/local-turnstile';
import {
  TurnstileModule,
  createTurnstileVerifier,
} from '../../src/common/turnstile/turnstile.module';
import { loadConfig } from '../../src/config';
import { CONFIG, LOGGER, TURNSTILE } from '../../src/tokens';
import { localEnv, productionEnv } from '../env';

import type { TurnstileVerifier } from '../../src/common/turnstile/turnstile';
import type { Config } from '../../src/config';
import type { Logger } from 'pino';

const logger = { info: () => undefined, warn: () => undefined } as unknown as Logger;

describe('createTurnstileVerifier (D57)', () => {
  it('selects the offline verifier locally when no secret is set', () => {
    expect(createTurnstileVerifier(loadConfig(localEnv()), logger)).toBeInstanceOf(LocalTurnstile);
  });

  it('selects Cloudflare locally when a developer sets a secret', () => {
    const config = loadConfig(
      localEnv({
        TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
        TURNSTILE_EXPECTED_HOSTNAME: 'localhost',
      }),
    );
    expect(createTurnstileVerifier(config, logger)).toBeInstanceOf(CloudflareTurnstile);
  });

  it('selects Cloudflare in production', () => {
    expect(createTurnstileVerifier(loadConfig(productionEnv()), logger)).toBeInstanceOf(
      CloudflareTurnstile,
    );
  });

  it('never falls back to the offline verifier outside local', () => {
    const config: Config = { ...loadConfig(productionEnv()), TURNSTILE_SECRET_KEY: undefined };
    expect(() => createTurnstileVerifier(config, logger)).toThrow(/TURNSTILE_SECRET_KEY/);
  });
});

describe('TurnstileModule', () => {
  it('provides the verifier under TURNSTILE from the validated config', async () => {
    @Global()
    @Module({
      providers: [
        { provide: CONFIG, useValue: loadConfig(localEnv()) },
        { provide: LOGGER, useValue: logger },
      ],
      exports: [CONFIG, LOGGER],
    })
    class TestCoreModule {}

    @Module({ imports: [TestCoreModule, TurnstileModule] })
    class TestRootModule {}

    const context = await NestFactory.createApplicationContext(TestRootModule, { logger: false });
    expect(context.get<symbol, TurnstileVerifier>(TURNSTILE)).toBeInstanceOf(LocalTurnstile);
    await context.close();
  });
});
