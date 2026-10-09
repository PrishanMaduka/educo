import { Module } from '@nestjs/common';

import { FailureCounter } from '../../common/lockout/failure-counter';
import { errorForLog } from '../../observability/logger';
import { AuthController } from '../../public/auth/auth.controller';
import { OtpController } from '../../public/auth/otp.controller';
import { PasswordResetController } from '../../public/signed-links/password-reset.controller';
import { PasswordResetService } from '../../public/signed-links/password-reset.service';
import { SupportSessionController } from '../../public/signed-links/support-session.controller';
import { SupportSessionService } from '../../public/signed-links/support-session.service';
import { LOGGER, OTP_SENDS, PASSWORD_RESETS, REDIS } from '../../tokens';
import { TotpController } from '../me/totp.controller';

import { AccountAudit } from './account-audit.service';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { LockoutService } from './lockout.service';
import { MembershipsService } from './memberships.service';
import { BullOtpSendRequests } from './otp/otp-sends';
import { OtpRepository } from './otp/otp.repository';
import { OtpService } from './otp/otp.service';
import { BullPasswordResetRequests } from './password-reset-requests';
import { SignInSessions } from './sign-in-session.service';
import { SignInService } from './sign-in.service';
import { ParentTokens } from './tokens/parent-tokens';
import { RefreshService } from './tokens/refresh.service';
import { TokenService } from './tokens/token.service';
import { TwoStepService } from './two-step.service';

import type { OtpSendRequests } from './otp/otp-sends';
import type { PasswordResetRequests } from './password-reset-requests';
import type { DynamicModule } from '@nestjs/common';
import type { Redis } from 'ioredis';
import type { Logger } from 'pino';

/**
 * Staff sign-in with work email and password (spec 05; no Google or Microsoft sign-in, D37),
 * and parent sign-in with a code (`./otp`) and its tokens (`./tokens`): the services live here,
 * the tenant-less controllers in `src/public/auth` and `src/public/signed-links` (ruling F14),
 * and `POST /me/totp` from `modules/me/totp.controller.ts`. Tests may replace the Forgot
 * password and sign-in code queues. Global, exporting the sign-in steps and the account reads, so
 * accepting a staff invitation (`UsersModule`, OQ9) continues sign-in the same way.
 */
@Module({})
export class AuthModule {
  static register(
    passwordResets?: PasswordResetRequests,
    otpSends?: OtpSendRequests,
  ): DynamicModule {
    return {
      module: AuthModule,
      global: true,
      exports: [SignInService, AuthRepository],
      controllers: [
        AuthController,
        OtpController,
        PasswordResetController,
        SupportSessionController,
        TotpController,
      ],
      providers: [
        AccountAudit,
        AuthRepository,
        AuthService,
        FailureCounter,
        LockoutService,
        MembershipsService,
        SignInSessions,
        SignInService,
        TwoStepService,
        OtpRepository,
        OtpService,
        ParentTokens,
        RefreshService,
        TokenService,
        PasswordResetService,
        SupportSessionService,
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
        otpSends === undefined
          ? {
              provide: OTP_SENDS,
              inject: [REDIS, LOGGER],
              useFactory: (redis: Redis, logger: Logger): OtpSendRequests =>
                new BullOtpSendRequests(redis, (error) => {
                  logger.warn({ error: errorForLog(error) }, 'Sign-in code queue error');
                }),
            }
          : { provide: OTP_SENDS, useValue: otpSends },
      ],
    };
  }
}
