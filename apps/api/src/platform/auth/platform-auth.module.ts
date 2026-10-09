import { Global, Module } from '@nestjs/common';
import { APP_GUARD, DiscoveryModule, DiscoveryService } from '@nestjs/core';

import { FailureCounter } from '../../common/lockout/failure-counter';
import { CONSOLE_SESSIONS } from '../../tokens';
import { PlatformMeController } from '../me/platform-me.controller';
import { PlatformCoreModule } from '../platform-core.module';

import { consoleRouteProblems } from './console-routes';
import { ConsoleSessions } from './console-sessions.service';
import { ConsoleSignInFailures } from './console-sign-in-failures';
import { PlatformAuthController } from './platform-auth.controller';
import { PlatformAuthRepository } from './platform-auth.repository';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformSessionGuard } from './platform-session.guard';

import type { OnModuleInit, Type } from '@nestjs/common';

/**
 * Console sign-in and sessions (Task 10): the `/platform/auth/*` routes, `GET /platform/me`, the
 * global `PlatformSessionGuard` that owns every `@PlatformController()` class, and the console
 * session lookup for sockets. Global only so `RequestAuthenticator` (in the global
 * `SessionModule`) can inject `CONSOLE_SESSIONS`; `PLATFORM_DB` itself stays inside
 * `src/platform`.
 */
@Global()
@Module({
  imports: [PlatformCoreModule, DiscoveryModule],
  controllers: [PlatformAuthController, PlatformMeController],
  providers: [
    PlatformAuthRepository,
    PlatformAuthService,
    ConsoleSessions,
    ConsoleSignInFailures,
    FailureCounter,
    { provide: CONSOLE_SESSIONS, useExisting: ConsoleSessions },
    { provide: APP_GUARD, useClass: PlatformSessionGuard },
  ],
  exports: [CONSOLE_SESSIONS],
})
export class PlatformAuthModule implements OnModuleInit {
  constructor(private readonly discovery: DiscoveryService) {}

  /**
   * Refuses to start when a route under `platform/` is outside a `@PlatformController()` class,
   * or a console class serves anything else (`consoleRouteProblems`).
   */
  onModuleInit(): void {
    const controllers = this.discovery
      .getControllers()
      .map((wrapper) => wrapper.metatype)
      .filter((metatype): metatype is Type => typeof metatype === 'function');
    const problems = consoleRouteProblems(controllers);
    if (problems.length > 0) {
      throw new Error(`Console routes are mixed with school routes: ${problems.join('; ')}`);
    }
  }
}
