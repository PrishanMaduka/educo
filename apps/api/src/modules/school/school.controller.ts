import { Body, Controller, Get, Patch, Req, Res } from '@nestjs/common';
import { SchoolUpdateInput } from '@quad/contracts';

import { ifMatchOf } from '../../common/etag/etag';
import { Authenticated } from '../../common/guards/authenticated.decorator';
import { Can } from '../../common/guards/can.decorator';
import { Auth } from '../../common/session/request-auth';
import { ZodValidationPipe } from '../../common/zod.pipe';

import { SchoolService } from './school.service';

import type { RequestAuth } from '../../common/session/request-auth';
import type { School, SchoolBranding, SchoolSettings } from '@quad/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';

/** Settings → School settings (spec 06 School settings and people; spec 08). */
@Controller()
export class SchoolController {
  constructor(private readonly school: SchoolService) {}

  @Get('school')
  @Can('settings.view')
  async get(
    @Auth() auth: RequestAuth,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<School> {
    const school = await this.school.get(auth);
    void reply.header('etag', school.etag);
    return school;
  }

  @Patch('school')
  @Can('settings.edit')
  async update(
    @Auth() auth: RequestAuth,
    @Body(new ZodValidationPipe(SchoolUpdateInput)) body: SchoolUpdateInput,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<School> {
    const school = await this.school.update(auth, body, ifMatchOf(request), request.ip);
    void reply.header('etag', school.etag);
    return school;
  }

  @Get('school/branding')
  @Authenticated()
  branding(@Auth() auth: RequestAuth): Promise<SchoolBranding> {
    return this.school.branding(auth);
  }

  @Get('settings')
  @Can('settings.view')
  settings(@Auth() auth: RequestAuth): Promise<SchoolSettings> {
    return this.school.settings(auth);
  }
}
