import { createOtpSendRequestProcessor } from '../../src/modules/auth/jobs/otp-send-request.processor';
import { LOGGER, TENANT_DB } from '../../src/tokens';

import type { RecordingDelivery } from './delivery';
import type { OtpSendRequest, OtpSendRequests } from '../../src/modules/auth/otp/otp-sends';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { QuadTenantDb } from '@quad/db';
import type { Logger } from 'pino';

/**
 * Records sign-in code requests instead of adding them to BullMQ (`AppOverrides.otpSends`).
 * `process` then runs the worker's real processor on them, as the worker would after the 202.
 */
export class RecordingOtpSends implements OtpSendRequests {
  readonly requests: OtpSendRequest[] = [];

  constructor(readonly delivery: RecordingDelivery) {}

  request(job: OtpSendRequest): Promise<void> {
    this.requests.push(job);
    return Promise.resolve();
  }

  /** Runs every recorded request through the worker's processor, then forgets them. */
  async process(app: NestFastifyApplication): Promise<void> {
    const processor = createOtpSendRequestProcessor({
      db: app.get<QuadTenantDb>(TENANT_DB),
      delivery: this.delivery,
      logger: app.get<Logger>(LOGGER),
    });
    for (const request of this.requests.splice(0)) {
      await processor({ id: request.jobId, data: request.job });
    }
  }
}
