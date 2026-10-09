import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import {
  PasswordForgotInput,
  PasswordSignInInput,
  SelectSchoolInput,
  TotpVerifyInput,
} from '@quad/contracts';

import { formatMessage } from '../../common/delivery/templates/render';
import { ForbiddenError } from '../../common/errors';
import { Authenticated } from '../../common/guards/authenticated.decorator';
import { PreAuth } from '../../common/guards/pre-auth.decorator';
import { AllowDuringPreview } from '../../common/guards/preview-read-only.guard';
import { Public } from '../../common/guards/public.decorator';
import { RelativeAccess } from '../../common/guards/relative-access.decorator';
import { AllowWhileSuspended } from '../../common/guards/tenant-status.guard';
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator';
import { clearSessionCookies } from '../../common/session/cookies';
import { Auth } from '../../common/session/request-auth';
import { ZodValidationPipe } from '../../common/zod.pipe';
import { AuthService } from '../../modules/auth/auth.service';
import { MembershipsService } from '../../modules/auth/memberships.service';
import { SignInService } from '../../modules/auth/sign-in.service';
import { TokenService } from '../../modules/auth/tokens/token.service';
import { TwoStepService } from '../../modules/auth/two-step.service';
import { CONFIG } from '../../tokens';
import { SupportSessionService } from '../signed-links/support-session.service';

import {
  applyLastSchoolCookie,
  applySignInCookies,
  bodyEmail,
  signInClientOf,
} from './sign-in-http';

import type { RequestAuth } from '../../common/session/request-auth';
import type { Config } from '../../config';
import type { SignInMembershipList, SelectSchoolTokens, SignInResult } from '@quad/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';

/** Spec 05: per-email limits on top of the per-IP sign-in bucket (ruling F65). */
const PER_EMAIL = { limit: 10, windowSeconds: 15 * 60, key: bodyEmail } as const;
/** Forgot password sends email, so it is tighter. */
const FORGOT_PER_EMAIL = { limit: 3, windowSeconds: 15 * 60, key: bodyEmail } as const;

/**
 * Staff sign-in (spec 05; spec 06 Me and auth). Tenant-less (D16, ruling F14): the school is
 * never read from the request; it comes from the account's own memberships after the password
 * (and two-step) step. Every route is in the per-IP sign-in bucket (20 per minute).
 * `POST /auth/select-school` and `POST /auth/sign-out` also serve the parent app's bearer token
 * (Task 9): the token gets a pair back instead of cookies, and only guardian and relative
 * memberships (the kind rule, D32).
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly signIn: SignInService,
    private readonly twoStep: TwoStepService,
    private readonly schools: MembershipsService,
    private readonly tokens: TokenService,
    private readonly supportSessions: SupportSessionService,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  @Post('password')
  @Public()
  @HttpCode(200)
  @RateLimit(PER_EMAIL)
  async password(
    @Body(new ZodValidationPipe(PasswordSignInInput)) body: PasswordSignInInput,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<SignInResult> {
    const outcome = await this.signIn.password(body, signInClientOf(request, this.config.APP_ENV));
    applySignInCookies(reply, this.config.APP_ENV, outcome);
    return { next: outcome.next };
  }

  @Post('totp/verify')
  @PreAuth('two_step')
  @HttpCode(200)
  async verifyTwoStep(
    @Auth() auth: RequestAuth,
    @Body(new ZodValidationPipe(TotpVerifyInput)) body: TotpVerifyInput,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<SignInResult> {
    const outcome = await this.twoStep.verifyAtSignIn(
      auth,
      body,
      signInClientOf(request, this.config.APP_ENV),
    );
    applySignInCookies(reply, this.config.APP_ENV, outcome);
    return { next: outcome.next };
  }

  @Get('memberships')
  @PreAuth('choose_school', 'active')
  memberships(@Auth() auth: RequestAuth): Promise<SignInMembershipList> {
    return this.schools.listFor(auth);
  }

  @Post('select-school')
  @Authenticated({ alsoAtStages: ['choose_school'] })
  @HttpCode(204)
  async selectSchool(
    @Auth() auth: RequestAuth,
    @Body(new ZodValidationPipe(SelectSchoolInput)) body: SelectSchoolInput,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<SelectSchoolTokens | undefined> {
    if (auth.kind === 'mobile') {
      // The parent app gets its tokens in the body (Nest leaves a status set here alone).
      const pair = await this.tokens.selectSchool(auth, body, request.ip);
      void reply.status(200);
      return pair;
    }
    const { next, session, lastSchool } = await this.signIn.selectSchool(
      auth,
      body,
      signInClientOf(request, this.config.APP_ENV),
    );
    applySignInCookies(reply, this.config.APP_ENV, { session });
    if (next === 'two_step_setup') {
      // The chosen school needs two-step first (fix round 1, I2): the session moved to set-up
      // (its new cookies are set), the school is not opened, and the page shows the set-up step.
      throw new ForbiddenError('two_step_required', formatMessage('error.twoStepRequired'));
    }
    applyLastSchoolCookie(reply, this.config.APP_ENV, lastSchool);
    return undefined;
  }

  @Post('sign-out')
  @Authenticated({ alsoAtStages: ['two_step', 'two_step_setup', 'choose_school'] })
  @RelativeAccess()
  // A person can always leave: in a suspended school and while previewing a role (Task 12).
  @AllowWhileSuspended()
  @AllowDuringPreview()
  @HttpCode(204)
  async signOut(
    @Auth() auth: RequestAuth,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    if (auth.kind === 'mobile') {
      await this.tokens.signOut(auth, request.ip);
      return;
    }
    if (auth.kind === 'support') {
      // Signing out of a support visit ends it, as "Exit to platform" does (Task 16).
      await this.supportSessions.end(auth.tokenHash, request.ip);
      clearSessionCookies(reply, this.config.APP_ENV);
      return;
    }
    await this.auth.signOut(auth, request.ip);
    clearSessionCookies(reply, this.config.APP_ENV);
  }

  @Post('password/forgot')
  @Public()
  @HttpCode(202)
  @RateLimit(FORGOT_PER_EMAIL)
  async forgot(
    @Body(new ZodValidationPipe(PasswordForgotInput)) body: PasswordForgotInput,
  ): Promise<void> {
    await this.auth.forgot(body.email);
  }
}
