import { createPublicKey, randomUUID } from 'node:crypto';

import { calculateJwkThumbprint, decodeProtectedHeader, exportJWK } from 'jose';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { TENANT_DB } from '../../src/tokens';
import { captureLogs } from '../app';
import { TEST_JWT_KEYS } from '../env';
import { RecordingDelivery } from '../fakes/delivery';
import { RecordingOtpSends } from '../fakes/otp-sends';
import { Browser } from '../helpers/browser';
import { useDatabaseApp } from '../helpers/database-app';
import { insertSchool } from '../helpers/identity';
import {
  bearer,
  claimsOf,
  emailCode,
  familyIdOf,
  familyRow,
  freshPhone,
  insertParentMember,
  insertPhoneAccount,
  otherCode,
  smsCode,
  spaced,
} from '../helpers/parent';
import { anyText } from '../helpers/sign-in';

import type { QuadTenantDb } from '@quad/db';
import type { TestDatabase } from '@quad/db/testing';

const NOW = Date.UTC(2026, 9, 9, 3, 30, 1);
const TEST_PUBLIC_KEY = createPublicKey(TEST_JWT_KEYS.JWT_PUBLIC_KEY);
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const DAY = 24 * 60 * MINUTE;
let clock = NOW;
const delivery = new RecordingDelivery();
const otpSends = new RecordingOtpSends(delivery);
const logs = captureLogs();
const { db, app } = useDatabaseApp(
  {},
  { logger: logs.logger, overrides: { now: () => clock, delivery, otpSends } },
);

/** The worker's turn: it sends (or drops) every code asked for so far. */
const deliver = () => otpSends.process(app());

beforeEach(() => {
  clock = NOW;
});

const request = (body: unknown, browser = new Browser(app)) =>
  browser.post('/auth/otp/request', body);
const verify = (body: unknown, browser = new Browser(app)) =>
  browser.post('/auth/otp/verify', body);

/** Asks for a code for a known parent's `phone`, lets the worker send it, and returns it. */
async function codeFor(phone: string): Promise<string> {
  expect((await request({ phone })).statusCode).toBe(202);
  await deliver();
  return smsCode(delivery, phone);
}

/** The sign-in SMS queued to `phone` so far. */
const smsTo = (phone: string) => delivery.sms.filter(({ job }) => job.to === phone);

async function challengeRows(database: TestDatabase) {
  const { rows } = await database.platform.query<{
    subject_hash: Buffer;
    code_hash: Buffer;
    channel: string;
    purpose: string;
    attempts: number;
    expires_at: Date;
    created_at: Date;
  }>(
    `select subject_hash, code_hash, channel, purpose, attempts, expires_at, created_at
     from otp_challenges order by created_at, id`,
  );
  return rows;
}

async function guardianAt(schoolName = 'Colombo International School') {
  const school = await insertSchool(db(), { name: schoolName, shortName: 'CIS' });
  const account = await insertPhoneAccount(db());
  const userId = await insertParentMember(db(), school.id, account.id, 'guardian');
  return { school, account, userId };
}

describe('POST /auth/otp/request (spec 05 parent app step 3)', () => {
  it('answers 202, stores only keyed hashes, and queues the 6-digit SMS for 10 minutes', async () => {
    const { account } = await guardianAt();
    const before = (await challengeRows(db())).length;

    const response = await request({ phone: spaced(account.phone) });

    expect(response.statusCode).toBe(202);
    expect(response.body).toBe('');
    await deliver();
    const code = smsCode(delivery, account.phone);
    expect(code).toMatch(/^\d{6}$/);
    expect(delivery.sms.at(-1)?.job.params).toEqual({ code, minutes: 10 });
    const rows = (await challengeRows(db())).slice(before);
    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row).toMatchObject({ channel: 'sms', purpose: 'sign_in', attempts: 0 });
    expect(row?.created_at.getTime()).toBe(NOW);
    expect(row?.expires_at.getTime()).toBe(NOW + 10 * MINUTE);
    // Nothing readable: neither the number nor the code is in the row (D32).
    for (const value of [row?.subject_hash, row?.code_hash]) {
      expect(value?.length).toBe(32);
      expect(value?.toString('latin1')).not.toContain(account.phone.slice(3));
      expect(value?.toString('latin1')).not.toContain(code);
    }
  });

  it('sends the code by email ("Use email instead")', async () => {
    const { account } = await guardianAt();
    const response = await request({ email: account.email.toUpperCase() });
    expect(response.statusCode).toBe(202);
    await deliver();
    expect(emailCode(delivery, account.email)).toMatch(/^\d{6}$/);
  });

  it('answers an unknown number exactly as a known one, and looks no account up', async () => {
    const { account } = await guardianAt();
    const definers = app().get<QuadTenantDb>(TENANT_DB).definers;
    const lookup = vi.spyOn(definers, 'accountByIdentifier');
    const known = await request({ phone: account.phone });
    const unknownPhone = freshPhone();
    const unknown = await request({ phone: unknownPhone });
    lookup.mockRestore();

    expect(unknown.statusCode).toBe(known.statusCode);
    expect(unknown.body).toBe(known.body);
    expect(unknown.headers['content-type']).toBe(known.headers['content-type']);
    expect(lookup).not.toHaveBeenCalled();
    // Then the worker: the known parent gets the code, the unknown number gets nothing (D39).
    logs.lines.length = 0;
    await deliver();
    expect(smsCode(delivery, account.phone)).toMatch(/^\d{6}$/);
    expect(smsTo(unknownPhone)).toEqual([]);
    const dropped = logs.lines.filter((line) => line.metric === 'otp_dropped_unknown');
    expect(dropped).toHaveLength(1);
    expect(JSON.stringify(logs.lines)).not.toContain(unknownPhone.slice(3));
  });

  it("sends nothing to a staff-only account's number or a disabled parent's (no parent membership)", async () => {
    const school = await insertSchool(db());
    const staff = await insertPhoneAccount(db());
    await insertParentMember(db(), school.id, staff.id, 'staff');
    const disabled = await insertPhoneAccount(db(), { status: 'disabled' });
    await insertParentMember(db(), school.id, disabled.id);
    for (const phone of [staff.phone, disabled.phone]) {
      expect((await request({ phone })).statusCode).toBe(202);
    }
    await deliver();
    expect(smsTo(staff.phone)).toEqual([]);
    expect(smsTo(disabled.phone)).toEqual([]);
  });

  it.each([
    ['a landline, not a mobile', '+94 11 234 5678'],
    ['8 digits', '+94 77 000 001'],
    ['another country (Sri Lanka only, OQ12)', '+91 98765 43210'],
    ['no country code', '77 000 0001'],
  ])('answers 400 for a number with %s, and sends nothing', async (_case, phone) => {
    const sent = delivery.sms.length;
    const queued = otpSends.requests.length;
    const response = await request({ phone });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: 'validation',
      fields: { phone: anyText() },
    });
    expect(otpSends.requests.length).toBe(queued);
    expect(delivery.sms.length).toBe(sent);
  });

  it.each([
    ['nothing', {}],
    ['both a phone and an email', { phone: '+94770000001', email: 'a@example.test' }],
    ['a malformed email', { email: 'not-an-email' }],
    ['a school', { phone: '+94770000001', tenantId: '0192a6f4-1b2c-7d3e-8f40-123456789abc' }],
  ])('answers 400 validation for %s', async (_case, body) => {
    const response = await request(body);
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'validation' });
  });

  it('refuses the 4th code in 15 minutes with 429 and Retry-After, and sends nothing', async () => {
    const phone = freshPhone();
    for (const offset of [0, 31, 62]) {
      clock = NOW + offset * SECOND;
      expect((await request({ phone })).statusCode).toBe(202);
    }
    const queued = otpSends.requests.length;
    clock = NOW + 93 * SECOND;

    const response = await request({ phone });

    expect(response.statusCode).toBe(429);
    expect(response.json()).toMatchObject({ code: 'rate_limited' });
    // The first code leaves the 15-minute window at 15:00.
    expect(response.headers['retry-after']).toBe(String(15 * 60 - 93));
    expect(otpSends.requests.length).toBe(queued);
    clock = NOW + 15 * MINUTE;
    expect((await request({ phone })).statusCode).toBe(202);
  });

  it('refuses a resend within 30 s', async () => {
    const phone = freshPhone();
    expect((await request({ phone })).statusCode).toBe(202);
    clock = NOW + 12 * SECOND;
    const response = await request({ phone });
    expect(response.statusCode).toBe(429);
    expect(response.headers['retry-after']).toBe('18');
  });

  it('refuses the 11th code in a day with 429 and Retry-After until the first is a day old', async () => {
    const phone = freshPhone();
    // 5:01 apart, so no 15-minute window ever holds more than three.
    for (let sent = 0; sent < 10; sent += 1) {
      clock = NOW + sent * 301 * SECOND;
      expect((await request({ phone })).statusCode).toBe(202);
    }
    clock = NOW + 10 * 301 * SECOND;
    const response = await request({ phone });
    expect(response.statusCode).toBe(429);
    expect(response.headers['retry-after']).toBe(String(24 * 60 * 60 - 10 * 301));
  });

  it("counts each number on its own: one number's limit never blocks another", async () => {
    const phone = freshPhone();
    await request({ phone });
    expect((await request({ phone })).statusCode).toBe(429);
    expect((await request({ phone: freshPhone() })).statusCode).toBe(202);
  });

  it('never writes the number or the code to the log', async () => {
    const { phone } = (await guardianAt()).account;
    logs.lines.length = 0;
    const code = await codeFor(phone);
    await verify({ phone, code });
    const text = JSON.stringify(logs.lines);
    expect(text).not.toContain(phone.slice(3));
    expect(text).not.toContain(code);
    expect(text).toContain('/api/v1/auth/otp/verify');
  });
});

describe('POST /auth/otp/verify (spec 05 parent app step 4)', () => {
  it('signs a guardian of one school in: a tenant token, a new refresh family and the audit', async () => {
    const { school, account, userId } = await guardianAt();
    const code = await codeFor(account.phone);

    const response = await verify({ phone: spaced(account.phone), code });

    expect(response.statusCode).toBe(200);
    const body = response.json<Record<string, unknown>>();
    expect(body).toMatchObject({
      status: 'signed_in',
      firstName: 'Dilhani',
      memberships: [
        {
          tenantId: school.id,
          name: 'Colombo International School',
          kind: 'guardian',
          suspended: false,
          logoUrl: null,
        },
      ],
    });
    const accessToken = String(body.accessToken);
    const refreshToken = String(body.refreshToken);
    expect(decodeProtectedHeader(accessToken)).toEqual({
      alg: 'EdDSA',
      typ: 'JWT',
      kid: await calculateJwkThumbprint(await exportJWK(TEST_PUBLIC_KEY)),
    });
    const sessionId = familyIdOf(refreshToken);
    expect(claimsOf(accessToken)).toEqual({
      iss: 'http://localhost:3000',
      aud: 'quad:parent',
      iat: NOW / 1000,
      exp: NOW / 1000 + 15 * 60,
      scope: 'tenant',
      sub: userId,
      acc: account.id,
      tid: school.id,
      kind: 'guardian',
      rh: anyText(),
      sid: sessionId,
    });
    expect(refreshToken).toMatch(new RegExp(`^${sessionId}\\.0\\.[A-Za-z0-9_-]{86}$`));
    const family = await familyRow(db(), sessionId);
    expect(family).toMatchObject({
      kind: 'mobile',
      stage: 'active',
      active_tenant_id: school.id,
      active_user_id: userId,
      token_hash: null,
      refresh_generation: 0,
      revoked_at: null,
    });
    expect(family.refresh_hash?.length).toBe(32);
    expect(family.created_at.getTime()).toBe(NOW);
    expect(family.expires_at.getTime()).toBe(NOW + 60 * DAY);
    const { rows: audits } = await db().platform.query<{ meta: Record<string, unknown> }>(
      `select meta from audit_log where action = 'auth.sign_in' and tenant_id = $1 and actor_user_id = $2`,
      [school.id, userId],
    );
    expect(audits).toEqual([{ meta: { method: 'otp', switchedSchool: false } }]);

    const me = await new Browser(app).get('/me', { headers: bearer(accessToken) });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({
      school: { id: school.id },
      person: { firstName: 'Dilhani' },
    });
  });

  it('signs in with an emailed code too', async () => {
    const { account } = await guardianAt();
    await request({ email: account.email });
    await deliver();
    const response = await verify({
      email: account.email,
      code: emailCode(delivery, account.email),
    });
    expect(response.json()).toMatchObject({ status: 'signed_in' });
  });

  it('asks for a school when there are several: a 5-minute select_school token, no refresh token', async () => {
    const { account, school } = await guardianAt();
    const other = await insertSchool(db(), { name: 'Kandy Hill Academy', shortName: 'KHA' });
    await insertParentMember(db(), other.id, account.id, 'relative');

    const response = await verify({ phone: account.phone, code: await codeFor(account.phone) });

    const body = response.json<Record<string, unknown>>();
    expect(body).toMatchObject({ status: 'choose_school' });
    expect(body.refreshToken).toBeUndefined();
    expect(body.firstName).toBeUndefined();
    expect(body.memberships).toEqual([
      expect.objectContaining({ tenantId: school.id, kind: 'guardian' }),
      expect.objectContaining({ tenantId: other.id, kind: 'relative' }),
    ]);
    const claims = claimsOf(String(body.accessToken));
    expect(claims).toMatchObject({ scope: 'select_school', acc: account.id, sub: account.id });
    expect(claims.exp).toBe(NOW / 1000 + 5 * 60);
    expect(claims.tid).toBeUndefined();
  });

  it('shows a lone suspended school on the picker instead of signing in', async () => {
    const school = await insertSchool(db(), {
      status: 'suspended',
      suspendReason: 'Unpaid invoice',
    });
    const account = await insertPhoneAccount(db());
    await insertParentMember(db(), school.id, account.id);
    const response = await verify({ phone: account.phone, code: await codeFor(account.phone) });
    expect(response.json()).toMatchObject({
      status: 'choose_school',
      memberships: [{ tenantId: school.id, suspended: true, suspendReason: 'Unpaid invoice' }],
    });
  });

  it('answers an unknown number, which never got a code, like a wrong code: 400 and the attempt counted', async () => {
    const phone = freshPhone();
    expect((await request({ phone })).statusCode).toBe(202);
    await deliver();
    expect(smsTo(phone)).toEqual([]);
    const response = await verify({ phone, code: '123456' });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'invalid_code' });
    const { rows } = await db().platform.query<{ attempts: number }>(
      'select attempts from otp_challenges order by id desc limit 1',
    );
    expect(rows[0]?.attempts).toBe(1);
  });

  it('answers not_found when the code verified but no parent membership is left, and opens nothing', async () => {
    const { account, userId } = await guardianAt();
    const code = await codeFor(account.phone);
    await db().platform.query(`update users set status = 'deactivated' where id = $1`, [userId]);
    const response = await verify({ phone: account.phone, code });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'not_found', memberships: [] });
    const { rows } = await db().platform.query('select 1 from sessions where account_id = $1', [
      account.id,
    ]);
    expect(rows).toEqual([]);
  });

  it("never lists another account's schools (school B's guardian is not found by A's number)", async () => {
    const mine = await guardianAt('School A');
    const theirs = await guardianAt('School B');
    const response = await verify({
      phone: mine.account.phone,
      code: await codeFor(mine.account.phone),
    });
    const body = response.json<{ memberships: { tenantId: string }[] }>();
    expect(body.memberships.map((membership) => membership.tenantId)).toEqual([mine.school.id]);
    expect(claimsOf(response.json<{ accessToken: string }>().accessToken).tid).not.toBe(
      theirs.school.id,
    );
  });

  it('refuses a wrong code with 400 invalid_code, and the 5th wrong code ends the challenge', async () => {
    const { account } = await guardianAt();
    const code = await codeFor(account.phone);
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const wrong = await verify({ phone: account.phone, code: otherCode(code) });
      expect(wrong.statusCode).toBe(400);
      expect(wrong.json()).toMatchObject({ code: 'invalid_code' });
    }
    const right = await verify({ phone: account.phone, code });
    expect(right.statusCode).toBe(400);
    expect(right.json()).toMatchObject({ code: 'invalid_code' });
    // A new code works.
    clock = NOW + 31 * SECOND;
    const fresh = await codeFor(account.phone);
    expect((await verify({ phone: account.phone, code: fresh })).json()).toMatchObject({
      status: 'signed_in',
    });
  });

  it('accepts the right code on the 5th try', async () => {
    const { account } = await guardianAt();
    const code = await codeFor(account.phone);
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await verify({ phone: account.phone, code: otherCode(code) });
    }
    expect((await verify({ phone: account.phone, code })).json()).toMatchObject({
      status: 'signed_in',
    });
  });

  it('counts every one of 8 parallel wrong guesses: at most 5 land, and the code is dead after', async () => {
    const { account } = await guardianAt();
    const code = await codeFor(account.phone);
    const guesses = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        verify({
          phone: account.phone,
          code: otherCode(String((Number(code) + index) % 1_000_000).padStart(6, '0')),
        }),
      ),
    );
    expect(guesses.every((response) => response.statusCode === 400)).toBe(true);
    // The newest challenge by id (uuidv7, in insertion order): this test's.
    const { rows } = await db().platform.query<{ attempts: number }>(
      'select attempts from otp_challenges order by id desc limit 1',
    );
    const [latest] = rows;
    expect(latest?.attempts).toBeLessThanOrEqual(5);
    expect(latest?.attempts).toBe(5);
    expect((await verify({ phone: account.phone, code })).statusCode).toBe(400);
  });

  it('refuses an expired code with 400 invalid_code (10 minutes)', async () => {
    const { account } = await guardianAt();
    const code = await codeFor(account.phone);
    clock = NOW + 10 * MINUTE;
    const response = await verify({ phone: account.phone, code });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'invalid_code' });
  });

  it('takes a code once, even when two verifications race', async () => {
    const { account } = await guardianAt();
    const code = await codeFor(account.phone);
    const responses = await Promise.all([
      verify({ phone: account.phone, code }),
      verify({ phone: account.phone, code }),
    ]);
    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 400]);
    expect((await verify({ phone: account.phone, code })).statusCode).toBe(400);
  });

  it('accepts only the latest code', async () => {
    const { account } = await guardianAt();
    const first = await codeFor(account.phone);
    clock = NOW + 31 * SECOND;
    const second = await codeFor(account.phone);
    if (first !== second) {
      expect((await verify({ phone: account.phone, code: first })).statusCode).toBe(400);
    }
    expect((await verify({ phone: account.phone, code: second })).statusCode).toBe(200);
  });

  it("never accepts one number's code for another", async () => {
    const mine = await guardianAt();
    const theirs = await guardianAt();
    const mineCode = await codeFor(mine.account.phone);
    const theirsCode = await codeFor(theirs.account.phone);
    const response = await verify({ phone: theirs.account.phone, code: mineCode });
    // Two random codes are equal one time in a million; then there is nothing to show.
    if (mineCode !== theirsCode) expect(response.statusCode).toBe(400);
  });

  it('answers a wrong code the same way for a known, a locked and an unknown number, before any lookup', async () => {
    const known = await guardianAt();
    const lockedSchool = await insertSchool(db());
    const locked = await insertPhoneAccount(db(), { lockedUntil: new Date(NOW + 10 * MINUTE) });
    await insertParentMember(db(), lockedSchool.id, locked.id);
    const unknown = freshPhone();
    const definers = app().get<QuadTenantDb>(TENANT_DB).definers;
    const bodies: string[] = [];
    for (const phone of [known.account.phone, locked.phone, unknown]) {
      // The unknown number gets no code (D39); any guess is just as wrong.
      const code = phone === unknown ? (await request({ phone }), '000000') : await codeFor(phone);
      const lookup = vi.spyOn(definers, 'accountByIdentifier');
      const response = await verify({ phone, code: otherCode(code) });
      expect(lookup).not.toHaveBeenCalled();
      lookup.mockRestore();
      expect(response.statusCode).toBe(400);
      bodies.push(response.body);
    }
    expect(new Set(bodies).size).toBe(1);
  });

  it('answers 403 account_locked only after the right code for a locked account', async () => {
    const school = await insertSchool(db());
    const locked = await insertPhoneAccount(db(), { lockedUntil: new Date(NOW + 10 * MINUTE) });
    await insertParentMember(db(), school.id, locked.id);
    const response = await verify({ phone: locked.phone, code: await codeFor(locked.phone) });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'account_locked' });
  });

  it.each([
    ['no code', { phone: '+94770000001' }],
    ['a 5-digit code', { phone: '+94770000001', code: '12345' }],
    ['a landline', { phone: '+94 11 234 5678', code: '123456' }],
    ['both subjects', { phone: '+94770000001', email: 'a@example.test', code: '123456' }],
  ])('answers 400 validation for %s', async (_case, body) => {
    const response = await verify(body);
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'validation' });
  });
});

describe('fixed codes (spec 16)', () => {
  describe('DEV_FIXED_OTP (local and staging only)', () => {
    const fixedDelivery = new RecordingDelivery();
    const fixedSends = new RecordingOtpSends(fixedDelivery);
    const fixed = useDatabaseApp(
      { DEV_FIXED_OTP: '000000' },
      { overrides: { now: () => clock, delivery: fixedDelivery, otpSends: fixedSends } },
    );

    it('sends and accepts the fixed code', async () => {
      const school = await insertSchool(fixed.db());
      const account = await insertPhoneAccount(fixed.db());
      await insertParentMember(fixed.db(), school.id, account.id);
      const { phone } = account;
      expect((await new Browser(fixed.app).post('/auth/otp/request', { phone })).statusCode).toBe(
        202,
      );
      await fixedSends.process(fixed.app());
      expect(smsCode(fixedDelivery, phone)).toBe('000000');
      const response = await new Browser(fixed.app).post('/auth/otp/verify', {
        phone,
        code: '000000',
      });
      expect(response.json()).toMatchObject({ status: 'signed_in' });
    });
  });

  describe('STORE_REVIEW_PHONE (its own number, its secret code, its school only)', () => {
    const reviewPhone = '+94770009999';
    const reviewSchoolId = randomUUID();
    const reviewDelivery = new RecordingDelivery();
    const reviewSends = new RecordingOtpSends(reviewDelivery);
    const review = useDatabaseApp(
      {
        DEV_FIXED_OTP: undefined,
        STORE_REVIEW_PHONE: reviewPhone,
        STORE_REVIEW_OTP: '481516',
        STORE_REVIEW_TENANT_ID: reviewSchoolId,
      },
      { overrides: { now: () => clock, delivery: reviewDelivery, otpSends: reviewSends } },
    );
    const ask = async (phone: string) => {
      await new Browser(review.app).post('/auth/otp/request', { phone });
      await reviewSends.process(review.app());
    };
    const verifyReview = (code: string) =>
      new Browser(review.app).post('/auth/otp/verify', { phone: reviewPhone, code });
    /** The review account: a guardian at App Review and at another school. */
    async function reviewAccount(): Promise<void> {
      const appReview = await insertSchool(review.db(), { id: reviewSchoolId, name: 'App Review' });
      const other = await insertSchool(review.db(), { name: 'A real school' });
      const account = await review
        .db()
        .platform.query<{ id: string }>(
          `insert into accounts (id, phone_e164, status) values (gen_random_uuid(), $1, 'active') returning id`,
          [reviewPhone],
        );
      const accountId = account.rows[0]?.id ?? '';
      await insertParentMember(review.db(), appReview.id, accountId);
      await insertParentMember(review.db(), other.id, accountId);
    }

    beforeAll(reviewAccount);

    it('sends the review number its secret code, and other parents a random one', async () => {
      await ask(reviewPhone);
      expect(smsCode(reviewDelivery, reviewPhone)).toBe('481516');
      const school = await insertSchool(review.db());
      const codes = new Set<string>();
      for (let count = 0; count < 3; count += 1) {
        const parent = await insertPhoneAccount(review.db());
        await insertParentMember(review.db(), school.id, parent.id);
        await ask(parent.phone);
        codes.add(smsCode(reviewDelivery, parent.phone));
      }
      expect(codes.has('481516') && codes.size === 1).toBe(false);
    });

    it('signs the review number in to the App Review school only, never another school', async () => {
      clock = NOW + 31 * SECOND;
      await ask(reviewPhone);
      const response = await verifyReview('481516');
      expect(response.json()).toMatchObject({
        status: 'signed_in',
        memberships: [{ tenantId: reviewSchoolId }],
      });
      expect(response.json<{ memberships: unknown[] }>().memberships).toHaveLength(1);
    });

    it('answers not_found when the review number has no App Review membership', async () => {
      const setStatus = (status: string) =>
        review
          .db()
          .platform.query('update users set status = $2 where tenant_id = $1', [
            reviewSchoolId,
            status,
          ]);
      await setStatus('deactivated');
      try {
        clock = NOW + 62 * SECOND;
        await ask(reviewPhone);
        expect((await verifyReview('481516')).json()).toEqual({
          status: 'not_found',
          memberships: [],
        });
      } finally {
        await setStatus('active');
      }
    });
  });
});
