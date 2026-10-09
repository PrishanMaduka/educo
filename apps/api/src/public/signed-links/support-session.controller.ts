import { Body, Controller, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { SupportSessionRedeemInput } from '@quad/contracts';

import { CsrfError, UnauthorizedError } from '../../common/errors';
import { Public } from '../../common/guards/public.decorator';
import {
  clearSessionCookies,
  cookieNames,
  hashSessionToken,
  isSessionTokenShape,
  setSessionCookies,
} from '../../common/session/cookies';
import { CSRF_HEADER, CsrfTokens } from '../../common/session/csrf';
import { SessionService } from '../../common/session/session.service';
import { ZodValidationPipe } from '../../common/zod.pipe';
import { CONFIG } from '../../tokens';

import { SupportSessionService } from './support-session.service';

import type { Config } from '../../config';
import type { SignInResult, SupportSessionExit } from '@quad/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Support visits in the staff portal (spec 05 → Support access; D16). Both routes are tenant-less
 * and `@Public`: the redemption is authenticated by the signed link alone (the school comes from
 * the verified token and the visit it names), and "Exit to platform" by the visit's own cookie,
 * so an expired visit can still leave cleanly. Both are in the per-IP sign-in bucket (`/auth/*`)
 * and answered with `Cache-Control: no-store`.
 */
@Controller('auth/support-session')
export class SupportSessionController {
  constructor(
    private readonly support: SupportSessionService,
    private readonly sessions: SessionService,
    private readonly csrf: CsrfTokens,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  /**
   * The link's token is in the body, so request logs never carry it. A staff cookie the browser
   * already holds is signed out on the server only once the link is redeemed, so a refused link
   * signs nobody out.
   */
  @Post()
  @Public()
  @HttpCode(200)
  async redeem(
    @Body(new ZodValidationPipe(SupportSessionRedeemInput)) body: SupportSessionRedeemInput,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<SignInResult> {
    const cookies = await this.support.redeem(body.token, request.ip);
    const previous: unknown = request.cookies[cookieNames(this.config.APP_ENV).session];
    if (isSessionTokenShape(previous)) {
      await this.support.leavePrevious(hashSessionToken(previous), request.ip);
    }
    setSessionCookies(reply, this.config.APP_ENV, cookies);
    return { next: 'done' };
  }

  /**
   * "Exit to platform": the cookie must name a live support visit, or one that expired and is
   * ended now; then the visit ends, the cookies are cleared and the browser is sent to the
   * console. 403 without the CSRF header; 401 for anything else (no cookie, a member's own
   * session, which this route never ends, or a visit already ended). A token is never read.
   */
  @Post('end')
  @Public()
  @HttpCode(200)
  async end(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<SupportSessionExit> {
    const token: unknown = request.cookies[cookieNames(this.config.APP_ENV).session];
    if (!isSessionTokenShape(token)) throw new UnauthorizedError();
    const tokenHash = hashSessionToken(token);
    if (!this.csrf.verify(tokenHash, request.headers[CSRF_HEADER])) throw new CsrfError();
    const auth = await this.sessions.resolve(tokenHash);
    if (auth !== null && auth.kind !== 'support') throw new UnauthorizedError();
    const ended = await this.support.end(tokenHash, request.ip, auth?.tenantId ?? null);
    if (!ended && auth === null) throw new UnauthorizedError();
    clearSessionCookies(reply, this.config.APP_ENV);
    return { redirect: this.config.CONSOLE_URL };
  }
}
