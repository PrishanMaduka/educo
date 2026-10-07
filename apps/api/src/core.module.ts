import { Global, Module } from '@nestjs/common';

import { CLOCK, CONFIG, LOGGER } from './tokens';

import type { Config } from './config';
import type { Clock } from './tokens';
import type { DynamicModule } from '@nestjs/common';
import type { Logger } from 'pino';

/** Makes the config, logger and clock injectable everywhere. */
@Global()
@Module({})
export class CoreModule {
  static forRoot(config: Config, logger: Logger, clock: Clock = Date.now): DynamicModule {
    return {
      module: CoreModule,
      providers: [
        { provide: CONFIG, useValue: config },
        { provide: LOGGER, useValue: logger },
        { provide: CLOCK, useValue: clock },
      ],
      exports: [CONFIG, LOGGER, CLOCK],
    };
  }
}
