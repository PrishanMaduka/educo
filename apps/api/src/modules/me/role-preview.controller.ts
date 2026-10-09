import { Body, Controller, Delete, HttpCode, Post, Req } from '@nestjs/common';
import { RolePreviewInput } from '@quad/contracts';

import { Authenticated } from '../../common/guards/authenticated.decorator';
import { Can } from '../../common/guards/can.decorator';
import { AllowDuringPreview } from '../../common/guards/preview-read-only.guard';
import { Auth } from '../../common/session/request-auth';
import { ZodValidationPipe } from '../../common/zod.pipe';

import { RolePreviewService } from './role-preview.service';

import type { RequestAuth } from '../../common/session/request-auth';
import type { MePermissions } from '@quad/contracts';
import type { FastifyRequest } from 'fastify';

/** Preview a role (spec 06 Me and auth; spec 08 Users & roles). */
@Controller('me/role-preview')
export class RolePreviewController {
  constructor(private readonly previews: RolePreviewService) {}

  @Post()
  @Can('users.manage')
  @HttpCode(200)
  start(
    @Auth() auth: RequestAuth,
    @Body(new ZodValidationPipe(RolePreviewInput)) body: RolePreviewInput,
    @Req() request: FastifyRequest,
  ): Promise<MePermissions> {
    return this.previews.start(auth, body, request.ip);
  }

  /** The one write a preview allows (Back to my view). */
  @Delete()
  @Authenticated()
  @AllowDuringPreview()
  @HttpCode(204)
  async end(@Auth() auth: RequestAuth, @Req() request: FastifyRequest): Promise<void> {
    await this.previews.end(auth, request.ip);
  }
}
