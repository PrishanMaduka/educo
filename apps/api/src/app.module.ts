import { Module } from '@nestjs/common';

import { AuditModule } from './common/audit/audit.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { DeliveryModule } from './common/delivery/delivery.module';
import { RateLimitModule } from './common/rate-limit/rate-limit.module';
import { SessionModule } from './common/session/session.module';
import { CoreModule } from './core.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { MeModule } from './modules/me/me.module';
import { OpenApiController } from './openapi/openapi.controller';
import { PlatformCoreModule } from './platform/platform-core.module';
import { RealtimeModule } from './realtime/realtime.module';
import { RedisModule } from './redis/redis.module';
import { SesWebhookModule } from './webhooks/ses/ses-webhook.module';

import type { DeliveryQueue } from './common/delivery/delivery.service';
import type { Config } from './config';
import type { Clock } from './tokens';
import type { SnsFetchers } from './webhooks/ses/ses-webhook.module';
import type { DynamicModule, Type } from '@nestjs/common';
import type { Logger } from 'pino';

/** Test replacements: a fixed clock, and outbound calls that never reach the network. */
export interface AppOverrides {
  readonly now?: Clock;
  readonly snsFetchers?: Partial<SnsFetchers>;
  /** Records queued email and SMS instead of adding BullMQ jobs (`test/fakes/delivery.ts`). */
  readonly delivery?: DeliveryQueue;
  /**
   * Test-only modules added after the app's own (probe routes behind the real guards, fakes for
   * providers a later task owns). `AppModule` never lists them, so the OpenAPI document is
   * unchanged.
   */
  readonly testModules?: readonly (Type | DynamicModule)[];
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
        // First: its AuthGuard must run before any other global guard (Task 12).
        SessionModule,
        RateLimitModule,
        CryptoModule,
        AuditModule,
        PlatformCoreModule,
        DeliveryModule.register(overrides.delivery),
        HealthModule,
        RealtimeModule,
        SesWebhookModule.register(overrides.snsFetchers),
        MeModule,
        ...(overrides.testModules ?? []),
      ],
      controllers: [OpenApiController],
    };
  }
}
