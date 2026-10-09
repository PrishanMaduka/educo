import { Controller, Get, Module } from '@nestjs/common';

import { PlatformController } from '../../src/common/guards/platform-controller.decorator';
import { PlatformRole } from '../../src/platform/auth/platform-roles.decorator';

/**
 * Test-only console routes behind the real guards (`AppOverrides.testModules`), so the OpenAPI
 * document and the app are unchanged: an owner-only route, and a route with no marker.
 */
@PlatformController()
@Controller('platform/probe')
class PlatformRoleProbeController {
  @Get('owner')
  @PlatformRole('owner')
  owner(): { ok: true } {
    return { ok: true };
  }

  /** No marker: deny by default, whatever the role. */
  @Get('unmarked')
  unmarked(): { ok: true } {
    return { ok: true };
  }
}

/** `@PlatformRole` on a school controller is a mistake: it must never let a staff session in. */
@Controller('probe/platform-role')
class MisplacedPlatformRoleController {
  @Get()
  @PlatformRole()
  misplaced(): { ok: true } {
    return { ok: true };
  }
}

@Module({ controllers: [PlatformRoleProbeController, MisplacedPlatformRoleController] })
export class PlatformProbeModule {}
