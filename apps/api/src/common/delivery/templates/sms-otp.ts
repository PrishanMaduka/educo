import { z } from 'zod';

import { Count, OneTimeCode } from './params';
import { formatMessage } from './render';

export interface RenderedSms {
  readonly text: string;
  /** The one-time code in the text, which only the local log provider prints (spec 02). */
  readonly code?: string;
}

const OtpSmsParams = z.object({ code: OneTimeCode, minutes: Count }).strict();

/** A parent's sign-in code by SMS (spec 05 → Parents step 3), always from "QUAD" (spec 12). */
export const otpSms = {
  params: OtpSmsParams,
  render: (raw: unknown): RenderedSms => {
    const { code, minutes } = OtpSmsParams.parse(raw);
    return { text: formatMessage('sms.otp', { code, minutes }), code };
  },
};
