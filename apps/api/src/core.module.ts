import { Global, Module } from '@nestjs/common';

import { CONFIG, LOGGER } from './tokens';

import type { Config } from './config';
import type { DynamicModule } from '@nestjs/common';
import type { Logger } from 'pino';

/** Makes the config and logger built at boot injectable everywhere. */
@Global()
@Module({})
export class CoreModule {
  static forRoot(config: Config, logger: Logger): DynamicModule {
    return {
      module: CoreModule,
      providers: [
        { provide: CONFIG, useValue: config },
        { provide: LOGGER, useValue: logger },
      ],
      exports: [CONFIG, LOGGER],
    };
  }
}
