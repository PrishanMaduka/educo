import { randomInt } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { uuidv7 } from '@quad/db';
import {
  OTP_CODE_MINUTES,
  fixedOtpFor,
  isLockedAt,
  isStoreReviewSubject,
  otpSendDecision,
  parseInternationalPhone,
} from '@quad/domain';

import { formatMessage } from '../../../common/delivery/templates/render';
import {
  AccountLockedError,
  InvalidCodeError,
  RateLimitedError,
  ValidationError,
} from '../../../common/errors';
import { CLOCK, CONFIG, OTP_SENDS, TENANT_DB } from '../../../tokens';
import { MembershipsService, toParentMembership } from '../memberships.service';
import { TokenService } from '../tokens/token.service';

import { OtpHashes } from './otp-hashes';
import { OtpRepository } from './otp.repository';

import type { OtpSendRequests } from './otp-sends';
import type { Config } from '../../../config';
import type { Clock } from '../../../tokens';
import type { TokenClient } from '../tokens/token.service';
import type { OtpRequestInput, OtpVerifyInput, OtpVerifyResult } from '@quad/contracts';
import type { QuadTenantDb } from '@quad/db';
import type { FixedOtpConfig, OtpSubject } from '@quad/domain';

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

const NOT_FOUND: OtpVerifyResult = { status: 'not_found', memberships: [] };

/** A fresh 6-digit code, uniformly random. */
const randomCode = (): string => String(randomInt(0, 1_000_000)).padStart(6, '0');

/**
 * Parent sign-in with a one-time code (spec 05 Parent app steps 2 to 4; spec 16). Tenant-less:
 * no school is read from the request. Asking for a code never looks an account up, so a known
 * and an unknown number get the same 202 and the same SMS; checking a code counts the attempt
 * and compares it before anyone is looked up, so a wrong code says nothing about the number.
 * Only then are the account's own guardian and relative memberships read.
 */
@Injectable()
export class OtpService {
  private readonly hashes: OtpHashes;

  constructor(
    @Inject(TENANT_DB) private readonly db: QuadTenantDb,
    private readonly repository: OtpRepository,
    private readonly memberships: MembershipsService,
    private readonly tokens: TokenService,
    @Inject(OTP_SENDS) private readonly sends: OtpSendRequests,
    @Inject(CONFIG) private readonly config: Config,
    @Inject(CLOCK) private readonly now: Clock,
  ) {
    this.hashes = new OtpHashes(config.SESSION_SECRET);
    this.fixedOtps = {
      appEnv: config.APP_ENV,
      devFixedOtp: config.DEV_FIXED_OTP ?? null,
      storeReviewPhone: config.STORE_REVIEW_PHONE ?? null,
      storeReviewOtp: config.STORE_REVIEW_OTP ?? null,
    };
  }

  private readonly fixedOtps: FixedOtpConfig;

  /**
   * `POST /auth/otp/request`: within the limits of `otpSendDecision` (3 per 15 minutes, 10 per
   * day, 30 s between codes; otherwise 429 with `Retry-After`), stores a challenge that lives
   * 10 minutes and queues the code by SMS or email. The code is random unless `fixedOtpFor`
   * gives one (local and staging, or the store-review number).
   */
  async request(input: OtpRequestInput): Promise<void> {
    const subject = subjectOf(input);
    const value = 'phone' in subject ? subject.phone : subject.email;
    const subjectHash = this.hashes.subject(value);
    const now = new Date(this.now());
    const challengeId = uuidv7();
    const code = fixedOtpFor(this.fixedOtps, subject) ?? randomCode();
    const decision = await this.repository.inOpen(async (tx) => {
      await this.repository.lockSubjectIn(tx, subjectHash);
      const sent = await this.repository.sentSinceIn(
        tx,
        subjectHash,
        new Date(now.getTime() - DAY_MS),
      );
      const allowed = otpSendDecision(sent, now);
      if (!allowed.allowed) return allowed;
      await this.repository.insertIn(tx, {
        id: challengeId,
        subjectHash,
        channel: 'phone' in subject ? 'sms' : 'email',
        codeHash: this.hashes.code(challengeId, code),
        at: now,
        expiresAt: new Date(now.getTime() + OTP_CODE_MINUTES * MINUTE_MS),
      });
      return allowed;
    });
    if (!decision.allowed) throw new RateLimitedError(decision.retryAfter);
    // One job either way; the worker sends it only to a known parent (D39).
    await this.sends.request({
      jobId: `otp-send.${challengeId}`,
      job: {
        challengeId,
        ...('phone' in subject ? { phone: subject.phone } : { email: subject.email }),
        code,
        minutes: OTP_CODE_MINUTES,
      },
    });
  }

  /**
   * `POST /auth/otp/verify`: the attempt is counted on the latest live code and the code
   * compared before any lookup (400 `invalid_code` for a wrong, expired, used-up or replaced
   * code alike); a right code is used up at once. Then the account: none, disabled or with no
   * guardian or relative membership is `not_found`; locked is 403 `account_locked`. One open
   * school signs in; several (or a lone suspended one) go to the school picker.
   */
  async verify(input: OtpVerifyInput, client: TokenClient): Promise<OtpVerifyResult> {
    const subject = subjectOf(input);
    const value = 'phone' in subject ? subject.phone : subject.email;
    const subjectHash = this.hashes.subject(value);
    const now = new Date(this.now());
    const accepted = await this.repository.inOpen(async (tx) => {
      const challenge = await this.repository.attemptIn(tx, subjectHash, now);
      if (
        challenge === null ||
        !this.hashes.matches(challenge.id, input.code, challenge.codeHash)
      ) {
        return false;
      }
      return this.repository.useIn(tx, challenge.id, now);
    });
    if (!accepted) throw new InvalidCodeError(formatMessage('error.invalidSignInCode'));

    const account = await this.db.definers.accountByIdentifier(subject);
    if (account === null || account.status === 'disabled') return NOT_FOUND;
    if (account.status === 'locked' || isLockedAt(account.lockedUntil, now)) {
      throw new AccountLockedError();
    }
    const memberships = (await this.memberships.parentMemberships(account.id)).filter(
      // The store-review number reaches the App Review school only (spec 16).
      (membership) =>
        !isStoreReviewSubject(this.fixedOtps, subject) ||
        membership.tenantId === this.config.STORE_REVIEW_TENANT_ID,
    );
    const listed = memberships.map(toParentMembership);
    const [only] = memberships;
    if (only === undefined) return NOT_FOUND;
    if (memberships.length === 1 && !only.suspended) {
      const { pair, firstName } = await this.tokens.openFamily(account.id, only, client);
      return { status: 'signed_in', firstName, memberships: listed, ...pair };
    }
    const accessToken = await this.tokens.awaitChoice(account.id, client);
    return { status: 'choose_school', memberships: listed, accessToken };
  }
}

/**
 * The normalised subject: an E.164 number from the country list (Sri Lanka only for now, OQ12),
 * or the email the contract already trimmed and lower-cased. 400 for any other number.
 */
function subjectOf(input: { readonly phone?: string; readonly email?: string }): OtpSubject {
  if (input.email !== undefined) return { email: input.email };
  const phone = parseInternationalPhone(input.phone ?? '');
  if (!phone.ok) throw new ValidationError({ phone: formatMessage('error.phoneNotAccepted') });
  return { phone: phone.e164 };
}
