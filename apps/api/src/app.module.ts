import { Module } from '@nestjs/common';

import { AccessModule } from './common/access/access.module';
import { AuditModule } from './common/audit/audit.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { DeliveryModule } from './common/delivery/delivery.module';
import { RateLimitModule } from './common/rate-limit/rate-limit.module';
import { SessionModule } from './common/session/session.module';
import { CoreModule } from './core.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { MeModule } from './modules/me/me.module';
import { OpenApiController } from './openapi/openapi.controller';
import { PlatformModule } from './platform/platform.module';
import { RealtimeModule } from './realtime/realtime.module';
import { RedisModule } from './redis/redis.module';
import { SesWebhookModule } from './webhooks/ses/ses-webhook.module';

import type { DeliveryQueue } from './common/delivery/delivery.service';
import type { Config } from './config';
import type { OtpSendRequests } from './modules/auth/otp/otp-sends';
import type { PasswordResetRequests } from './modules/auth/password-reset-requests';
import type { ErrorReporter } from './observability/sentry';
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
  /** Records Forgot password requests instead of adding BullMQ jobs (`test/fakes/password-resets.ts`). */
  readonly passwordResets?: PasswordResetRequests;
  /** Records sign-in code requests instead of adding BullMQ jobs (`test/fakes/otp-sends.ts`). */
  readonly otpSends?: OtpSendRequests;
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
  static forRoot(
    config: Config,
    logger: Logger,
    overrides: AppOverrides = {},
    reporter?: ErrorReporter,
  ): DynamicModule {
    return {
      module: AppModule,
      imports: [
        CoreModule.forRoot(config, logger, overrides.now, reporter),
        DatabaseModule,
        RedisModule,
        // First: its AuthGuard must run before any other global guard (Task 12).
        SessionModule,
        // Next: the school's status, preview, plan and permission guards, in that order (Task 12).
        AccessModule,
        RateLimitModule,
        CryptoModule,
        AuditModule,
        PlatformModule,
        DeliveryModule.register(overrides.delivery),
        HealthModule,
        RealtimeModule,
        SesWebhookModule.register(overrides.snsFetchers),
        AuthModule.register(overrides.passwordResets, overrides.otpSends),
        MeModule,
        ...(overrides.testModules ?? []),
      ],
      controllers: [OpenApiController],
    };
  }
}
