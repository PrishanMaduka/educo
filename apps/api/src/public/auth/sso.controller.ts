import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Redirect,
  Req,
  Res,
} from '@nestjs/common';
import { SsoCallbackQuery, SsoProviderParams, SsoStartInput } from '@quad/contracts';

import { Public } from '../../common/guards/public.decorator';
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator';
import { clearSsoStateCookie, cookieNames, setSsoStateCookie } from '../../common/session/cookies';
import { ZodValidationPipe } from '../../common/zod.pipe';
import { SSO_STATE_TTL_SECONDS } from '../../modules/auth/sso/sso-state';
import { SsoService } from '../../modules/auth/sso/sso.service';
import { CONFIG } from '../../tokens';

import { applySignInCookies, bodyEmail, signInClientOf } from './sign-in-http';

import type { Config } from '../../config';
import type { SsoStartResult } from '@quad/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';

/** Spec 05: per-email limits on top of the per-IP sign-in bucket (ruling F65). */
const PER_EMAIL = { limit: 10, windowSeconds: 15 * 60, key: bodyEmail } as const;

/**
 * Staff single sign-on (spec 05 step 2; spec 06 Me and auth). Tenant-less (D16, ruling F14):
 * neither the path, the query nor the provider names a school; the callback finds it in the
 * account's own memberships. Both routes are in the per-IP sign-in bucket (`/auth/*`).
 */
@Controller('auth/sso')
export class SsoController {
  constructor(
    private readonly sso: SsoService,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  @Post(':provider/start')
  @Public()
  @HttpCode(200)
  @RateLimit(PER_EMAIL)
  async start(
    @Param(new ZodValidationPipe(SsoProviderParams)) params: SsoProviderParams,
    @Body(new ZodValidationPipe(SsoStartInput)) body: SsoStartInput,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<SsoStartResult> {
    const { url, cookie } = await this.sso.start(params.provider, body);
    setSsoStateCookie(reply, this.config.APP_ENV, cookie, SSO_STATE_TTL_SECONDS);
    return { url };
  }

  /** The provider sends the browser here; the API sends it on to the next sign-in step. */
  @Get(':provider/callback')
  @Public()
  @Redirect()
  async callback(
    @Param(new ZodValidationPipe(SsoProviderParams)) params: SsoProviderParams,
    @Query(new ZodValidationPipe(SsoCallbackQuery)) query: SsoCallbackQuery,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ url: string; statusCode: number }> {
    const appEnv = this.config.APP_ENV;
    // Used once, whatever happens next.
    clearSsoStateCookie(reply, appEnv);
    const outcome = await this.sso.callback(
      params.provider,
      query,
      searchOf(request.url),
      request.cookies[cookieNames(appEnv).ssoState],
      signInClientOf(request, appEnv),
    );
    applySignInCookies(reply, appEnv, outcome);
    const next = new URL('/sign-in', this.config.PUBLIC_WEB_URL);
    next.searchParams.set('step', outcome.next);
    return { url: next.href, statusCode: 302 };
  }
}

/** The raw query string of a request URL, with its `?` (the OIDC client reads it whole). */
function searchOf(url: string): string {
  const index = url.indexOf('?');
  return index === -1 ? '' : url.slice(index);
}
