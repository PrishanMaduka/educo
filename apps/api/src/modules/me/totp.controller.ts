import { Body, Controller, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { TotpSetupInput } from '@quad/contracts';

import { PreAuth } from '../../common/guards/pre-auth.decorator';
import { Auth } from '../../common/session/request-auth';
import { ZodValidationPipe } from '../../common/zod.pipe';
import { applySignInCookies, signInClientOf } from '../../public/auth/sign-in-http';
import { CONFIG } from '../../tokens';
import { TwoStepService } from '../auth/two-step.service';

import type { RequestAuth } from '../../common/session/request-auth';
import type { Config } from '../../config';
import type { TotpSetupResult } from '@quad/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * `POST /me/totp`: set up an authenticator, at the sign-in step that asks for one or from an
 * active session (spec 05 step 4; ruling F61). Task 12 refuses it while previewing a role.
 */
@Controller('me/totp')
export class TotpController {
  constructor(
    private readonly twoStep: TwoStepService,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  @Post()
  @PreAuth('two_step_setup', 'active')
  @HttpCode(200)
  async setUp(
    @Auth() auth: RequestAuth,
    @Body(new ZodValidationPipe(TotpSetupInput)) body: TotpSetupInput,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<TotpSetupResult> {
    const { result, outcome } = await this.twoStep.setUp(
      auth,
      body,
      signInClientOf(request, this.config.APP_ENV),
    );
    if (outcome !== null) applySignInCookies(reply, this.config.APP_ENV, outcome);
    return result;
  }
}
