import { z } from 'zod';

import { LogSms } from './log-sms';
import { SMS_TEMPLATE_IDS } from './templates';

import type { Config } from '../../config';
import type { Logger } from 'pino';

/** One SMS, ready for a provider. */
export interface SmsMessage {
  /** E.164 (`+94770000001`). */
  readonly to: string;
  readonly text: string;
  /** The one-time code in `text`, which only the log provider prints, and only locally. */
  readonly code?: string;
}

/** An SMS provider behind one interface: `log` in M1, Notify.lk and Twilio (`live`) in M6. */
export interface SmsSender {
  send(message: SmsMessage): Promise<void>;
}

/** An E.164 phone number. */
export const E164Schema = z.string().regex(/^\+[1-9]\d{6,14}$/, { message: 'must be E.164' });

/** A `send-sms` job; `tenantId` as for email (the context the worker runs it in). */
export const SmsJobSchema = z
  .object({
    to: E164Schema,
    tenantId: z.string().uuid().nullable(),
    template: z.enum(SMS_TEMPLATE_IDS),
    params: z.record(z.unknown()),
  })
  .strict();
export type SmsJob = z.infer<typeof SmsJobSchema>;

/**
 * The configured provider. Only `log` exists in M1 (the config refuses `live` until M6, OQ12),
 * and it is the default when `SMS_PROVIDER` is unset.
 */
export function createSmsSender(config: Config, logger: Logger): SmsSender {
  return new LogSms(logger, config.APP_ENV);
}
