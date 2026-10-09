import { Module } from '@nestjs/common';

import { MeController } from './me.controller';
import { MeRepository } from './me.repository';
import { MeService } from './me.service';
import { RolePreviewController } from './role-preview.controller';
import { RolePreviewService } from './role-preview.service';

/**
 * `/me*`: the signed-in person's own view, `GET /me/permissions` and Preview a role (Task 12).
 * `POST /me/totp` lives in `totp.controller.ts` here but is registered by `AuthModule`, which owns
 * two-step.
 */
@Module({
  controllers: [MeController, RolePreviewController],
  providers: [MeService, MeRepository, RolePreviewService],
})
export class MeModule {}
