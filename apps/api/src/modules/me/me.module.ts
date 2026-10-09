import { Module } from '@nestjs/common';

import { MeController } from './me.controller';
import { MeRepository } from './me.repository';
import { MeService } from './me.service';

/**
 * `/me*`: the signed-in person's own view (Task 12 adds the preview routes). `POST /me/totp`
 * lives in `totp.controller.ts` here but is registered by `AuthModule`, which owns two-step.
 */
@Module({
  controllers: [MeController],
  providers: [MeService, MeRepository],
})
export class MeModule {}
