import { Module } from '@nestjs/common';

import { TurnstileModule } from '../../common/turnstile/turnstile.module';
import { DEMO_REQUEST_EMAILS, LOGGER } from '../../tokens';

import { UnsentDemoRequestEmails } from './demo-request-emails';
import { DemoRequestsController } from './demo-requests.controller';
import { DemoRequestsService } from './demo-requests.service';

import type { DemoRequestEmails } from './demo-request-emails';
import type { DynamicModule } from '@nestjs/common';
import type { Logger } from 'pino';

/** The landing page's demo and "tell my school" requests (spec 06 Public, spec 19; D57). */
@Module({})
export class DemoRequestsModule {
  static register(emails?: DemoRequestEmails): DynamicModule {
    return {
      module: DemoRequestsModule,
      imports: [TurnstileModule],
      controllers: [DemoRequestsController],
      providers: [
        DemoRequestsService,
        emails === undefined
          ? {
              provide: DEMO_REQUEST_EMAILS,
              inject: [LOGGER],
              useFactory: (logger: Logger): DemoRequestEmails =>
                new UnsentDemoRequestEmails(logger),
            }
          : { provide: DEMO_REQUEST_EMAILS, useValue: emails },
      ],
    };
  }
}
