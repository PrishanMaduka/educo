import { SignedLinks } from '../../src/common/crypto/signed-links';
import { createPasswordResetRequestProcessor } from '../../src/modules/auth/jobs/password-reset-request.processor';
import { TENANT_DB } from '../../src/tokens';

import type { DeliveryQueue } from '../../src/common/delivery/delivery.service';
import type {
  PasswordResetRequest,
  PasswordResetRequests,
} from '../../src/modules/auth/password-reset-requests';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { QuadTenantDb } from '@quad/db';

/**
 * Records Forgot password requests instead of adding them to BullMQ (`AppOverrides.passwordResets`).
 * `process` then runs the worker's real processor on them, as the worker would.
 */
export class RecordingPasswordResets implements PasswordResetRequests {
  readonly requests: (PasswordResetRequest & { readonly timestamp: number })[] = [];

  constructor(private readonly now: () => number) {}

  request(job: PasswordResetRequest): Promise<void> {
    this.requests.push({ ...job, timestamp: this.now() });
    return Promise.resolve();
  }

  /** Runs every recorded request through the worker's processor, then forgets them. */
  async process(app: NestFastifyApplication, delivery: DeliveryQueue): Promise<void> {
    const processor = createPasswordResetRequestProcessor({
      db: app.get<QuadTenantDb>(TENANT_DB),
      links: app.get(SignedLinks),
      delivery,
      publicWebUrl: 'http://localhost:3000',
      now: this.now,
    });
    for (const request of this.requests.splice(0)) {
      await processor({
        id: request.jobId,
        data: { email: request.email },
        timestamp: request.timestamp,
      });
    }
  }
}
