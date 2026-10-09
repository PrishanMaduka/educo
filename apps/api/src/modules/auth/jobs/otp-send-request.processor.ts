import { UnrecoverableError } from 'bullmq';

import { runWithJobContext } from '../../../common/request-context';
import { isParentKind } from '../memberships.service';
import { OTP_SEND_REQUEST_QUEUE, OtpSendRequestJob } from '../otp/otp-sends';

import type { DeliveryQueue } from '../../../common/delivery/delivery.service';
import type { QuadTenantDb } from '@quad/db';
import type { Logger } from 'pino';

const JOB_ID_PREFIX = 'otp-send.';

export interface OtpSendRequestDeps {
  readonly db: QuadTenantDb;
  readonly delivery: DeliveryQueue;
  readonly logger: Logger;
}

/** The parts of a BullMQ job the processor reads. */
export interface OtpSendRequestJobLike {
  readonly id?: string | undefined;
  readonly data: unknown;
}

/**
 * The `otp-send-request` processor (worker; D39). It finds the account for the phone or email
 * (`account_by_identifier`) and sends the code only when the account is not disabled and has a
 * live guardian or relative membership (`auth_memberships`); otherwise it sends nothing and logs
 * the metric `otp_dropped_unknown`, never the number or address. The SMS or email job id is the
 * challenge's, so a retry never sends twice.
 */
export function createOtpSendRequestProcessor(deps: OtpSendRequestDeps) {
  return async (job: OtpSendRequestJobLike): Promise<void> => {
    const parsed = OtpSendRequestJob.safeParse(job.data);
    if (!parsed.success || job.id?.startsWith(JOB_ID_PREFIX) !== true) {
      throw new UnrecoverableError('The otp-send-request job payload is not valid.');
    }
    const { challengeId, phone, email, code, minutes } = parsed.data;
    await runWithJobContext(`${OTP_SEND_REQUEST_QUEUE}.${challengeId}`, null, async () => {
      const account = await deps.db.definers.accountByIdentifier(
        phone === undefined ? { email: email ?? '' } : { phone },
      );
      const memberships =
        account === null || account.status === 'disabled'
          ? []
          : await deps.db.definers.authMemberships(account.id);
      if (!memberships.some((membership) => isParentKind(membership.kind))) {
        deps.logger.info(
          { metric: 'otp_dropped_unknown', channel: phone === undefined ? 'email' : 'sms' },
          'A sign-in code was not sent: no parent account has that number or address',
        );
        return;
      }
      const jobId = `otp.${challengeId}`;
      const params = { code, minutes };
      if (phone !== undefined) {
        await deps.delivery.queueSms({ jobId, to: phone, template: 'otp', params });
      } else if (email !== undefined) {
        await deps.delivery.queueEmail({ jobId, to: email, template: 'email_otp', params });
      }
    });
  };
}
