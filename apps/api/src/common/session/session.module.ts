import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { CONFIG } from '../../tokens';
import { AuthGuard } from '../guards/auth.guard';

import { BearerSessions } from './bearer-sessions';
import { CsrfTokens } from './csrf';
import { FamilyRepository } from './family.repository';
import { RequestAuthenticator } from './request-auth';
import { SessionRepository } from './session.repository';
import { SessionService } from './session.service';

import type { Config } from '../../config';

/**
 * Server-side sessions, the parent app's refresh families (`BearerSessions`, Task 9) and the
 * global `AuthGuard` (spec 05; D32). Imported before the area
 * modules, so `AuthGuard` is the first global guard: Task 12's tenant-status, preview and
 * permission guards run after it, on a request it has authenticated.
 */
@Global()
@Module({
  providers: [
    SessionRepository,
    SessionService,
    FamilyRepository,
    BearerSessions,
    RequestAuthenticator,
    {
      provide: CsrfTokens,
      inject: [CONFIG],
      useFactory: (config: Config): CsrfTokens => new CsrfTokens(config.SESSION_SECRET),
    },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [
    SessionService,
    SessionRepository,
    FamilyRepository,
    BearerSessions,
    RequestAuthenticator,
    CsrfTokens,
  ],
})
export class SessionModule {}
