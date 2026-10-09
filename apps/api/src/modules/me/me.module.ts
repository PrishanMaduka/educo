import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { MeController } from './me.controller';
import { MeRepository } from './me.repository';
import { MeService } from './me.service';
import { TotpController } from './totp.controller';

/** `/me*`: the signed-in person's own view, and `/me/totp` (Task 12 adds the preview routes). */
@Module({
  imports: [AuthModule],
  controllers: [MeController, TotpController],
  providers: [MeService, MeRepository],
})
export class MeModule {}
