import { Controller, Get, Inject, Query, Req, Res } from '@nestjs/common';
import { PlatformAuditLogQuery, PlatformNoInput } from '@quad/contracts';

import { sendCsv, varyOnAccept, wantsCsv } from '../../common/export/csv';
import { PlatformController } from '../../common/guards/platform-controller.decorator';
import { ZodValidationPipe } from '../../common/zod.pipe';
import { userAgentOf } from '../../public/auth/sign-in-http';
import { CLOCK } from '../../tokens';
import { Console } from '../auth/console-auth';
import { PlatformRole } from '../auth/platform-roles.decorator';

import { PlatformAuditLogService } from './platform-audit-log.service';

import type { Clock } from '../../tokens';
import type { ConsoleAuth } from '../auth/console-auth';
import type { PlatformAuditLog, PlatformAuditPeople } from '@quad/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';

/** The console's Audit log (spec 06 → Platform `GET /platform/audit`; spec 07): any role. */
@PlatformController()
@Controller('platform/audit')
export class PlatformAuditController {
  constructor(
    private readonly auditLog: PlatformAuditLogService,
    @Inject(CLOCK) private readonly now: Clock,
  ) {}

  @Get()
  @PlatformRole()
  async list(
    @Query(new ZodValidationPipe(PlatformAuditLogQuery)) query: PlatformAuditLogQuery,
    @Console() auth: ConsoleAuth,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<PlatformAuditLog | string> {
    varyOnAccept(reply);
    if (!wantsCsv(request)) return this.auditLog.list(query);
    const client = { ip: request.ip, userAgent: userAgentOf(request) };
    const csv = await this.auditLog.export(auth, query, client);
    return sendCsv(reply, 'quad-platform-audit', new Date(this.now()), csv);
  }

  /** The Quad staff who appear in the log, for the actor filter (D50): any role. */
  @Get('people')
  @PlatformRole()
  people(
    // Validated only: the route takes no query (400 for anything sent).
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the pipe is the point
    @Query(new ZodValidationPipe(PlatformNoInput)) _query: PlatformNoInput,
  ): Promise<PlatformAuditPeople> {
    return this.auditLog.people();
  }
}
