import { describe, expect, it } from 'vitest';

import {
  OTP_CODE_MINUTES,
  OTP_DAILY_LIMIT,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_SECONDS,
  OTP_WINDOW_LIMIT,
  OTP_WINDOW_MINUTES,
  otpSendDecision,
} from './otp-send-decision';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const NOW = new Date('2026-10-09T03:30:00.000Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms);

describe('otpSendDecision (spec 05, parent app step 3)', () => {
  it('has the limits of spec 05', () => {
    expect(OTP_CODE_MINUTES).toBe(10);
    expect(OTP_MAX_ATTEMPTS).toBe(5);
    expect(OTP_RESEND_SECONDS).toBe(30);
    expect(OTP_WINDOW_MINUTES).toBe(15);
    expect(OTP_WINDOW_LIMIT).toBe(3);
    expect(OTP_DAILY_LIMIT).toBe(10);
  });

  it('allows the first code', () => {
    expect(otpSendDecision([], NOW)).toEqual({ allowed: true, retryAfter: 0 });
  });

  it.each([
    { age: 29 * SECOND, allowed: false, retryAfter: 1 },
    { age: 29.5 * SECOND, allowed: false, retryAfter: 1 },
    { age: 1 * SECOND, allowed: false, retryAfter: 29 },
    { age: 30 * SECOND, allowed: true, retryAfter: 0 },
  ])(
    'a resend $age ms after the last code: allowed $allowed, retry after $retryAfter s',
    ({ age, allowed, retryAfter }) => {
      expect(otpSendDecision([ago(age)], NOW)).toEqual({ allowed, retryAfter });
    },
  );

  it('refuses a 4th code within 15 minutes until the oldest of the three leaves the window', () => {
    const history = [ago(14 * MINUTE), ago(10 * MINUTE), ago(1 * MINUTE)];
    expect(otpSendDecision(history, NOW)).toEqual({ allowed: false, retryAfter: 60 });
  });

  it('allows a 4th code once the oldest is exactly 15:00 old (it has left the window)', () => {
    const history = [ago(15 * MINUTE), ago(10 * MINUTE), ago(1 * MINUTE)];
    expect(otpSendDecision(history, NOW)).toEqual({ allowed: true, retryAfter: 0 });
  });

  it('reads the history in any order', () => {
    const history = [ago(1 * MINUTE), ago(14 * MINUTE), ago(10 * MINUTE)];
    expect(otpSendDecision(history, NOW)).toEqual({ allowed: false, retryAfter: 60 });
  });

  it('refuses an 11th code in a day until the oldest is a day old', () => {
    // Ten codes, 2 hours apart, the oldest 20 hours ago: no 15-minute window is full.
    const history = Array.from({ length: 10 }, (_, index) => ago((20 - 2 * index) * HOUR));
    expect(otpSendDecision(history, NOW)).toEqual({ allowed: false, retryAfter: 4 * 60 * 60 });
  });

  it('allows a code once the oldest of ten is exactly 24 hours old', () => {
    const history = Array.from({ length: 10 }, (_, index) => ago((24 - 2 * index) * HOUR));
    expect(otpSendDecision(history, NOW)).toEqual({ allowed: true, retryAfter: 0 });
  });

  it('gives the longest wait when several limits refuse', () => {
    // Three in the last 15 minutes (the newest 10 s ago), and ten in the day.
    const history = [
      ...Array.from({ length: 7 }, (_, index) => ago((23 - index) * HOUR)),
      ago(12 * MINUTE),
      ago(5 * MINUTE),
      ago(10 * SECOND),
    ];
    expect(otpSendDecision(history, NOW)).toEqual({ allowed: false, retryAfter: 60 * 60 });
  });

  it('counts a code stamped after now (clock skew) as just sent', () => {
    expect(otpSendDecision([new Date(NOW.getTime() + 5 * SECOND)], NOW)).toEqual({
      allowed: false,
      retryAfter: 35,
    });
  });
});
