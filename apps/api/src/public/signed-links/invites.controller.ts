import { Body, Controller, Get, HttpCode, Inject, Param, Post, Req, Res } from '@nestjs/common';
import { InviteAcceptInput, InviteTokenParams } from '@quad/contracts';

import { CsrfError } from '../../common/errors';
import { Public } from '../../common/guards/public.decorator';
import { CSRF_HEADER, CsrfTokens } from '../../common/session/csrf';
import { RequestAuthenticator } from '../../common/session/request-auth';
import { ZodValidationPipe } from '../../common/zod.pipe';
import { InvitesService } from '../../modules/users/invites.service';
import { CONFIG } from '../../tokens';
import { applySignInCookies, signInClientOf } from '../auth/sign-in-http';

import type { Config } from '../../config';
import type { SignedInAccount } from '../../modules/users/invites.service';
import type { InviteDetails, SignInResult } from '@quad/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';

/** The sign-in steps after which a person counts as signed in (two-step done). */
const SIGNED_IN_STAGES: ReadonlySet<string> = new Set(['choose_school', 'active']);

/**
 * The staff invite link (spec 05 Account edge cases; spec 06 Invites; OQ9). Tenant-less and
 * signed (D16): the school comes only from the verified `staff_invite` token, every bad link is
 * 400 `invalid_link` without a school name, and both routes are in the per-IP sign-in bucket
 * (`/auth/*`). Request logs record the route template, never the token.
 */
@Controller('auth/invites')
export class InvitesController {
  constructor(
    private readonly invites: InvitesService,
    private readonly authenticator: RequestAuthenticator,
    private readonly csrf: CsrfTokens,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  @Get(':token')
  @Public()
  details(
    @Param(new ZodValidationPipe(InviteTokenParams)) params: InviteTokenParams,
  ): Promise<InviteDetails> {
    return this.invites.details(params.token);
  }

  @Post(':token/accept')
  @Public()
  @HttpCode(200)
  async accept(
    @Param(new ZodValidationPipe(InviteTokenParams)) params: InviteTokenParams,
    @Body(new ZodValidationPipe(InviteAcceptInput)) body: InviteAcceptInput,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<SignInResult> {
    const outcome = await this.invites.accept(
      params.token,
      body,
      await this.signedIn(request),
      signInClientOf(request, this.config.APP_ENV),
    );
    applySignInCookies(reply, this.config.APP_ENV, outcome);
    return { next: outcome.next };
  }

  /**
   * The staff browser session on this request once two-step is done, or null. The route is
   * public (a new invitee has no session), so the CSRF check `AuthGuard` makes on cookie writes
   * is made here for a session that counts.
   */
  private async signedIn(request: FastifyRequest): Promise<SignedInAccount | null> {
    const auth = await this.authenticator.fromRequest(request);
    if (auth?.kind !== 'web' || !SIGNED_IN_STAGES.has(auth.stage)) return null;
    if (!this.csrf.verify(auth.tokenHash, request.headers[CSRF_HEADER])) throw new CsrfError();
    return { accountId: auth.accountId };
  }
}
