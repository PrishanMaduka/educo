import { Global, Module } from '@nestjs/common';

import { NO_OP_REPORTER } from './observability/sentry';
import { CLOCK, CONFIG, ERROR_REPORTER, LOGGER } from './tokens';

import type { Config } from './config';
import type { ErrorReporter } from './observability/sentry';
import type { Clock } from './tokens';
import type { DynamicModule } from '@nestjs/common';
import type { Logger } from 'pino';

/**
 * Makes the config, logger, clock and error reporter injectable everywhere. The reporter is the
 * one the global error filter uses, so an error a route turns into a redirect is still reported.
 */
@Global()
@Module({})
export class CoreModule {
  static forRoot(
    config: Config,
    logger: Logger,
    clock: Clock = Date.now,
    reporter: ErrorReporter = NO_OP_REPORTER,
  ): DynamicModule {
    return {
      module: CoreModule,
      providers: [
        { provide: CONFIG, useValue: config },
        { provide: LOGGER, useValue: logger },
        { provide: CLOCK, useValue: clock },
        { provide: ERROR_REPORTER, useValue: reporter },
      ],
      exports: [CONFIG, LOGGER, CLOCK, ERROR_REPORTER],
    };
  }
}
