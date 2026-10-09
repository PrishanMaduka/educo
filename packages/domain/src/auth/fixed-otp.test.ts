import { describe, expect, it } from 'vitest';

import { STORE_REVIEW_OTP, fixedOtpFor } from './fixed-otp';

const REVIEW_PHONE = '+94770000999';
const PARENT_PHONE = '+94770000001';

describe('fixedOtpFor (spec 16: fixed codes for development and store review only)', () => {
  it.each(['local', 'staging'] as const)(
    'gives DEV_FIXED_OTP for any phone or email in %s',
    (appEnv) => {
      const config = { appEnv, devFixedOtp: '000000', storeReviewPhone: null };
      expect(fixedOtpFor(config, { phone: PARENT_PHONE })).toBe('000000');
      expect(fixedOtpFor(config, { email: 'dilhani@example.test' })).toBe('000000');
    },
  );

  it('never gives DEV_FIXED_OTP in production (the config refuses it too)', () => {
    const config = { appEnv: 'production', devFixedOtp: '000000', storeReviewPhone: null } as const;
    expect(fixedOtpFor(config, { phone: PARENT_PHONE })).toBeNull();
  });

  it.each(['local', 'staging', 'production'] as const)(
    'gives nothing in %s without a fixed code',
    (appEnv) => {
      expect(
        fixedOtpFor({ appEnv, devFixedOtp: null, storeReviewPhone: null }, { phone: PARENT_PHONE }),
      ).toBeNull();
    },
  );

  it('gives the review code to STORE_REVIEW_PHONE in production', () => {
    const config = { appEnv: 'production', storeReviewPhone: REVIEW_PHONE } as const;
    expect(fixedOtpFor(config, { phone: REVIEW_PHONE })).toBe(STORE_REVIEW_OTP);
  });

  it('gives the review code to no other number, and never to an email', () => {
    const config = { appEnv: 'production', storeReviewPhone: REVIEW_PHONE } as const;
    expect(fixedOtpFor(config, { phone: PARENT_PHONE })).toBeNull();
    expect(fixedOtpFor(config, { email: 'reviewer@example.test' })).toBeNull();
  });

  it('prefers DEV_FIXED_OTP for the review number where it applies', () => {
    const config = {
      appEnv: 'local',
      devFixedOtp: '123456',
      storeReviewPhone: REVIEW_PHONE,
    } as const;
    expect(fixedOtpFor(config, { phone: REVIEW_PHONE })).toBe('123456');
  });

  it('is six digits', () => {
    expect(STORE_REVIEW_OTP).toMatch(/^\d{6}$/);
  });
});
