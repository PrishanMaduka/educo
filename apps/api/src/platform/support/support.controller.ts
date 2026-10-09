import { Body, Controller, HttpCode, Param, Post, Req } from '@nestjs/common';
import { SupportSessionCreateInput, TenantIdParams } from '@quad/contracts';

import { PlatformController } from '../../common/guards/platform-controller.decorator';
import { ZodValidationPipe } from '../../common/zod.pipe';
import { userAgentOf } from '../../public/auth/sign-in-http';
import { Console } from '../auth/console-auth';
import { PlatformRole } from '../auth/platform-roles.decorator';

import { SupportService } from './support.service';

import type { ConsoleAuth } from '../auth/console-auth';
import type { SupportSessionLink } from '@quad/contracts';
import type { FastifyRequest } from 'fastify';

/**
 * "Open as school admin" (spec 05 → Support access): only the `support`, `admin` and `owner`
 * platform roles; `billing` and `readonly` get 403.
 */
@PlatformController()
@Controller('platform/tenants')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Post(':id/support-session')
  @PlatformRole('owner', 'admin', 'support')
  @HttpCode(200)
  open(
    @Param(new ZodValidationPipe(TenantIdParams)) params: TenantIdParams,
    @Body(new ZodValidationPipe(SupportSessionCreateInput)) body: SupportSessionCreateInput,
    @Console() auth: ConsoleAuth,
    @Req() request: FastifyRequest,
  ): Promise<SupportSessionLink> {
    return this.support.open(auth, params.id, body, {
      ip: request.ip,
      userAgent: userAgentOf(request),
    });
  }
}
