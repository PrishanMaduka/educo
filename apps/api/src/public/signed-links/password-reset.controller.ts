import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { PasswordResetInput } from '@quad/contracts';

import { Public } from '../../common/guards/public.decorator';
import { ZodValidationPipe } from '../../common/zod.pipe';

import { PasswordResetService } from './password-reset.service';

import type { FastifyRequest } from 'fastify';

/**
 * The password reset link's final submit (spec 05 step 6). Tenant-less and signed (D16): the
 * account comes only from the verified token, and every bad link is 400 `invalid_link` without
 * a school name. The token is in the body, so request logs never carry it.
 */
@Controller('auth/password')
export class PasswordResetController {
  constructor(private readonly passwordReset: PasswordResetService) {}

  @Post('reset')
  @Public()
  @HttpCode(204)
  async reset(
    @Body(new ZodValidationPipe(PasswordResetInput)) body: PasswordResetInput,
    @Req() request: FastifyRequest,
  ): Promise<void> {
    await this.passwordReset.reset(body, request.ip);
  }
}
