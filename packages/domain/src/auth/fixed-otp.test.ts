import { describe, expect, it } from 'vitest';

import { fixedOtpFor, isStoreReviewSubject } from './fixed-otp';

const REVIEW_PHONE = '+94770000999';
const REVIEW_CODE = '481516';
const PARENT_PHONE = '+94770000001';
const review = { storeReviewPhone: REVIEW_PHONE, storeReviewOtp: REVIEW_CODE } as const;

describe('fixedOtpFor (spec 16: fixed codes for development and store review only)', () => {
  it.each(['local', 'staging'] as const)(
    'gives DEV_FIXED_OTP for any phone or email in %s',
    (appEnv) => {
      const config = { appEnv, devFixedOtp: '000000' };
      expect(fixedOtpFor(config, { phone: PARENT_PHONE })).toBe('000000');
      expect(fixedOtpFor(config, { email: 'dilhani@example.test' })).toBe('000000');
    },
  );

  it('never gives DEV_FIXED_OTP in production (the config refuses it too)', () => {
    expect(
      fixedOtpFor({ appEnv: 'production', devFixedOtp: '000000' }, { phone: PARENT_PHONE }),
    ).toBeNull();
  });

  it.each(['local', 'staging', 'production'] as const)(
    'gives nothing in %s without a fixed code',
    (appEnv) => {
      expect(fixedOtpFor({ appEnv }, { phone: PARENT_PHONE })).toBeNull();
    },
  );

  it.each(['local', 'staging', 'production'] as const)(
    'gives STORE_REVIEW_OTP to STORE_REVIEW_PHONE in %s, before DEV_FIXED_OTP',
    (appEnv) => {
      const config = { appEnv, devFixedOtp: '000000', ...review };
      expect(fixedOtpFor(config, { phone: REVIEW_PHONE })).toBe(REVIEW_CODE);
    },
  );

  it('gives the review code to no other number, and never to an email', () => {
    const config = { appEnv: 'production', ...review } as const;
    expect(fixedOtpFor(config, { phone: PARENT_PHONE })).toBeNull();
    expect(fixedOtpFor(config, { email: 'reviewer@example.test' })).toBeNull();
  });

  it('gives no review code without STORE_REVIEW_OTP', () => {
    const config = { appEnv: 'production', storeReviewPhone: REVIEW_PHONE } as const;
    expect(fixedOtpFor(config, { phone: REVIEW_PHONE })).toBeNull();
  });
});

describe('isStoreReviewSubject', () => {
  it('is true only for the review number with its code configured', () => {
    expect(isStoreReviewSubject(review, { phone: REVIEW_PHONE })).toBe(true);
    expect(isStoreReviewSubject(review, { phone: PARENT_PHONE })).toBe(false);
    expect(isStoreReviewSubject(review, { email: 'reviewer@example.test' })).toBe(false);
    expect(isStoreReviewSubject({ storeReviewOtp: REVIEW_CODE }, { phone: REVIEW_PHONE })).toBe(
      false,
    );
    expect(isStoreReviewSubject({ storeReviewPhone: REVIEW_PHONE }, { phone: REVIEW_PHONE })).toBe(
      false,
    );
  });
});
