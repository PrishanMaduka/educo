import { Body, Controller, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import {
  PlatformNoInput,
  PlatformPasswordSignInInput,
  PlatformTotpSetupInput,
  PlatformTotpVerifyInput,
} from '@quad/contracts';

import { PlatformController } from '../../common/guards/platform-controller.decorator';
import { PreAuth } from '../../common/guards/pre-auth.decorator';
import { Public } from '../../common/guards/public.decorator';
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator';
import { clearConsoleSessionCookies, setConsoleSessionCookies } from '../../common/session/cookies';
import { ZodValidationPipe } from '../../common/zod.pipe';
import { bodyEmail, userAgentOf } from '../../public/auth/sign-in-http';
import { CONFIG } from '../../tokens';

import { Console } from './console-auth';
import { PlatformAuthService } from './platform-auth.service';
import { DuringConsoleSignIn, PlatformRole } from './platform-roles.decorator';

import type { ConsoleAuth } from './console-auth';
import type { ConsoleClient } from './platform-auth.service';
import type { Config } from '../../config';
import type { PlatformSignInResult, PlatformTotpSetup } from '@quad/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';

/** Spec 05: per-email limits on top of the per-IP sign-in bucket, as staff sign-in (F65). */
const PER_EMAIL = { limit: 10, windowSeconds: 15 * 60, key: bodyEmail } as const;

const clientOf = (request: FastifyRequest): ConsoleClient => ({
  ip: request.ip,
  userAgent: userAgentOf(request),
});

/**
 * Console sign-in (spec 05 → Platform console; spec 06: under `/platform/auth/*`, never
 * `/auth/*`): email and password, then the authenticator (set up on first sign-in), in every
 * environment (D37). A session at a sign-in step reaches only `totp/setup`, `totp/verify` and
 * `sign-out`. Every route is in the per-IP sign-in bucket (20 per minute).
 */
@PlatformController()
@Controller('platform/auth')
export class PlatformAuthController {
  constructor(
    private readonly auth: PlatformAuthService,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  @Post('password')
  @Public()
  @HttpCode(200)
  @RateLimit(PER_EMAIL)
  async password(
    @Body(new ZodValidationPipe(PlatformPasswordSignInInput)) body: PlatformPasswordSignInInput,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<PlatformSignInResult> {
    const outcome = await this.auth.password(body, clientOf(request));
    setConsoleSessionCookies(reply, this.config.APP_ENV, outcome.cookies);
    return { next: outcome.next };
  }

  @Post('totp/setup')
  @PreAuth('two_step_setup')
  @HttpCode(200)
  setUpTotp(
    @Console() auth: ConsoleAuth,
    @Body(new ZodValidationPipe(PlatformTotpSetupInput)) _body: PlatformTotpSetupInput,
    @Req() request: FastifyRequest,
  ): Promise<PlatformTotpSetup> {
    return this.auth.setUpTotp(auth, clientOf(request));
  }

  @Post('totp/verify')
  @PreAuth('two_step', 'two_step_setup')
  @HttpCode(200)
  async verifyTotp(
    @Console() auth: ConsoleAuth,
    @Body(new ZodValidationPipe(PlatformTotpVerifyInput)) body: PlatformTotpVerifyInput,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<PlatformSignInResult> {
    const outcome = await this.auth.verifyTotp(auth, body, clientOf(request));
    setConsoleSessionCookies(reply, this.config.APP_ENV, outcome.cookies);
    return { next: outcome.next };
  }

  @Post('sign-out')
  @PlatformRole()
  @DuringConsoleSignIn()
  @HttpCode(204)
  async signOut(
    @Console() auth: ConsoleAuth,
    @Body(new ZodValidationPipe(PlatformNoInput)) _body: PlatformNoInput,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    await this.auth.signOut(auth, clientOf(request));
    clearConsoleSessionCookies(reply, this.config.APP_ENV);
  }
}
