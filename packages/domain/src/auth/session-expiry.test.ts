import { describe, expect, it } from 'vitest';

import {
  CONSOLE_IDLE_HOURS,
  DEFAULT_SESSION_HOURS,
  KEEP_SIGNED_IN_DAYS,
  REFRESH_FAMILY_DAYS,
  SIGN_IN_STEP_MINUTES,
  sessionExpiry,
} from './session-expiry';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const T0 = new Date('2026-10-08T03:30:00.000Z');
const at = (offsetMs: number) => new Date(T0.getTime() + offsetMs);

describe('sessionExpiry', () => {
  it('has the lifetimes of spec 05', () => {
    expect(DEFAULT_SESSION_HOURS).toBe(12);
    expect(KEEP_SIGNED_IN_DAYS).toBe(30);
    expect(CONSOLE_IDLE_HOURS).toBe(8);
    expect(REFRESH_FAMILY_DAYS).toBe(60);
  });

  describe('a web session (idle timeout from the school setting)', () => {
    it.each([
      { sessionHours: 12, idle: 12 * HOUR - 1, expired: false },
      { sessionHours: 12, idle: 12 * HOUR, expired: true },
      { sessionHours: 4, idle: 4 * HOUR - 1, expired: false },
      { sessionHours: 4, idle: 4 * HOUR, expired: true },
      { sessionHours: undefined, idle: 12 * HOUR - 1, expired: false },
      { sessionHours: undefined, idle: 12 * HOUR, expired: true },
    ])(
      'with $sessionHours hours, idle for $idle ms, expired is $expired',
      ({ sessionHours, idle, expired }) => {
        const result = sessionExpiry({
          kind: 'web',
          lastSeenAt: T0,
          keepSignedIn: false,
          ...(sessionHours === undefined ? {} : { sessionHours }),
          now: at(idle),
        });
        expect(result.expired).toBe(expired);
        expect(result.expiresAt).toEqual(at((sessionHours ?? 12) * HOUR));
      },
    );

    it('lasts 30 days idle with "Keep me signed in", whatever the school setting', () => {
      const input = { kind: 'web', lastSeenAt: T0, keepSignedIn: true, sessionHours: 4 } as const;
      expect(sessionExpiry({ ...input, now: at(30 * DAY - 1) })).toEqual({
        expiresAt: at(30 * DAY),
        expired: false,
      });
      expect(sessionExpiry({ ...input, now: at(30 * DAY) }).expired).toBe(true);
    });

    it.each([0, -1, 1.5, Number.NaN])('refuses a session length of %s hours', (sessionHours) => {
      expect(() =>
        sessionExpiry({ kind: 'web', lastSeenAt: T0, keepSignedIn: false, sessionHours, now: T0 }),
      ).toThrow(RangeError);
    });
  });

  describe('a console session', () => {
    it('expires after 8 hours idle', () => {
      expect(sessionExpiry({ kind: 'console', lastSeenAt: T0, now: at(8 * HOUR - 1) })).toEqual({
        expiresAt: at(8 * HOUR),
        expired: false,
      });
      expect(sessionExpiry({ kind: 'console', lastSeenAt: T0, now: at(8 * HOUR) }).expired).toBe(
        true,
      );
    });
  });

  describe('a support visit', () => {
    it('expires at its hard limit, however recently it was used', () => {
      const supportExpiresAt = at(60 * 60 * 1000);
      expect(
        sessionExpiry({ kind: 'support', supportExpiresAt, now: at(60 * 60 * 1000 - 1) }),
      ).toEqual({ expiresAt: supportExpiresAt, expired: false });
      expect(
        sessionExpiry({ kind: 'support', supportExpiresAt, now: supportExpiresAt }).expired,
      ).toBe(true);
    });
  });

  describe('a parent refresh family', () => {
    it('lives 60 days from its creation, however often it is refreshed', () => {
      expect(
        sessionExpiry({ kind: 'refresh_family', createdAt: T0, now: at(60 * DAY - 1) }),
      ).toEqual({ expiresAt: at(60 * DAY), expired: false });
      expect(
        sessionExpiry({ kind: 'refresh_family', createdAt: T0, now: at(60 * DAY) }).expired,
      ).toBe(true);
    });
  });

  describe('a sign-in step (password done, two-step or school choice still to come)', () => {
    it('lives 15 minutes from the step that started it, whatever Keep me signed in says', () => {
      expect(SIGN_IN_STEP_MINUTES).toBe(15);
      expect(
        sessionExpiry({ kind: 'sign_in_step', startedAt: T0, now: at(15 * 60 * 1000 - 1) }),
      ).toEqual({ expiresAt: at(15 * 60 * 1000), expired: false });
      expect(
        sessionExpiry({ kind: 'sign_in_step', startedAt: T0, now: at(15 * 60 * 1000) }).expired,
      ).toBe(true);
    });
  });
});
