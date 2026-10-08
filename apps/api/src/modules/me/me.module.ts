import { Module } from '@nestjs/common';

import { MeController } from './me.controller';
import { MeRepository } from './me.repository';
import { MeService } from './me.service';

/** `/me*`: the signed-in person's own view (Task 7 adds `/me/totp`, Task 12 the preview routes). */
@Module({
  controllers: [MeController],
  providers: [MeService, MeRepository],
})
export class MeModule {}
