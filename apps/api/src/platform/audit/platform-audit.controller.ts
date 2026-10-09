import { Controller, Get, Inject, Query, Req, Res } from '@nestjs/common';
import { PlatformAuditLogQuery } from '@quad/contracts';

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
import type { PlatformAuditLog } from '@quad/contracts';
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
}
