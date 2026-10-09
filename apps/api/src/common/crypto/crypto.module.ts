import { Global, Module } from '@nestjs/common';
import { createFieldCipher } from '@quad/db';

import {
  BREACH_CHECK,
  CLOCK,
  CONFIG,
  FIELD_CIPHER,
  JWT_KEYS,
  LOGGER,
  TENANT_DB,
} from '../../tokens';

import { AccessTokens } from './access-tokens';
import { createBreachCheck } from './breach-check';
import { loadJwtKeys } from './jwt-keys';
import { PasswordHasher } from './passwords';
import { SignedLinks } from './signed-links';
import { TotpCodes } from './totp';

import type { BreachCheck } from './breach-check';
import type { JwtKeys } from './jwt-keys';
import type { Config } from '../../config';
import type { Clock } from '../../tokens';
import type { FieldCipher, QuadTenantDb } from '@quad/db';
import type { Logger } from 'pino';

/**
 * Signed links, password hashing, the breached-password check, the field cipher, the token keys,
 * the parent access tokens and authenticator codes, built once from the validated config (D32).
 * Inject `SignedLinks`, `PasswordHasher`, `TotpCodes` and `AccessTokens` by class, the others by
 * token.
 */
@Global()
@Module({
  providers: [
    PasswordHasher,
    TotpCodes,
    {
      provide: SignedLinks,
      inject: [CONFIG, TENANT_DB],
      useFactory: (config: Config, db: QuadTenantDb): SignedLinks =>
        new SignedLinks(config.LINK_SIGNING_SECRET, (use) => db.definers.consumeSignedToken(use)),
    },
    {
      provide: FIELD_CIPHER,
      inject: [CONFIG],
      useFactory: (config: Config): FieldCipher => createFieldCipher(config.FIELD_ENCRYPTION_KEY),
    },
    {
      provide: JWT_KEYS,
      inject: [CONFIG],
      useFactory: (config: Config): JwtKeys =>
        loadJwtKeys(config.JWT_PRIVATE_KEY, config.JWT_PUBLIC_KEY, config.JWT_PUBLIC_KEY_PREVIOUS),
    },
    {
      provide: AccessTokens,
      inject: [JWT_KEYS, CONFIG, CLOCK],
      useFactory: (keys: JwtKeys, config: Config, now: Clock): Promise<AccessTokens> =>
        AccessTokens.create(keys, new URL(config.PUBLIC_WEB_URL).origin, now),
    },
    {
      provide: BREACH_CHECK,
      inject: [CONFIG, LOGGER],
      useFactory: (config: Config, logger: Logger): BreachCheck =>
        createBreachCheck(config.APP_ENV, logger),
    },
  ],
  exports: [
    PasswordHasher,
    TotpCodes,
    SignedLinks,
    AccessTokens,
    FIELD_CIPHER,
    JWT_KEYS,
    BREACH_CHECK,
  ],
})
export class CryptoModule {}
