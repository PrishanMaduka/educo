import { Module } from '@nestjs/common';

import { CLOCK, SNS_KEY_FETCHER, SNS_SUBSCRIBE_FETCHER } from '../../tokens';

import { SesWebhookController } from './ses-webhook.controller';
import { SesWebhookService } from './ses-webhook.service';
import { confirmSnsSubscription, fetchSnsSigningKey } from './sns-signature';

import type { SnsKeyGetter } from './sns-signature';
import type { Clock } from '../../tokens';
import type { DynamicModule } from '@nestjs/common';

/** The two outbound calls the webhook makes, both to AWS SNS hosts only. */
export interface SnsFetchers {
  /** Downloads and checks the signing certificate at `SigningCertURL`; null if unusable. */
  readonly key: SnsKeyGetter;
  /** Confirms a subscription with a GET of `SubscribeURL`. */
  readonly subscribe: (url: string) => Promise<void>;
}

/**
 * `POST /webhooks/ses` (spec 20, Email). Tenant-less: it lives in `src/webhooks` (spec 05) and
 * writes only through the `record_email_suppression` definer call (D16). Tests replace the
 * fetchers so nothing reaches the network.
 */
@Module({})
export class SesWebhookModule {
  static register(fetchers: Partial<SnsFetchers> = {}): DynamicModule {
    return {
      module: SesWebhookModule,
      controllers: [SesWebhookController],
      providers: [
        SesWebhookService,
        {
          provide: SNS_KEY_FETCHER,
          inject: [CLOCK],
          useFactory: (now: Clock): SnsKeyGetter =>
            fetchers.key ?? ((certUrl) => fetchSnsSigningKey(certUrl, now)),
        },
        { provide: SNS_SUBSCRIBE_FETCHER, useValue: fetchers.subscribe ?? confirmSnsSubscription },
      ],
    };
  }
}
