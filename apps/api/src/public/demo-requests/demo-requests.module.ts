import { Module } from '@nestjs/common';

import { TurnstileModule } from '../../common/turnstile/turnstile.module';

import { DemoRequestsController } from './demo-requests.controller';
import { DemoRequestsService } from './demo-requests.service';

/**
 * The landing page's demo and "tell my school" requests (spec 06 Public, spec 19; D57). Its
 * emails go through the global `DELIVERY` queue, and its per-email limit through the global
 * `RateLimitService`.
 */
@Module({
  imports: [TurnstileModule],
  controllers: [DemoRequestsController],
  providers: [DemoRequestsService],
})
export class DemoRequestsModule {}
