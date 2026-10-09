import { Module } from '@nestjs/common';

import { AuthController } from '../../public/auth/auth.controller';
import { PasswordResetController } from '../../public/signed-links/password-reset.controller';
import { PasswordResetService } from '../../public/signed-links/password-reset.service';

import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { LockoutService } from './lockout.service';
import { MembershipsService } from './memberships.service';
import { SignInSessions } from './sign-in-session.service';
import { SignInService } from './sign-in.service';
import { TwoStepService } from './two-step.service';

/**
 * Staff sign-in (spec 05): the services live here, the tenant-less controllers in
 * `src/public/auth` and `src/public/signed-links` (ruling F14). `TwoStepService` is exported for
 * `POST /me/totp` in the Me module.
 */
@Module({
  controllers: [AuthController, PasswordResetController],
  providers: [
    AuthRepository,
    AuthService,
    LockoutService,
    MembershipsService,
    SignInSessions,
    SignInService,
    TwoStepService,
    PasswordResetService,
  ],
  exports: [TwoStepService],
})
export class AuthModule {}
