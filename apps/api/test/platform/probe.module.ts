import { Controller, Get, Module } from '@nestjs/common';

import { PlatformController } from '../../src/common/guards/platform-controller.decorator';
import { PlatformRole } from '../../src/platform/auth/platform-roles.decorator';

/**
 * Test-only console routes behind the real guards (`AppOverrides.testModules`), so the OpenAPI
 * document and the app are unchanged: an owner-only route. Routes with no marker, or with
 * `@PlatformRole` on a school controller, no longer start the API (`test/routes-guarded.test.ts`).
 */
@PlatformController()
@Controller('platform/probe')
class PlatformRoleProbeController {
  @Get('owner')
  @PlatformRole('owner')
  owner(): { ok: true } {
    return { ok: true };
  }
}

@Module({ controllers: [PlatformRoleProbeController] })
export class PlatformProbeModule {}
