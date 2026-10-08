import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { CONFIG } from '../../tokens';
import { AuthGuard } from '../guards/auth.guard';

import { CsrfTokens } from './csrf';
import { RequestAuthenticator } from './request-auth';
import { SessionRepository } from './session.repository';
import { SessionService } from './session.service';

import type { Config } from '../../config';

/**
 * Server-side sessions and the global `AuthGuard` (spec 05; D32). Imported before the area
 * modules, so `AuthGuard` is the first global guard: Task 12's tenant-status, preview and
 * permission guards run after it, on a request it has authenticated.
 */
@Global()
@Module({
  providers: [
    SessionRepository,
    SessionService,
    RequestAuthenticator,
    {
      provide: CsrfTokens,
      inject: [CONFIG],
      useFactory: (config: Config): CsrfTokens => new CsrfTokens(config.SESSION_SECRET),
    },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [SessionService, RequestAuthenticator, CsrfTokens],
})
export class SessionModule {}
