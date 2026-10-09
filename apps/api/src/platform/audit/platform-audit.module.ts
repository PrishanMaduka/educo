import { Module } from '@nestjs/common';

import { PlatformCoreModule } from '../platform-core.module';

import { PlatformAuditLogService } from './platform-audit-log.service';
import { PlatformAuditController } from './platform-audit.controller';
import { PlatformAuditRepository } from './platform-audit.repository';

/** The console's Audit log (spec 07): the read side of `platform_audit`. */
@Module({
  imports: [PlatformCoreModule],
  controllers: [PlatformAuditController],
  providers: [PlatformAuditLogService, PlatformAuditRepository],
})
export class PlatformAuditModule {}
