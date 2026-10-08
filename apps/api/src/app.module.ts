import { Module } from '@nestjs/common';

import { CryptoModule } from './common/crypto/crypto.module';
import { DeliveryModule } from './common/delivery/delivery.module';
import { RateLimitModule } from './common/rate-limit/rate-limit.module';
import { CoreModule } from './core.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { OpenApiController } from './openapi/openapi.controller';
import { RealtimeModule } from './realtime/realtime.module';
import { RedisModule } from './redis/redis.module';
import { SesWebhookModule } from './webhooks/ses/ses-webhook.module';

import type { DeliveryQueue } from './common/delivery/delivery.service';
import type { Config } from './config';
import type { Clock } from './tokens';
import type { SnsFetchers } from './webhooks/ses/ses-webhook.module';
import type { DynamicModule } from '@nestjs/common';
import type { Logger } from 'pino';

/** Test replacements: a fixed clock, and outbound calls that never reach the network. */
export interface AppOverrides {
  readonly now?: Clock;
  readonly snsFetchers?: Partial<SnsFetchers>;
  /** Records queued email and SMS instead of adding BullMQ jobs (`test/fakes/delivery.ts`). */
  readonly delivery?: DeliveryQueue;
}

/** The root module. Area modules (`src/modules/<area>`) are added to `imports`. */
@Module({})
export class AppModule {
  static forRoot(config: Config, logger: Logger, overrides: AppOverrides = {}): DynamicModule {
    return {
      module: AppModule,
      imports: [
        CoreModule.forRoot(config, logger, overrides.now),
        DatabaseModule,
        RedisModule,
        RateLimitModule,
        CryptoModule,
        DeliveryModule.register(overrides.delivery),
        HealthModule,
        RealtimeModule,
        SesWebhookModule.register(overrides.snsFetchers),
      ],
      controllers: [OpenApiController],
    };
  }
}
