import { Controller, Get, Query } from '@nestjs/common';
import { PlatformNoInput } from '@quad/contracts';

import { PlatformController } from '../../common/guards/platform-controller.decorator';
import { ZodValidationPipe } from '../../common/zod.pipe';
import { Console } from '../auth/console-auth';
import { PlatformRole } from '../auth/platform-roles.decorator';

import type { ConsoleAuth } from '../auth/console-auth';
import type { PlatformMe } from '@quad/contracts';

/** The signed-in console user (spec 06 → Platform): any platform role. */
@PlatformController()
@Controller('platform/me')
export class PlatformMeController {
  @Get()
  @PlatformRole()
  get(
    // Validated only: the route takes no query (400 for anything sent).
    @Query(new ZodValidationPipe(PlatformNoInput)) _query: PlatformNoInput,
    @Console() auth: ConsoleAuth,
  ): PlatformMe {
    return { id: auth.platformUserId, name: auth.name, role: auth.role };
  }
}
