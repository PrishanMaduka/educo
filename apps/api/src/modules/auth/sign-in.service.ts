import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { nextSignInStep, strictestTwoStep } from '@quad/domain';

import { PasswordHasher } from '../../common/crypto/passwords';
import { SignedLinks } from '../../common/crypto/signed-links';
import { formatMessage } from '../../common/delivery/templates/render';
import {
  AccountLockedError,
  ForbiddenError,
  InvalidCredentialsError,
  InvalidLinkError,
} from '../../common/errors';
import { hashSessionToken, isSessionTokenShape } from '../../common/session/cookies';
import { errorForLog } from '../../observability/logger';
import { CLOCK, LOGGER, TENANT_DB } from '../../tokens';

import { AccountAudit } from './account-audit.service';
import { AuthRepository } from './auth.repository';
import { LockoutService } from './lockout.service';
import { MembershipsService } from './memberships.service';
import { SignInSessions } from './sign-in-session.service';

import type { SessionCookies, SignInClient, SignInState } from './sign-in-session.service';
import type { RequestAuth } from '../../common/session/request-auth';
import type { Clock } from '../../tokens';
import type {
  PasswordSignInInput,
  SelectSchoolInput,
  SignInNext,
  SignedLinkPayload,
} from '@quad/contracts';
import type { QuadTenantDb } from '@quad/db';
import type { TwoStepRow } from '@quad/domain';
import type { Logger } from 'pino';

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
    private readonly links: SignedLinks,
    private readonly accountAudit: AccountAudit,
    @Inject(CLOCK) private readonly now: Clock,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  /**
   * `POST /auth/password`. An unknown email, a wrong password and a disabled account all answer
   * 401 `invalid_credentials`, and before answering they do the same work: one account lookup,
   * one read of the lockout counter, one credentials read, one Argon2 verify and one counted
   * failure (an unknown email uses a throwaway id). The audit is written after the response. A
   * locked account answers 403 `account_locked`; no lockout counter, 503. The breached-password
   * check runs when a password is set, not here.
   */
  async password(input: PasswordSignInInput, client: SignInClient): Promise<SignInOutcome> {
    const now = new Date(this.now());
    const account = await this.db.definers.accountByIdentifier({ email: input.email });
    const accountId = account?.id ?? randomUUID();
    await this.lockout.assertCounting(accountId);
    if (account !== null && (account.status === 'locked' || this.lockout.isLocked(account, now))) {
      throw new AccountLockedError();
    }
    const { passwordHash } = await this.repository.credentials(accountId);
    const matches =
      account === null || passwordHash === null
        ? await this.hasher.verifyDummy(input.password)
        : await this.hasher.verify(passwordHash, input.password);
    if (account === null || account.status === 'disabled' || !matches) {
      await this.lockout.recordFailure(accountId, now);
      if (account !== null) this.auditFailureLater(account.id, client, 'wrong_password');
      throw new InvalidCredentialsError();
    }
    const outcome = await this.continueSignIn({
      accountId,
      session: null,
      keepSignedIn: input.keepSignedIn,
      method: 'password',
      twoStepDone: false,
      trustedByCookie: await this.trustedByCookie(accountId, client.trustedToken, now),
      ...(input.inviteToken === undefined ? {} : { invite: input.inviteToken }),
      client,
      now,
    });
    // The failures are forgotten only once every factor has passed (the code step clears them).
    if (outcome.next !== 'two_step') await this.lockout.clear(accountId);
    return outcome;
  }

  /**
   * Decides the next step and moves the session there: no school (the session ends), a step
   * (two-step, set-up, Choose a school), or active in the only school. A lone school that is
   * suspended is shown on Choose a school with its reason instead of being opened.
   */
  async continueSignIn(state: SignInState): Promise<SignInOutcome> {
    const [rules, memberships, credentials, pending] = await Promise.all([
      this.db.definers.authSignInRules(state.accountId),
      this.memberships.staffMemberships(state.accountId),
      this.repository.credentials(state.accountId),
      this.pendingInvite(state),
    ]);
    const next = nextSignInStep({
      totpEnabled: credentials.totpEnabled,
      // A pending invitation's school counts with its own rule (I4).
      twoStepRequired: strictestTwoStep(pending === null ? rules : [...rules, pending]).required,
      // A code checked in this request counts like a trusted device: two-step is done.
      trustedDevice: state.trustedByCookie || state.twoStepDone,
      membershipCount: memberships.length + (pending === null ? 0 : 1),
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
        const opened = await this.steps.activate(state, only, { switching: false });
        return { next: opened.next, session: opened.cookies };
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
  ): Promise<{
    readonly next: 'done' | 'two_step_setup';
    readonly session: SessionCookies;
    readonly lastSchool: string | null;
  }> {
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
    const opened = await this.steps.activate(
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
    // Set-up first (I2): the school is not opened, so it is not remembered either.
    const remember = opened.next === 'done' && input.remember;
    return {
      next: opened.next,
      session: opened.cookies,
      lastSchool: remember ? membership.tenantName : null,
    };
  }

  /**
   * The school of a pending staff invitation the invite page sent as a hint (fix round 1, I4), as
   * a two-step rule row, or null. The link is inspected, never used up, and counts only when it is
   * this account's current invitation; anything else is ignored, as if no hint had been sent. It
   * runs only after the password (and code) passed, so it changes nothing a wrong guess sees.
   */
  private async pendingInvite(state: SignInState): Promise<TwoStepRow | null> {
    if (state.invite === undefined) return null;
    let payload: SignedLinkPayload;
    try {
      payload = this.links.inspectLink(state.invite, 'staff_invite', state.now);
    } catch (error) {
      if (error instanceof InvalidLinkError) return null;
      throw error;
    }
    const tenantId = payload.tid;
    if (tenantId === null) return null;
    return this.repository.inAccount(state.accountId, tenantId, async (tx) => {
      const roleKeys = await this.repository.pendingInviteIn(tx, {
        userId: payload.sub,
        accountId: state.accountId,
        nonce: payload.nonce,
      });
      if (roleKeys === null) return null;
      const profile = await this.db.definers.currentTenantProfile(tx);
      if (profile === null || profile.status === 'deleted') return null;
      return { twoStep: profile.twoStep, roleKeys };
    });
  }

  /** True when `token` is a live trusted device of this account (spec 05, 30 days). */
  async trustedByCookie(accountId: string, token: string | undefined, now: Date): Promise<boolean> {
    if (!isSessionTokenShape(token)) return false;
    return this.repository.isTrustedDevice(accountId, hashSessionToken(token), now);
  }

  /**
   * A failed two-step or recovery code: it counts toward the lockout (503 when it cannot be
   * counted), and is audited after the response.
   */
  async recordCodeFailure(accountId: string, client: SignInClient, now: Date): Promise<void> {
    await this.lockout.recordFailure(accountId, now);
    this.auditFailureLater(accountId, client, 'wrong_code');
  }

  /**
   * `auth.sign_in_failed` in every school where the account is active staff (OQ11), written off
   * the response path so its cost (one transaction per school) says nothing about the account.
   * An error is logged, never thrown. Unknown emails are never audited.
   */
  private auditFailureLater(
    accountId: string,
    client: SignInClient,
    reason: 'wrong_password' | 'wrong_code',
  ): void {
    setImmediate(() => {
      this.accountAudit
        .recordInStaffSchools(accountId, client.ip, 'auth.sign_in_failed', { reason })
        .catch((error: unknown) => {
          this.logger.warn(
            { metric: 'sign_in_audit_failed', error: errorForLog(error) },
            'A failed sign-in could not be audited',
          );
        });
    });
  }
}
