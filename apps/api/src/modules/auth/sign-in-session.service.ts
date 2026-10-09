import { Inject, Injectable } from '@nestjs/common';
import { KEEP_SIGNED_IN_DAYS, sessionExpiry } from '@quad/domain';

import { AuditService } from '../../common/audit/audit.service';
import { formatMessage } from '../../common/delivery/templates/render';
import { ForbiddenError, UnauthorizedError } from '../../common/errors';
import { hashSessionToken, newSessionToken } from '../../common/session/cookies';
import { CsrfTokens } from '../../common/session/csrf';
import { SessionRepository } from '../../common/session/session.repository';
import { SessionService } from '../../common/session/session.service';
import { CONFIG, DELIVERY, TENANT_DB } from '../../tokens';

import { AuthRepository } from './auth.repository';
import { describeDevice } from './device-name';

import type { DeliveryQueue } from '../../common/delivery/delivery.service';
import type { SessionPlace } from '../../common/session/session.repository';
import type { Config } from '../../config';
import type { SignInNext } from '@quad/contracts';
import type { AccountTx, AuthMembership, QuadTenantDb } from '@quad/db';

const DAY_SECONDS = 24 * 60 * 60;
/** Where the new-device email sends the person to review their signed-in devices. */
const SESSIONS_PAGE = '/app/me/sessions';

/** Who is signing in, from where: request facts, never a source of the tenant. */
export interface SignInClient {
  readonly ip: string;
  readonly userAgent: string | null;
  /** The trusted-device cookie, when the browser sent one. */
  readonly trustedToken: string | undefined;
}

/** New staff session cookies (both are set together, `setSessionCookies`). */
export interface SessionCookies {
  readonly token: string;
  readonly csrf: string;
  /** Set with Keep me signed in; without it the cookies end with the browser session. */
  readonly maxAgeSeconds?: number;
}

/** The live session a step continues: its id and the hash its cookie still has. */
export interface StepSession {
  readonly id: string;
  readonly tokenHash: Buffer;
}

/** Where a sign-in stands after a first factor (password, later SSO) or the two-step code. */
export interface SignInState {
  readonly accountId: string;
  /** Null right after the password: no session exists yet. */
  readonly session: StepSession | null;
  /** From the password step; a continuing session keeps its own. */
  readonly keepSignedIn: boolean;
  /** The two-step code (or a new authenticator) was just checked. */
  readonly twoStepDone: boolean;
  /** The request carried a valid trusted-device cookie of this account. */
  readonly trustedByCookie: boolean;
  readonly client: SignInClient;
  readonly now: Date;
}

/**
 * The staff session through the sign-in steps (spec 05): it starts at the first step, moves on
 * with a new token at every step (and on Switch school), becomes active only in a membership the
 * caller has checked, and ends when there is no school. Activation audits `auth.sign_in` in that
 * school and, for a device without the trusted-device cookie, queues the new-device email (spec
 * 16, ruling F43).
 */
@Injectable()
export class SignInSessions {
  constructor(
    @Inject(TENANT_DB) private readonly db: QuadTenantDb,
    private readonly repository: AuthRepository,
    private readonly sessionRows: SessionRepository,
    private readonly sessions: SessionService,
    private readonly csrf: CsrfTokens,
    private readonly audit: AuditService,
    @Inject(DELIVERY) private readonly delivery: DeliveryQueue,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  /** Puts the session at a sign-in step: a new session, or the same one with a new token. */
  async atStep(
    state: SignInState,
    stage: Exclude<SignInNext, 'no_school' | 'done'>,
  ): Promise<SessionCookies> {
    const place: SessionPlace = { stage, tenantId: null, userId: null };
    const { expiresAt } = sessionExpiry({
      kind: 'sign_in_step',
      startedAt: state.now,
      now: state.now,
    });
    const { cookies } = await this.write(state, place, () =>
      Promise.resolve({ expiresAt, value: null }),
    );
    return cookies;
  }

  /**
   * Makes the session active in `membership`'s school, in one transaction scoped to the account
   * and that school: the school must still be open, the session row moves (or starts) with a new
   * token, the membership and account record the sign-in, and `auth.sign_in` is audited there.
   */
  async activate(
    state: SignInState,
    membership: AuthMembership,
    options: { readonly switching: boolean },
  ): Promise<SessionCookies> {
    const place: SessionPlace = {
      stage: 'active',
      tenantId: membership.tenantId,
      userId: membership.userId,
    };
    const written = await this.write(state, place, async (tx, keepSignedIn) => {
      const profile = await this.db.definers.currentTenantProfile(tx);
      if (profile === null || profile.status === 'deleted') {
        throw new ForbiddenError('forbidden', formatMessage('error.notYourSchool'));
      }
      if (profile.status === 'suspended') {
        throw new ForbiddenError(
          'school_suspended',
          profile.suspendReason ?? formatMessage('error.schoolSuspended'),
        );
      }
      const name = await this.repository.memberSignedInIn(tx, membership.userId, state.now);
      const account = await this.repository.accountIn(tx, state.accountId);
      if (name === null || account === null) {
        throw new ForbiddenError('forbidden', formatMessage('error.notYourSchool'));
      }
      await this.repository.signedInIn(tx, state.accountId, state.now);
      await this.audit.record(
        {
          tx,
          tenantId: membership.tenantId,
          userId: membership.userId,
          supportSessionId: null,
          platformUserId: null,
          ip: state.client.ip,
        },
        'auth.sign_in',
        { type: 'user', id: membership.userId },
        { switchedSchool: options.switching },
      );
      const { expiresAt } = sessionExpiry({
        kind: 'web',
        lastSeenAt: state.now,
        keepSignedIn,
        sessionHours: profile.sessionHours,
        now: state.now,
      });
      return { expiresAt, value: { name, email: account.email, timeZone: profile.timeZone } };
    });
    if (!options.switching && !state.trustedByCookie) {
      await this.queueNewDeviceEmail(state, written.value);
    }
    return written.keepSignedIn
      ? { ...written.cookies, maxAgeSeconds: KEEP_SIGNED_IN_DAYS * DAY_SECONDS }
      : written.cookies;
  }

  /**
   * Writes the session at `place` with a new token, in one transaction scoped to the account
   * (and the school, once active). `inTx` runs in that transaction first and gives the expiry; it
   * is told whether the session keeps the person signed in. The old token's cache entry goes.
   */
  private async write<T>(
    state: SignInState,
    place: SessionPlace,
    inTx: (tx: AccountTx, keepSignedIn: boolean) => Promise<{ expiresAt: Date; value: T }>,
  ): Promise<{ cookies: SessionCookies; keepSignedIn: boolean; value: T }> {
    const token = newSessionToken();
    const tokenHash = hashSessionToken(token);
    const existing = state.session;
    const written = await this.repository.inAccount(state.accountId, place.tenantId, async (tx) => {
      if (existing === null) {
        const { expiresAt, value } = await inTx(tx, state.keepSignedIn);
        await this.sessionRows.insertIn(tx, {
          ...place,
          accountId: state.accountId,
          tokenHash,
          keepSignedIn: state.keepSignedIn,
          ip: state.client.ip,
          userAgent: state.client.userAgent,
          at: state.now,
          expiresAt,
        });
        return { keepSignedIn: state.keepSignedIn, value };
      }
      const locked = await this.sessionRows.lockForStepIn(tx, existing.id, existing.tokenHash);
      if (locked === null) throw new UnauthorizedError();
      const { expiresAt, value } = await inTx(tx, locked.keepSignedIn);
      await this.sessionRows.rotateIn(tx, existing.id, {
        ...place,
        tokenHash,
        at: state.now,
        expiresAt,
      });
      return { keepSignedIn: locked.keepSignedIn, value };
    });
    if (existing !== null) await this.sessions.invalidateToken(existing.tokenHash);
    return { ...written, cookies: { token, csrf: this.csrf.tokenFor(tokenHash) } };
  }

  /** Ends a sign-in that found no school: the session is revoked and its cookies cleared. */
  async end(state: SignInState): Promise<'clear'> {
    const session = state.session;
    if (session !== null) {
      await this.repository.inAccount(state.accountId, null, (tx) =>
        this.sessionRows.revokeIn(tx, state.accountId, session.id),
      );
      await this.sessions.invalidateToken(session.tokenHash);
    }
    return 'clear';
  }

  private async queueNewDeviceEmail(
    state: SignInState,
    signedIn: { readonly name: string; readonly email: string | null; readonly timeZone: string },
  ): Promise<void> {
    if (signedIn.email === null) return;
    await this.delivery.queueEmail({
      jobId: `new-device.${state.accountId}.${state.now.getTime()}`,
      to: signedIn.email,
      template: 'new_device',
      params: {
        name: signedIn.name,
        device: describeDevice(state.client.userAgent),
        signedInAt: state.now.toISOString(),
        timeZone: signedIn.timeZone,
        link: new URL(SESSIONS_PAGE, this.config.PUBLIC_WEB_URL).href,
      },
    });
  }
}
