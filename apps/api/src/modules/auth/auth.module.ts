import { Module } from '@nestjs/common';

import { errorForLog } from '../../observability/logger';
import { AuthController } from '../../public/auth/auth.controller';
import { SsoController } from '../../public/auth/sso.controller';
import { PasswordResetController } from '../../public/signed-links/password-reset.controller';
import { PasswordResetService } from '../../public/signed-links/password-reset.service';
import { LOGGER, PASSWORD_RESETS, REDIS } from '../../tokens';
import { TotpController } from '../me/totp.controller';

import { AccountAudit } from './account-audit.service';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { LockoutService } from './lockout.service';
import { MembershipsService } from './memberships.service';
import { BullPasswordResetRequests } from './password-reset-requests';
import { SignInSessions } from './sign-in-session.service';
import { SignInService } from './sign-in.service';
import { OidcClients } from './sso/oidc-clients';
import { SsoService } from './sso/sso.service';
import { TwoStepService } from './two-step.service';

import type { PasswordResetRequests } from './password-reset-requests';
import type { DynamicModule } from '@nestjs/common';
import type { Redis } from 'ioredis';
import type { Logger } from 'pino';

/**
 * Staff sign-in (spec 05), SSO included (`./sso`): the services live here, the tenant-less
 * controllers in `src/public/auth` and `src/public/signed-links` (ruling F14), and
 * `POST /me/totp` from `modules/me/totp.controller.ts`. Tests may replace the Forgot password
 * queue.
 */
@Module({})
export class AuthModule {
  static register(passwordResets?: PasswordResetRequests): DynamicModule {
    return {
      module: AuthModule,
      controllers: [AuthController, SsoController, PasswordResetController, TotpController],
      providers: [
        AccountAudit,
        AuthRepository,
        AuthService,
        LockoutService,
        MembershipsService,
        SignInSessions,
        SignInService,
        TwoStepService,
        OidcClients,
        SsoService,
        PasswordResetService,
        passwordResets === undefined
          ? {
              provide: PASSWORD_RESETS,
              inject: [REDIS, LOGGER],
              useFactory: (redis: Redis, logger: Logger): PasswordResetRequests =>
                new BullPasswordResetRequests(redis, (error) => {
                  logger.warn({ error: errorForLog(error) }, 'Password reset queue error');
                }),
            }
          : { provide: PASSWORD_RESETS, useValue: passwordResets },
      ],
    };
  }
}
