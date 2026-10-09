import { Controller, Get, Inject, Module, Post, Res } from '@nestjs/common';

import { Authenticated } from '../../src/common/guards/authenticated.decorator';
import { PlatformController } from '../../src/common/guards/platform-controller.decorator';
import { PreAuth } from '../../src/common/guards/pre-auth.decorator';
import { Public } from '../../src/common/guards/public.decorator';
import { currentRequestContext } from '../../src/common/request-context';
import { setSessionCookies } from '../../src/common/session/cookies';
import { CONFIG } from '../../src/tokens';

import type { Config } from '../../src/config';
import type { FastifyReply } from 'fastify';

/** Test-only routes behind the real global guard (`AppOverrides.testModules`). */
@Controller('probe')
class AccessProbeController {
  constructor(@Inject(CONFIG) private readonly config: Config) {}

  /** No marker: like a `@Can` route, it needs an active session. */
  @Get('unmarked')
  unmarked(): { ok: true } {
    return { ok: true };
  }

  @Get('public')
  @Public()
  open(): { ok: true } {
    return { ok: true };
  }

  @Post('two-step')
  @PreAuth('two_step')
  twoStep(): { ok: true } {
    return { ok: true };
  }

  @Post('choose')
  @Authenticated({ alsoAtStages: ['choose_school'] })
  choose(): { ok: true } {
    return { ok: true };
  }

  /** What `AuthGuard` put into the request context. */
  @Get('context')
  @Authenticated()
  context(): Record<string, unknown> {
    const context = currentRequestContext();
    return {
      tenantId: context?.tenantId,
      userId: context?.userId,
      accountId: context?.accountId,
      kind: context?.kind,
      previewRoleId: context?.previewRoleId,
      supportSessionId: context?.supportSessionId,
    };
  }

  /** The same, at Choose a school too: no school, so no school guard reads the database. */
  @Get('context/any-stage')
  @Authenticated({ alsoAtStages: ['choose_school'] })
  contextAnyStage(): Record<string, unknown> {
    const context = currentRequestContext();
    return { accountId: context?.accountId, kind: context?.kind };
  }

  /** Sets the staff cookies the way sign-in (Task 7) will. */
  @Post('cookies')
  @Public()
  cookies(@Res({ passthrough: true }) reply: FastifyReply): { ok: true } {
    setSessionCookies(reply, this.config.APP_ENV, { token: 'token', csrf: 'csrf' });
    return { ok: true };
  }
}

/** A console controller: `AuthGuard` leaves it alone (`PlatformSessionGuard` owns it, Task 10). */
@PlatformController()
@Controller('platform/probe')
class PlatformProbeController {
  @Get()
  get(): { ok: true } {
    return { ok: true };
  }
}

@Module({ controllers: [AccessProbeController, PlatformProbeController] })
export class AccessProbeModule {}
