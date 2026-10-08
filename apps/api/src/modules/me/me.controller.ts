import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Query,
  Res,
} from '@nestjs/common';
import { MeUpdateInput, PageQuerySchema, SessionIdParams } from '@quad/contracts';

import { Authenticated } from '../../common/guards/authenticated.decorator';
import { clearSessionCookies } from '../../common/session/cookies';
import { Auth } from '../../common/session/request-auth';
import { ZodValidationPipe } from '../../common/zod.pipe';
import { CONFIG } from '../../tokens';

import { MeService } from './me.service';

import type { RequestAuth } from '../../common/session/request-auth';
import type { Config } from '../../config';
import type { Me, PageQuery, SessionSummaryList } from '@quad/contracts';
import type { FastifyReply } from 'fastify';

/** Self-scoped routes (spec 06 Me and auth): `@Authenticated`, no permission check (F02). */
@Controller('me')
export class MeController {
  constructor(
    private readonly me: MeService,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  @Get()
  @Authenticated()
  get(@Auth() auth: RequestAuth): Promise<Me> {
    return this.me.get(auth);
  }

  @Patch()
  @Authenticated()
  update(
    @Auth() auth: RequestAuth,
    @Body(new ZodValidationPipe(MeUpdateInput)) body: MeUpdateInput,
  ): Promise<Me> {
    return this.me.update(auth, body);
  }

  @Get('sessions')
  @Authenticated()
  sessions(
    @Auth() auth: RequestAuth,
    @Query(new ZodValidationPipe(PageQuerySchema)) query: PageQuery,
  ): Promise<SessionSummaryList> {
    return this.me.listSessions(auth, query);
  }

  @Delete('sessions/:id')
  @Authenticated()
  @HttpCode(204)
  async revokeSession(
    @Auth() auth: RequestAuth,
    @Param(new ZodValidationPipe(SessionIdParams)) params: SessionIdParams,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    const { current } = await this.me.revokeSession(auth, params.id);
    // Signing this device out: its cookies go too.
    if (current) clearSessionCookies(reply, this.config.APP_ENV);
  }
}
