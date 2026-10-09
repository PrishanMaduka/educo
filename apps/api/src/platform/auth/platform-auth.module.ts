import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { FailureCounter } from '../../common/lockout/failure-counter';
import { CONSOLE_SESSIONS } from '../../tokens';
import { PlatformMeController } from '../me/platform-me.controller';
import { PlatformCoreModule } from '../platform-core.module';

import { ConsoleSessions } from './console-sessions.service';
import { PlatformAuthController } from './platform-auth.controller';
import { PlatformAuthRepository } from './platform-auth.repository';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformSessionGuard } from './platform-session.guard';

/**
 * Console sign-in and sessions (Task 10): the `/platform/auth/*` routes, `GET /platform/me`, the
 * global `PlatformSessionGuard` that owns every `@PlatformController()` class, and the console
 * session lookup for sockets. Global only so `RequestAuthenticator` (in the global
 * `SessionModule`) can inject `CONSOLE_SESSIONS`; `PLATFORM_DB` itself stays inside
 * `src/platform`.
 */
@Global()
@Module({
  imports: [PlatformCoreModule],
  controllers: [PlatformAuthController, PlatformMeController],
  providers: [
    PlatformAuthRepository,
    PlatformAuthService,
    ConsoleSessions,
    FailureCounter,
    { provide: CONSOLE_SESSIONS, useExisting: ConsoleSessions },
    { provide: APP_GUARD, useClass: PlatformSessionGuard },
  ],
  exports: [CONSOLE_SESSIONS],
})
export class PlatformAuthModule {}
