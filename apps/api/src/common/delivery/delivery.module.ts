import { Global, Module } from '@nestjs/common';

import { errorForLog } from '../../observability/logger';
import { DELIVERY, LOGGER, REDIS } from '../../tokens';

import { BullDelivery } from './delivery.service';

import type { DeliveryQueue } from './delivery.service';
import type { DynamicModule } from '@nestjs/common';
import type { Redis } from 'ioredis';
import type { Logger } from 'pino';

/**
 * Email and SMS delivery (spec 12): `DELIVERY` queues jobs on the `send-email` and `send-sms`
 * queues, and the worker sends them (`src/worker/jobs`). Tests may pass a recording fake.
 */
@Global()
@Module({})
export class DeliveryModule {
  static register(override?: DeliveryQueue): DynamicModule {
    return {
      module: DeliveryModule,
      providers: [
        override === undefined
          ? {
              provide: DELIVERY,
              inject: [REDIS, LOGGER],
              useFactory: (redis: Redis, logger: Logger): DeliveryQueue =>
                new BullDelivery(redis, {
                  onError: (error) => {
                    logger.warn({ error: errorForLog(error) }, 'Delivery queue error');
                  },
                }),
            }
          : { provide: DELIVERY, useValue: override },
      ],
      exports: [DELIVERY],
    };
  }
}
