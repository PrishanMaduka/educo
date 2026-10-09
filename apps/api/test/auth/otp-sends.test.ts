import { describe, expect, it } from 'vitest';

import {
  OTP_SEND_REQUEST_JOB_OPTIONS,
  OtpSendRequestJob,
} from '../../src/modules/auth/otp/otp-sends';

describe('the otp-send-request job (D39)', () => {
  it('leaves Redis as soon as it is done or fails for good: it holds a code and a number', () => {
    expect(OTP_SEND_REQUEST_JOB_OPTIONS.removeOnComplete).toBe(true);
    expect(OTP_SEND_REQUEST_JOB_OPTIONS.removeOnFail).toBe(true);
  });

  it('carries exactly one of a phone and an email', () => {
    const base = {
      challengeId: '0192a6f4-1b2c-7d3e-8f40-123456789abc',
      code: '123456',
      minutes: 10,
    };
    expect(OtpSendRequestJob.safeParse({ ...base, phone: '+94770000001' }).success).toBe(true);
    expect(OtpSendRequestJob.safeParse({ ...base, email: 'a@example.test' }).success).toBe(true);
    expect(OtpSendRequestJob.safeParse(base).success).toBe(false);
    expect(
      OtpSendRequestJob.safeParse({ ...base, phone: '+94770000001', email: 'a@example.test' })
        .success,
    ).toBe(false);
  });
});
