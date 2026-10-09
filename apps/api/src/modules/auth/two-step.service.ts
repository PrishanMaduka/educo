import { randomBytes } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { generateRecoveryCodes, normaliseRecoveryCode } from '@quad/domain';
import { generateSecret, generateURI, verify } from 'otplib';

import { PasswordHasher } from '../../common/crypto/passwords';
import { formatMessage } from '../../common/delivery/templates/render';
import {
  AccountLockedError,
  ConflictError,
  InvalidCodeError,
  UnauthorizedError,
} from '../../common/errors';
import { hashSessionToken, newSessionToken } from '../../common/session/cookies';
import { CLOCK, CONFIG, FIELD_CIPHER } from '../../tokens';

import { AccountAudit } from './account-audit.service';
import { AuthRepository } from './auth.repository';
import { LockoutService } from './lockout.service';
import { SignInService } from './sign-in.service';

import type { SignInClient, SignInOutcome } from './sign-in.service';
import type { PersonAuth, RequestAuth } from '../../common/session/request-auth';
import type { Config } from '../../config';
import type { Clock } from '../../tokens';
import type { TotpSetupInput, TotpSetupResult, TotpVerifyInput } from '@quad/contracts';
import type { FieldCipher } from '@quad/db';

/** Spec 05 step 4: "Trust this device for 30 days". */
export const TRUSTED_DEVICE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
/** One 30-second step either side of now (spec 05: ±1 step). */
const TOTP_TOLERANCE_SECONDS = 30;
/** The issuer an authenticator app shows next to the code. */
const TOTP_ISSUER = 'Quad';

/** The signed-in person behind a sign-in step or `/me/totp` (never a support visit). */
function personOf(auth: RequestAuth): PersonAuth {
  if (auth.kind !== 'web') throw new UnauthorizedError();
  return auth;
}

/**
 * Two-step with an authenticator app (spec 05 step 4): the code step at sign-in, recovery codes
 * (single use), trusted devices, and setting up an authenticator (`POST /me/totp`). Secrets are
 * sealed with the field cipher; recovery codes are stored only as Argon2id hashes. A wrong code
 * counts toward the lockout like a wrong password. `DEV_FIXED_OTP` is accepted only when it is
 * set, which the config refuses in production.
 */
@Injectable()
export class TwoStepService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly signIn: SignInService,
    private readonly lockout: LockoutService,
    private readonly hasher: PasswordHasher,
    private readonly accountAudit: AccountAudit,
    @Inject(FIELD_CIPHER) private readonly cipher: FieldCipher,
    @Inject(CONFIG) private readonly config: Config,
    @Inject(CLOCK) private readonly now: Clock,
  ) {}

  /** `POST /auth/totp/verify` at stage `two_step`. */
  async verifyAtSignIn(
    auth: RequestAuth,
    input: TotpVerifyInput,
    client: SignInClient,
  ): Promise<SignInOutcome> {
    const person = personOf(auth);
    const now = new Date(this.now());
    await this.lockout.assertCounting(person.accountId);
    const account = await this.repository.account(person.accountId);
    if (account === null || account.status === 'disabled') throw new UnauthorizedError();
    if (account.status === 'locked' || this.lockout.isLocked(account, now)) {
      throw new AccountLockedError();
    }
    const accepted =
      input.code === undefined
        ? await this.useRecoveryCode(person.accountId, input.recoveryCode ?? '')
        : await this.checkCode(person.accountId, input.code, now);
    if (!accepted) {
      await this.signIn.recordCodeFailure(person.accountId, client, now);
      throw new InvalidCodeError();
    }
    await this.lockout.clear(person.accountId);
    const trustedByCookie = await this.signIn.trustedByCookie(
      person.accountId,
      client.trustedToken,
      now,
    );
    const trustedDevice = input.trustDevice
      ? await this.trustDevice(person.accountId, now)
      : undefined;
    const outcome = await this.signIn.continueSignIn({
      accountId: person.accountId,
      session: { id: person.sessionId, tokenHash: person.tokenHash },
      keepSignedIn: false,
      twoStepDone: true,
      trustedByCookie,
      client,
      now,
    });
    return trustedDevice === undefined ? outcome : { ...outcome, trustedDevice };
  }

  /**
   * `POST /me/totp`: without a code, starts a new authenticator; with one, confirms it and gives
   * the 10 recovery codes. Confirming at the `two_step_setup` step also moves the sign-in on.
   */
  async setUp(
    auth: RequestAuth,
    input: TotpSetupInput,
    client: SignInClient,
  ): Promise<{ readonly result: TotpSetupResult; readonly outcome: SignInOutcome | null }> {
    const person = personOf(auth);
    if (input.code === undefined) {
      return { result: await this.start(person), outcome: null };
    }
    const recoveryCodes = await this.confirm(person, input.code, client);
    const now = new Date(this.now());
    const outcome =
      person.stage === 'two_step_setup'
        ? await this.signIn.continueSignIn({
            accountId: person.accountId,
            session: { id: person.sessionId, tokenHash: person.tokenHash },
            keepSignedIn: false,
            twoStepDone: true,
            trustedByCookie: await this.signIn.trustedByCookie(
              person.accountId,
              client.trustedToken,
              now,
            ),
            client,
            now,
          })
        : null;
    return {
      result: { otpauthUri: null, recoveryCodes, next: outcome?.next ?? null },
      outcome,
    };
  }

  private async start(person: PersonAuth): Promise<TotpSetupResult> {
    const credentials = await this.repository.credentials(person.accountId);
    if (credentials.totpEnabled) {
      throw new ConflictError('conflict', formatMessage('error.authenticatorExists'));
    }
    const secret = generateSecret();
    const saved = await this.repository.savePendingTotp(
      person.accountId,
      await this.cipher.encrypt(secret),
    );
    if (!saved) {
      throw new ConflictError('conflict', formatMessage('error.authenticatorExists'));
    }
    const account = await this.repository.account(person.accountId);
    const otpauthUri = generateURI({
      issuer: TOTP_ISSUER,
      label: account?.email ?? TOTP_ISSUER,
      secret,
    });
    return { otpauthUri, recoveryCodes: null, next: null };
  }

  private async confirm(person: PersonAuth, code: string, client: SignInClient): Promise<string[]> {
    const credentials = await this.repository.credentials(person.accountId);
    const sealed = credentials.totpSecretEnc;
    if (credentials.totpEnabled || sealed === null) throw new InvalidCodeError();
    const secret = await this.cipher.decrypt(sealed);
    const match = await this.codeMatches(
      secret,
      code,
      new Date(this.now()),
      credentials.totpLastStep,
    );
    if (match === null) throw new InvalidCodeError();
    const recoveryCodes = generateRecoveryCodes((length) => randomBytes(length));
    const hashes = await Promise.all(recoveryCodes.map((recovery) => this.hasher.hash(recovery)));
    if (!(await this.repository.enableTotp(person.accountId, sealed, match.step, hashes))) {
      throw new InvalidCodeError();
    }
    await this.accountAudit.recordInStaffSchools(
      person.accountId,
      client.ip,
      'auth.two_step_enabled',
    );
    return recoveryCodes;
  }

  /**
   * The account's confirmed authenticator accepts `code` at `now`, and its time step was not
   * accepted before (RFC 6238 §5.2): the step is recorded at once, so a replay of the same code,
   * even a concurrent one, is refused.
   */
  private async checkCode(accountId: string, code: string, now: Date): Promise<boolean> {
    const credentials = await this.repository.credentials(accountId);
    if (!credentials.totpEnabled || credentials.totpSecretEnc === null) return false;
    const secret = await this.cipher.decrypt(credentials.totpSecretEnc);
    const match = await this.codeMatches(secret, code, now, credentials.totpLastStep);
    if (match === null) return false;
    return match.step === null || this.repository.acceptTotpStep(accountId, match.step);
  }

  /**
   * Whether `code` is the authenticator's code within one step of `now` and after `lastStep`:
   * the step it matched, `{ step: null }` for the local fixed code, or null for no match.
   */
  private async codeMatches(
    secret: string,
    code: string,
    now: Date,
    lastStep: number | null,
  ): Promise<{ readonly step: number | null } | null> {
    if (this.isFixedCode(code)) return { step: null };
    const result = await verify({
      secret,
      token: code,
      epoch: Math.floor(now.getTime() / 1000),
      epochTolerance: TOTP_TOLERANCE_SECONDS,
      ...(lastStep === null ? {} : { afterTimeStep: lastStep }),
    });
    // A TOTP match carries its RFC 6238 time step (the HOTP shape of the union never does).
    if (!result.valid || !('timeStep' in result)) return null;
    return { step: result.timeStep };
  }

  /** Local and staging only: the config refuses `DEV_FIXED_OTP` in production. */
  private isFixedCode(code: string): boolean {
    const fixed = this.config.DEV_FIXED_OTP;
    return fixed !== undefined && code === fixed;
  }

  /** Uses up a matching recovery code; false when none matches or it was just used. */
  private async useRecoveryCode(accountId: string, typed: string): Promise<boolean> {
    const code = normaliseRecoveryCode(typed);
    if (code === null) return false;
    const { recoveryCodesHash } = await this.repository.credentials(accountId);
    for (const hash of recoveryCodesHash) {
      if (await this.hasher.verify(hash, code)) {
        return this.repository.useRecoveryCode(accountId, hash);
      }
    }
    return false;
  }

  /** Stores a new trusted device (its SHA-256 only) and gives the cookie for it. */
  private async trustDevice(
    accountId: string,
    now: Date,
  ): Promise<{ readonly token: string; readonly maxAgeSeconds: number }> {
    const token = newSessionToken();
    const expiresAt = new Date(now.getTime() + TRUSTED_DEVICE_DAYS * DAY_MS);
    await this.repository.trustDevice(accountId, hashSessionToken(token), now, expiresAt);
    return { token, maxAgeSeconds: (TRUSTED_DEVICE_DAYS * DAY_MS) / 1000 };
  }
}
