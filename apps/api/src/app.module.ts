import { Module } from '@nestjs/common';

import { CoreModule } from './core.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { OpenApiController } from './openapi/openapi.controller';
import { RealtimeModule } from './realtime/realtime.module';
import { SesWebhookModule } from './webhooks/ses/ses-webhook.module';

import type { Config } from './config';
import type { SnsFetchers } from './webhooks/ses/ses-webhook.module';
import type { DynamicModule } from '@nestjs/common';
import type { Logger } from 'pino';

/** Replacements for the API's outbound calls, so tests never reach the network. */
export interface AppOverrides {
  readonly snsFetchers?: Partial<SnsFetchers>;
}

/** The root module. Area modules (`src/modules/<area>`) are added to `imports`. */
@Module({})
export class AppModule {
  static forRoot(config: Config, logger: Logger, overrides: AppOverrides = {}): DynamicModule {
    return {
      module: AppModule,
      imports: [
        CoreModule.forRoot(config, logger),
        DatabaseModule,
        HealthModule,
        RealtimeModule,
        SesWebhookModule.register(overrides.snsFetchers),
      ],
      controllers: [OpenApiController],
    };
  }
}
