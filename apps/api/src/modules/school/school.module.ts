import { Module } from '@nestjs/common';

import { SchoolController } from './school.controller';
import { SchoolRepository } from './school.repository';
import { SchoolService } from './school.service';

/** Settings → School settings (spec 06, 08): General, branding and the school's settings. */
@Module({
  controllers: [SchoolController],
  providers: [SchoolService, SchoolRepository],
})
export class SchoolModule {}
