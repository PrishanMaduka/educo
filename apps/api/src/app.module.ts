import { Module } from '@nestjs/common';

import { CoreModule } from './core.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { OpenApiController } from './openapi/openapi.controller';
import { RealtimeModule } from './realtime/realtime.module';
import { SesWebhookModule } from './webhooks/ses/ses-webhook.module';

import type { Config } from './config';
import type { Clock } from './tokens';
import type { SnsFetchers } from './webhooks/ses/ses-webhook.module';
import type { DynamicModule } from '@nestjs/common';
import type { Logger } from 'pino';

/** Test replacements: a fixed clock, and outbound calls that never reach the network. */
export interface AppOverrides {
  readonly now?: Clock;
  readonly snsFetchers?: Partial<SnsFetchers>;
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
        HealthModule,
        RealtimeModule,
        SesWebhookModule.register(overrides.snsFetchers),
      ],
      controllers: [OpenApiController],
    };
  }
}
