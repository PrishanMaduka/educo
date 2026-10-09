import { Controller, Get, Inject, Query, Req, Res } from '@nestjs/common';
import { AuditLogQuery } from '@quad/contracts';

import { PermissionsService } from '../../common/access/permissions.service';
import { sendCsv, varyOnAccept, wantsCsv } from '../../common/export/csv';
import { Can } from '../../common/guards/can.decorator';
import { Auth } from '../../common/session/request-auth';
import { ZodValidationPipe } from '../../common/zod.pipe';
import { CLOCK } from '../../tokens';

import { AuditLogService } from './audit-log.service';

import type { RequestAuth } from '../../common/session/request-auth';
import type { Clock } from '../../tokens';
import type { AuditLog, AuditPeople } from '@quad/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';

/** Settings → Audit (spec 06 `GET /audit`; spec 08): the school's audit log and its export. */
@Controller('audit')
export class AuditLogController {
  constructor(
    private readonly auditLog: AuditLogService,
    private readonly access: PermissionsService,
    @Inject(CLOCK) private readonly now: Clock,
  ) {}

  @Get()
  @Can('settings.view')
  async list(
    @Auth() auth: RequestAuth,
    @Query(new ZodValidationPipe(AuditLogQuery)) query: AuditLogQuery,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuditLog | string> {
    varyOnAccept(reply);
    if (!wantsCsv(request)) return this.auditLog.list(auth, query);
    const access = await this.access.forRequest(request);
    const csv = await this.auditLog.export(auth, access, query, request.ip);
    return sendCsv(reply, 'quad-audit', new Date(this.now()), csv);
  }

  @Get('people')
  @Can('settings.view')
  people(@Auth() auth: RequestAuth): Promise<AuditPeople> {
    return this.auditLog.people(auth);
  }
}
