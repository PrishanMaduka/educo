import { SIGNED_LINK_RULES } from '@quad/domain';
import { UnrecoverableError } from 'bullmq';

import { runWithJobContext } from '../../../common/request-context';
import { AuthRepository } from '../auth.repository';
import { PASSWORD_RESET_REQUEST_QUEUE, PasswordResetRequestJob } from '../password-reset-requests';

import type { SignedLinks } from '../../../common/crypto/signed-links';
import type { DeliveryQueue } from '../../../common/delivery/delivery.service';
import type { Clock } from '../../../tokens';
import type { QuadTenantDb } from '@quad/db';

/** The reset link's lifetime in minutes, for the email (spec 05 step 6: 30 minutes). */
const RESET_LINK_MINUTES = (SIGNED_LINK_RULES.password_reset.ttlSeconds ?? 0) / 60;
const JOB_ID_PREFIX = 'password-reset-request.';

export interface PasswordResetRequestDeps {
  readonly db: QuadTenantDb;
  readonly links: SignedLinks;
  readonly delivery: DeliveryQueue;
  /** `PUBLIC_WEB_URL`: the link opens `/sign-in/reset/{token}` there. */
  readonly publicWebUrl: string;
  readonly now: Clock;
}

/** The parts of a BullMQ job the processor reads. */
export interface PasswordResetRequestJobLike {
  readonly id?: string | undefined;
  readonly data: unknown;
  /** When the request was queued; the same on every retry. */
  readonly timestamp: number;
}

/**
 * The `password-reset-request` processor (worker). It finds the account for the email; for an
 * active account it signs a single-use `password_reset` link with no school (OQ8) and queues the
 * email, and for anything else it sends nothing. The email's job id comes from this job's id
 * and queue time, so a retry never sends a second email.
 */
export function createPasswordResetRequestProcessor(deps: PasswordResetRequestDeps) {
  const repository = new AuthRepository(deps.db);
  return async (job: PasswordResetRequestJobLike): Promise<void> => {
    const parsed = PasswordResetRequestJob.safeParse(job.data);
    if (!parsed.success || job.id?.startsWith(JOB_ID_PREFIX) !== true) {
      throw new UnrecoverableError('The password-reset-request job payload is not valid.');
    }
    const requestId = job.id.slice(JOB_ID_PREFIX.length);
    await runWithJobContext(`${PASSWORD_RESET_REQUEST_QUEUE}.${requestId}`, null, async () => {
      const found = await deps.db.definers.accountByIdentifier({ email: parsed.data.email });
      if (found === null || found.status !== 'active') return;
      const account = await repository.account(found.id);
      if (account === null || account.email === null) return;
      const token = deps.links.signLink(
        { purpose: 'password_reset', tid: null, sub: found.id },
        new Date(deps.now()),
      );
      await deps.delivery.queueEmail({
        jobId: `password-reset.${requestId}.${job.timestamp}`,
        to: account.email,
        template: 'password_reset',
        params: {
          link: new URL(`/sign-in/reset/${token}`, deps.publicWebUrl).href,
          minutes: RESET_LINK_MINUTES,
        },
      });
    });
  };
}
