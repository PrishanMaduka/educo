import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { isLockedAt, sessionExpiry } from '@quad/domain';

import { PasswordHasher } from '../../common/crypto/passwords';
import { TotpCodes } from '../../common/crypto/totp';
import { formatMessage } from '../../common/delivery/templates/render';
import {
  AccountLockedError,
  ConflictError,
  InvalidCodeError,
  InvalidCredentialsError,
  UnauthorizedError,
} from '../../common/errors';
import { hashSessionToken, newSessionToken } from '../../common/session/cookies';
import { CsrfTokens } from '../../common/session/csrf';
import { CLOCK, CONFIG, FIELD_CIPHER } from '../../tokens';
import { PlatformAuditService } from '../audit/platform-audit.service';
import { PLATFORM_DB } from '../tokens';

import { consoleFixedCode } from './console-fixed-code';
import { ConsoleSignInFailures, lockoutSubject } from './console-sign-in-failures';
import { PlatformAuthRepository } from './platform-auth.repository';

import type { ConsoleAuth } from './console-auth';
import type { ConsoleClient, ConsoleFailureReason } from './console-sign-in-failures';
import type { PasswordUser, TotpUser } from './platform-auth.repository';
import type { PlatformAuditAction, AuditMeta } from '../../common/audit/audit-actions';
import type { TotpMatch } from '../../common/crypto/totp';
import type { Config } from '../../config';
import type { Clock } from '../../tokens';
import type {
  PlatformPasswordSignInInput,
  PlatformSignInNext,
  PlatformTotpSetup,
  PlatformTotpVerifyInput,
} from '@quad/contracts';
import type { FieldCipher, PlatformTx, QuadPlatformDb } from '@quad/db';

export type { ConsoleClient } from './console-sign-in-failures';

/** The issuer an authenticator app shows next to the console's code. */
const TOTP_ISSUER = 'Quad console';

/** New console cookies (`setConsoleSessionCookies`). */
export interface ConsoleCookies {
  readonly token: string;
  readonly csrf: string;
}

export interface ConsoleSignInOutcome {
  readonly next: PlatformSignInNext;
  readonly cookies: ConsoleCookies;
}

/**
 * Console sign-in (spec 05 → Platform console; D37): email and password, then TOTP, which is
 * mandatory (a first sign-in sets it up), for active `platform_users`. The session is
 * `kind='console'`: a 15-minute sign-in step, then 8 hours idle once active, with a new token at
 * every step. Every step and sign-out is written to `platform_audit` in the same transaction as
 * its change (D17), and every refusal before it answers (`ConsoleSignInFailures`). Failures count
 * toward the lockout like staff sign-in, which fails closed (503) when Redis cannot count them.
 * `DEV_FIXED_OTP` opens the console only with `APP_ENV=local` (`consoleFixedCode`).
 */
@Injectable()
export class PlatformAuthService {
  private readonly fixedCode: string | undefined;

  constructor(
    @Inject(PLATFORM_DB) private readonly db: QuadPlatformDb,
    private readonly repository: PlatformAuthRepository,
    private readonly audit: PlatformAuditService,
    private readonly failures: ConsoleSignInFailures,
    private readonly hasher: PasswordHasher,
    private readonly totp: TotpCodes,
    private readonly csrf: CsrfTokens,
    @Inject(FIELD_CIPHER) private readonly cipher: FieldCipher,
    @Inject(CONFIG) config: Config,
    @Inject(CLOCK) private readonly now: Clock,
  ) {
    this.fixedCode = consoleFixedCode(config);
  }

  /**
   * `POST /platform/auth/password`. An unknown email, a deactivated user and a wrong password all
   * answer 401 `invalid_credentials` after the same work: one lookup, one counter read, one
   * Argon2 verify, one counted failure and one audit row. Unknown and deactivated users count
   * against a throwaway subject, so they are never locked (which would answer 403 instead). A
   * console session this browser already had (`replacing`) is revoked when the new one starts.
   */
  async password(
    input: PlatformPasswordSignInInput,
    client: ConsoleClient,
    replacing: Buffer | null,
  ): Promise<ConsoleSignInOutcome> {
    const now = new Date(this.now());
    const user = await this.db.withPlatform((tx) => this.repository.userByEmail(tx, input.email));
    const usable = user !== null && user.status !== 'disabled' ? user : null;
    const subject = lockoutSubject(usable?.id ?? randomUUID());
    await this.failures.assertCounting(subject, user?.id ?? null, client);
    if (usable !== null && (usable.status === 'locked' || isLockedAt(usable.lockedUntil, now))) {
      await this.failures.refused(usable.id, 'locked', client);
      throw new AccountLockedError();
    }
    const matches =
      user === null || user.passwordHash === null
        ? await this.hasher.verifyDummy(input.password)
        : await this.hasher.verify(user.passwordHash, input.password);
    if (usable === null || !matches) {
      await this.failures.counted(subject, user?.id ?? null, failureReason(user), client, now);
      throw new InvalidCredentialsError();
    }
    return this.startSignIn(usable, client, now, replacing);
  }

  /**
   * `POST /platform/auth/totp/setup` at `two_step_setup`: a new secret, sealed with the field
   * cipher and returned once (a second call replaces one that was never confirmed). 409 once an
   * authenticator is on.
   */
  async setUpTotp(auth: ConsoleAuth, client: ConsoleClient): Promise<PlatformTotpSetup> {
    const user = await this.totpUser(auth, client);
    if (user.totpEnabled) {
      throw new ConflictError('conflict', formatMessage('error.authenticatorExists'));
    }
    const secret = this.totp.newSecret();
    const sealed = await this.cipher.encrypt(secret);
    await this.db.withPlatform(async (tx) => {
      if (!(await this.repository.savePendingTotp(tx, user.id, sealed))) {
        throw new ConflictError('conflict', formatMessage('error.authenticatorExists'));
      }
      await this.record(tx, user.id, 'auth.two_step_setup_started', client);
    });
    return { secret, otpauthUri: this.totp.uri(TOTP_ISSUER, user.email, secret) };
  }

  /**
   * `POST /platform/auth/totp/verify` at `two_step` (the authenticator's code) or
   * `two_step_setup` (the first code of the new one, which turns it on). The counter is read
   * before the code is decrypted or checked. A wrong or replayed code is 400 `invalid_code` and
   * counts toward the lockout; a right one opens the console on a new token.
   */
  async verifyTotp(
    auth: ConsoleAuth,
    input: PlatformTotpVerifyInput,
    client: ConsoleClient,
  ): Promise<ConsoleSignInOutcome> {
    const now = new Date(this.now());
    const subject = lockoutSubject(auth.platformUserId);
    await this.failures.assertCounting(subject, auth.platformUserId, client);
    const user = await this.totpUser(auth, client);
    if (user.status === 'locked' || isLockedAt(user.lockedUntil, now)) {
      await this.failures.refused(user.id, 'locked', client);
      throw new AccountLockedError();
    }
    const settingUp = auth.stage === 'two_step_setup';
    // The code step checks the authenticator that is on; set-up checks the one not yet confirmed.
    const ready = settingUp ? !user.totpEnabled : user.totpEnabled;
    const sealed = ready ? user.totpSecretEnc : null;
    const match =
      sealed === null
        ? null
        : await this.totp.match(
            await this.cipher.decrypt(sealed),
            input.code,
            now,
            user.totpLastStep,
            this.fixedCode,
          );
    const accepted =
      sealed !== null &&
      match !== null &&
      (await this.db.withPlatform((tx) =>
        this.acceptCode(tx, user.id, sealed, match, settingUp, client),
      ));
    if (!accepted) {
      await this.failures.counted(subject, user.id, 'wrong_code', client, now);
      throw new InvalidCodeError();
    }
    const cookies = await this.openConsole(auth, client, now);
    await this.failures.clear(subject);
    return { next: 'done', cookies };
  }

  /** `POST /platform/auth/sign-out`: ends this console session, at any stage. */
  async signOut(auth: ConsoleAuth, client: ConsoleClient): Promise<void> {
    const now = new Date(this.now());
    await this.db.withPlatform(async (tx) => {
      await this.repository.revokeSession(tx, auth.sessionId, now);
      await this.record(tx, auth.platformUserId, 'auth.sign_out', client);
    });
  }

  /**
   * The password is right: a sign-in step session for the code, or for setting one up. The
   * browser's previous console session, if any, ends in the same transaction.
   */
  private async startSignIn(
    user: PasswordUser,
    client: ConsoleClient,
    now: Date,
    replacing: Buffer | null,
  ): Promise<ConsoleSignInOutcome> {
    const next = user.totpEnabled ? 'two_step' : 'two_step_setup';
    const token = newSessionToken();
    const tokenHash = hashSessionToken(token);
    await this.db.withPlatform(async (tx) => {
      const replaced =
        replacing === null ? null : await this.repository.revokeSessionByToken(tx, replacing, now);
      if (replaced !== null) {
        await this.record(tx, replaced, 'auth.sign_out', client, { reason: 'signed_in_again' });
      }
      await this.repository.insertSession(tx, {
        platformUserId: user.id,
        stage: next,
        tokenHash,
        ip: client.ip,
        userAgent: client.userAgent,
        now,
        expiresAt: sessionExpiry({ kind: 'sign_in_step', startedAt: now, now }).expiresAt,
      });
      await this.record(tx, user.id, 'auth.password_accepted', client);
    });
    return { next, cookies: { token, csrf: this.csrf.tokenFor(tokenHash) } };
  }

  /**
   * Records the code's time step (refusing a replay), or turns the new authenticator on with it;
   * false when another request got there first.
   */
  private async acceptCode(
    tx: PlatformTx,
    userId: string,
    sealed: string,
    match: TotpMatch,
    settingUp: boolean,
    client: ConsoleClient,
  ): Promise<boolean> {
    if (settingUp) {
      if (!(await this.repository.enableTotp(tx, userId, sealed, match.step))) return false;
      await this.record(tx, userId, 'auth.two_step_enabled', client);
      return true;
    }
    return match.step === null || this.repository.acceptTotpStep(tx, userId, match.step);
  }

  /** Moves the session to active on a new token (8 hours idle) and records the sign-in. */
  private async openConsole(
    auth: ConsoleAuth,
    client: ConsoleClient,
    now: Date,
  ): Promise<ConsoleCookies> {
    const token = newSessionToken();
    const tokenHash = hashSessionToken(token);
    await this.db.withPlatform(async (tx) => {
      const moved = await this.repository.moveSession(tx, auth.sessionId, auth.tokenHash, {
        stage: 'active',
        tokenHash,
        lastSeenAt: now,
        expiresAt: sessionExpiry({ kind: 'console', lastSeenAt: now, now }).expiresAt,
      });
      if (!moved) throw new UnauthorizedError();
      await this.repository.markSignedIn(tx, auth.platformUserId, now);
      await this.record(tx, auth.platformUserId, 'auth.sign_in', client);
    });
    return { token, csrf: this.csrf.tokenFor(tokenHash) };
  }

  /** The session's user for the authenticator steps; a deactivated one is audited, then 401. */
  private async totpUser(auth: ConsoleAuth, client: ConsoleClient): Promise<TotpUser> {
    const user = await this.db.withPlatform((tx) =>
      this.repository.totpUser(tx, auth.platformUserId),
    );
    if (user === null || user.status === 'disabled') {
      await this.failures.refused(auth.platformUserId, 'deactivated', client);
      throw new UnauthorizedError();
    }
    return user;
  }

  private async record(
    tx: PlatformTx,
    platformUserId: string,
    action: PlatformAuditAction,
    client: ConsoleClient,
    meta?: AuditMeta,
  ): Promise<void> {
    await this.audit.record(tx, {
      actorPlatformUserId: platformUserId,
      action,
      target: { type: 'platform_user', id: platformUserId },
      ip: client.ip,
      userAgent: client.userAgent,
      ...(meta === undefined ? {} : { meta }),
    });
  }
}

function failureReason(user: PasswordUser | null): ConsoleFailureReason {
  if (user === null) return 'unknown_email';
  return user.status === 'disabled' ? 'deactivated' : 'wrong_password';
}
