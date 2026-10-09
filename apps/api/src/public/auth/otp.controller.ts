import { Body, Controller, HttpCode, Inject, Post, Req } from '@nestjs/common';
import { OtpRequestInput, OtpVerifyInput, RefreshInput } from '@quad/contracts';

import { Public } from '../../common/guards/public.decorator';
import { ZodValidationPipe } from '../../common/zod.pipe';
import { OtpService } from '../../modules/auth/otp/otp.service';
import { RefreshService } from '../../modules/auth/tokens/refresh.service';
import { CONFIG } from '../../tokens';

import { signInClientOf } from './sign-in-http';

import type { Config } from '../../config';
import type { OtpVerifyResult, TokenPair } from '@quad/contracts';
import type { FastifyRequest } from 'fastify';

/**
 * Parent sign-in (spec 05 Parent app; spec 06 Me and auth): ask for a code, check it, and keep
 * the tokens fresh. Tenant-less (D16): the school comes only from the account's own guardian and
 * relative memberships once the code is right, never from the request. Every route is in the
 * per-IP sign-in bucket (20 per minute); the per-number limits are `otpSendDecision`'s.
 */
@Controller('auth')
export class OtpController {
  constructor(
    private readonly otp: OtpService,
    private readonly tokens: RefreshService,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  @Post('otp/request')
  @Public()
  @HttpCode(202)
  async request(
    @Body(new ZodValidationPipe(OtpRequestInput)) body: OtpRequestInput,
  ): Promise<void> {
    await this.otp.request(body);
  }

  @Post('otp/verify')
  @Public()
  @HttpCode(200)
  verify(
    @Body(new ZodValidationPipe(OtpVerifyInput)) body: OtpVerifyInput,
    @Req() request: FastifyRequest,
  ): Promise<OtpVerifyResult> {
    return this.otp.verify(body, signInClientOf(request, this.config.APP_ENV));
  }

  @Post('refresh')
  @Public()
  @HttpCode(200)
  refresh(@Body(new ZodValidationPipe(RefreshInput)) body: RefreshInput): Promise<TokenPair> {
    return this.tokens.refresh(body.refreshToken);
  }
}
