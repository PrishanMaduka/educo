import { Global, Module } from '@nestjs/common';

import { AuditService } from './audit.service';

/** `AuditService` for every area module (Task 15 adds the read side). */
@Global()
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
