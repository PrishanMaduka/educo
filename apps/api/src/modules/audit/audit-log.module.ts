import { Module } from '@nestjs/common';

import { AuditLogService } from './audit-log.service';
import { AuditLogController } from './audit.controller';
import { AuditRepository } from './audit.repository';

/**
 * Settings → Audit (spec 06, 08): the read side of the school's audit log. Writing it is
 * `AuditService` (`common/audit`), which every area uses.
 */
@Module({
  controllers: [AuditLogController],
  providers: [AuditLogService, AuditRepository],
})
export class AuditLogModule {}
