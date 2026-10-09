import { Inject, Injectable } from '@nestjs/common';
import { nextSignInStep, strictestTwoStep } from '@quad/domain';

import { AuditService } from '../../common/audit/audit.service';
import { PasswordHasher } from '../../common/crypto/passwords';
import { formatMessage } from '../../common/delivery/templates/render';
import { AccountLockedError, ForbiddenError, InvalidCredentialsError } from '../../common/errors';
import { hashSessionToken, isSessionTokenShape } from '../../common/session/cookies';
import { CLOCK, TENANT_DB } from '../../tokens';

import { AuthRepository } from './auth.repository';
import { LockoutService } from './lockout.service';
import { MembershipsService } from './memberships.service';
import { SignInSessions } from './sign-in-session.service';

import type { SessionCookies, SignInClient, SignInState } from './sign-in-session.service';
import type { RequestAuth } from '../../common/session/request-auth';
import type { Clock } from '../../tokens';
import type { PasswordSignInInput, SelectSchoolInput, SignInNext } from '@quad/contracts';
import type { QuadTenantDb } from '@quad/db';

export type {
  SessionCookies,
  SignInClient,
  SignInState,
  StepSession,
} from './sign-in-session.service';

/** What a sign-in step answers and which cookies the controller sets or clears. */
export interface SignInOutcome {
  readonly next: SignInNext;
  /** New cookies, `clear` to drop them, or undefined to leave them. */
  readonly session?: SessionCookies | 'clear';
  /** A new trusted-device cookie ("Trust this device for 30 days"). */
  readonly trustedDevice?: { readonly token: string; readonly maxAgeSeconds: number };
}

/**
 * Staff sign-in after the first factor (spec 05 steps 3 to 5): it checks the password with an
 * equal-time dummy for unknown accounts, applies the lockout, and decides the next step with
 * `nextSignInStep`; `SignInSessions` moves the session there. A session becomes active only in
 * one of the account's own staff memberships, chosen by the person (or the only one).
 */
@Injectable()
export class SignInService {
  constructor(
    @Inject(TENANT_DB) private readonly db: QuadTenantDb,
    private readonly repository: AuthRepository,
    private readonly steps: SignInSessions,
    private readonly memberships: MembershipsService,
    private readonly lockout: LockoutService,
    private readonly hasher: PasswordHasher,
    private readonly audit: AuditService,
    @Inject(CLOCK) private readonly now: Clock,
  ) {}

  /**
   * `POST /auth/password`. An unknown email, a wrong password and a disabled account all answer
   * 401 `invalid_credentials` after a full Argon2 verify; a locked account answers 403
   * `account_locked`. The breached-password check runs when a password is set, not here.
   */
  async password(input: PasswordSignInInput, client: SignInClient): Promise<SignInOutcome> {
    const now = new Date(this.now());
    const account = await this.db.definers.accountByIdentifier({ email: input.email });
    if (account === null) {
      await this.hasher.verifyDummy(input.password);
      throw new InvalidCredentialsError();
    }
    if (account.status === 'locked' || this.lockout.isLocked(account, now)) {
      throw new AccountLockedError();
    }
    const { passwordHash } = await this.repository.credentials(account.id);
    const matches =
      passwordHash === null
        ? await this.hasher.verifyDummy(input.password)
        : await this.hasher.verify(passwordHash, input.password);
    if (account.status === 'disabled') {
      throw new InvalidCredentialsError();
    }
    if (!matches) {
      await this.recordFailure(account.id, client, now, 'wrong_password');
      throw new InvalidCredentialsError();
    }
    await this.lockout.clear(account.id);
    return this.continueSignIn({
      accountId: account.id,
      session: null,
      keepSignedIn: input.keepSignedIn,
      twoStepDone: false,
      trustedByCookie: await this.trustedByCookie(account.id, client.trustedToken, now),
      client,
      now,
    });
  }

  /**
   * Decides the next step and moves the session there: no school (the session ends), a step
   * (two-step, set-up, Choose a school), or active in the only school. A lone school that is
   * suspended is shown on Choose a school with its reason instead of being opened.
   */
  async continueSignIn(state: SignInState): Promise<SignInOutcome> {
    const [rules, memberships, credentials] = await Promise.all([
      this.db.definers.authSignInRules(state.accountId),
      this.memberships.staffMemberships(state.accountId),
      this.repository.credentials(state.accountId),
    ]);
    const next = nextSignInStep({
      totpEnabled: credentials.totpEnabled,
      twoStepRequired: strictestTwoStep(rules).required,
      // A code checked in this request counts like a trusted device: two-step is done.
      trustedDevice: state.trustedByCookie || state.twoStepDone,
      membershipCount: memberships.length,
    });
    switch (next) {
      case 'no_school':
        return {
          next,
          ...(state.session === null ? {} : { session: await this.steps.end(state) }),
        };
      case 'done': {
        const [only] = memberships;
        if (only === undefined || only.suspended) {
          return {
            next: 'choose_school',
            session: await this.steps.atStep(state, 'choose_school'),
          };
        }
        return { next, session: await this.steps.activate(state, only, { switching: false }) };
      }
      case 'two_step':
      case 'two_step_setup':
      case 'choose_school':
        return { next, session: await this.steps.atStep(state, next) };
    }
  }

  /**
   * `POST /auth/select-school`: only one of the account's own staff memberships (ruling F12, and
   * the Task 2 ruling: the membership must belong to the session's account), never a suspended
   * school. A refusal leaves the session as it was. From an active session this is Switch
   * school: the membership is checked again and the token rotates.
   */
  async selectSchool(
    auth: RequestAuth,
    input: SelectSchoolInput,
    client: SignInClient,
  ): Promise<{ readonly session: SessionCookies; readonly lastSchool: string | null }> {
    if (auth.kind !== 'web') {
      throw new ForbiddenError('forbidden', formatMessage('error.notYourSchool'));
    }
    const memberships = await this.memberships.staffMemberships(auth.accountId);
    const membership = memberships.find((candidate) => candidate.tenantId === input.tenantId);
    if (membership === undefined) {
      throw new ForbiddenError('forbidden', formatMessage('error.notYourSchool'));
    }
    if (membership.suspended) {
      throw new ForbiddenError(
        'school_suspended',
        membership.suspendReason ?? formatMessage('error.schoolSuspended'),
      );
    }
    const now = new Date(this.now());
    const switching = auth.stage === 'active';
    const session = await this.steps.activate(
      {
        accountId: auth.accountId,
        session: { id: auth.sessionId, tokenHash: auth.tokenHash },
        keepSignedIn: false,
        twoStepDone: true,
        trustedByCookie:
          switching || (await this.trustedByCookie(auth.accountId, client.trustedToken, now)),
        client,
        now,
      },
      membership,
      { switching },
    );
    return { session, lastSchool: input.remember ? membership.tenantName : null };
  }

  /** True when `token` is a live trusted device of this account (spec 05, 30 days). */
  async trustedByCookie(accountId: string, token: string | undefined, now: Date): Promise<boolean> {
    if (!isSessionTokenShape(token)) return false;
    return this.repository.isTrustedDevice(accountId, hashSessionToken(token), now);
  }

  /**
   * A failed password or two-step code: it counts toward the lockout, and is audited as
   * `auth.sign_in_failed` in every school where the account is active staff (OQ11), one
   * `withTenant` per school. Unknown emails are never audited.
   */
  async recordFailure(
    accountId: string,
    client: SignInClient,
    now: Date,
    reason: 'wrong_password' | 'wrong_code',
  ): Promise<void> {
    await this.lockout.recordFailure(accountId, now);
    const memberships = await this.memberships.staffMemberships(accountId);
    for (const membership of memberships) {
      await this.db.withTenant(membership.tenantId, (tx) =>
        this.audit.record(
          {
            tx,
            tenantId: membership.tenantId,
            userId: membership.userId,
            supportSessionId: null,
            platformUserId: null,
            ip: client.ip,
          },
          'auth.sign_in_failed',
          { type: 'account', id: accountId },
          { reason },
        ),
      );
    }
  }
}
