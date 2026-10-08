import type { SmsMessage, SmsSender } from './sms';
import type { Config } from '../../config';
import type { Logger } from 'pino';

const SRI_LANKA = /^\+94(\d{9})$/;

/**
 * A phone number safe for logs (spec 16: no phone numbers in logs): `+94 77 *** **01` for a Sri
 * Lankan number (the operator prefix and the last two digits), otherwise only the last two digits.
 */
export function maskPhone(phone: string): string {
  const local = SRI_LANKA.exec(phone)?.[1];
  if (local !== undefined) return `+94 ${local.slice(0, 2)} *** **${local.slice(-2)}`;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 7 ? `*** **${digits.slice(-2)}` : '***';
}

/**
 * `SMS_PROVIDER=log`: writes each SMS to the log instead of sending it (spec 12). The line holds
 * the masked number and, only when `APP_ENV=local`, the one-time code (spec 02: local codes are
 * in the log; ruling F54). The text itself is never logged.
 */
export class LogSms implements SmsSender {
  constructor(
    private readonly logger: Logger,
    private readonly appEnv: Config['APP_ENV'],
  ) {}

  send(message: SmsMessage): Promise<void> {
    const showCode = this.appEnv === 'local' && message.code !== undefined;
    this.logger.info(
      { to: maskPhone(message.to), ...(showCode ? { code: message.code } : {}) },
      'SMS written to the log (SMS_PROVIDER=log)',
    );
    return Promise.resolve();
  }
}
