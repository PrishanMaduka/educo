import { Module } from '@nestjs/common';

import { CoreModule } from './core.module';
import { HealthModule } from './health/health.module';
import { OpenApiController } from './openapi/openapi.controller';

import type { Config } from './config';
import type { DynamicModule } from '@nestjs/common';
import type { Logger } from 'pino';

/** The root module. Area modules (`src/modules/<area>`) are added to `imports`. */
@Module({})
export class AppModule {
  static forRoot(config: Config, logger: Logger): DynamicModule {
    return {
      module: AppModule,
      imports: [CoreModule.forRoot(config, logger), HealthModule],
      controllers: [OpenApiController],
    };
  }
}
