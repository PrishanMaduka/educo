import { Inject, Injectable } from '@nestjs/common';
import {
  MIN_PASSWORD_LENGTH,
  SIGNED_LINK_RULES,
  canGrant,
  maskEmail,
  nameFromEmail,
  sensitiveKeysOf,
  staffActionRefusal,
} from '@quad/domain';

import { AuditService, auditActorOf } from '../../common/audit/audit.service';
import { PasswordHasher } from '../../common/crypto/passwords';
import { SignedLinks } from '../../common/crypto/signed-links';
import { formatMessage } from '../../common/delivery/templates/render';
import {
  BusinessRuleError,
  ForbiddenError,
  InvalidLinkError,
  InvariantError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../common/errors';
import { FOREIGN_KEY_VIOLATION, UNIQUE_VIOLATION, postgresCodeOf } from '../../common/pg-error';
import { schoolOf } from '../../common/session/request-auth';
import { BREACH_CHECK, CLOCK, CONFIG, DELIVERY, TENANT_DB } from '../../tokens';
import { AuthRepository } from '../auth/auth.repository';
import { assertNewPassword } from '../auth/new-password';
import { SignInService } from '../auth/sign-in.service';
import { RolesService } from '../roles/roles.service';

import { toStaffMember } from './users.mapper';
import { UsersRepository } from './users.repository';
import { UsersService, emailOf, refuseAction } from './users.service';

import type { StaffRow } from './users.repository';
import type { RequestAccess } from '../../common/access/permissions.service';
import type { AuditActor } from '../../common/audit/audit.service';
import type { BreachCheck } from '../../common/crypto/breach-check';
import type { DeliveryQueue } from '../../common/delivery/delivery.service';
import type { SchoolSender } from '../../common/delivery/email';
import type { RequestAuth } from '../../common/session/request-auth';
import type { Config } from '../../config';
import type { Clock } from '../../tokens';
import type { SignInClient, SignInOutcome } from '../auth/sign-in.service';
import type {
  InviteAcceptInput,
  InviteDetails,
  SessionStage,
  SignedLinkPayload,
  StaffInviteInput,
  StaffInviteResult,
} from '@quad/contracts';
import type { QuadTenantDb, TenantTx } from '@quad/db';

/** The invite link's lifetime in days, for the email (OQ7: 7 days). */
const INVITE_DAYS = (SIGNED_LINK_RULES.staff_invite.ttlSeconds ?? 0) / (24 * 60 * 60);

/** What sending invitations needs after the commit: each member with its new link. */
interface Sending {
  readonly invites: readonly { readonly member: StaffRow; readonly token: string }[];
  readonly school: SchoolSender;
  readonly inviter: string;
}

/** The invited membership a verified link names, and its school. */
interface Invitation {
  readonly tenantId: string;
  readonly member: StaffRow;
  readonly nonce: string;
  readonly school: string;
  readonly passwordMinLength: number;
  /**
   * This school's invitation created the account: no other membership anywhere and no password
   * yet. Only then may the invite page set its first password (OQ9, fix round 1 I3).
   */
  readonly createdByInvite: boolean;
}

/** The person signed in on the request accepting an invitation (`InvitesController`). */
export interface SignedInAccount {
  readonly accountId: string;
  /** `choose_school` or `active`: what the accept answers as the next step (M8). */
  readonly stage: Extract<SessionStage, 'choose_school' | 'active'>;
}

/** A race lost to another request: the same address invited, or the role deleted, meanwhile. */
function raceAnswer(error: unknown): Error | null {
  switch (postgresCodeOf(error)) {
    case UNIQUE_VIOLATION:
      return new BusinessRuleError('already_member', formatMessage('error.users.alreadyMember'));
    case FOREIGN_KEY_VIOLATION:
      return new NotFoundError();
    default:
      return null;
  }
}

const ALREADY_STAFF = () => formatMessage('error.users.alreadyMember');
const FAMILY_MEMBER = () => formatMessage('error.users.familyMember');

/**
 * The 422 for addresses that already belong here, each named for what it is (`fields.emails.<i>`):
 * a member of staff (`already_member`) or a guardian or relative (`family_member`, Task 14
 * review). The code is `already_member` when any address is staff; null when none clashes.
 */
function clashOf(
  accountIds: readonly string[],
  staff: ReadonlySet<string>,
  family: ReadonlySet<string>,
): BusinessRuleError | null {
  const fields: Record<string, string> = {};
  accountIds.forEach((id, index) => {
    if (staff.has(id)) fields[`emails.${index}`] = ALREADY_STAFF();
    else if (family.has(id)) fields[`emails.${index}`] = FAMILY_MEMBER();
  });
  if (Object.keys(fields).length === 0) return null;
  return accountIds.some((id) => staff.has(id))
    ? new BusinessRuleError('already_member', ALREADY_STAFF(), fields)
    : new BusinessRuleError('family_member', FAMILY_MEMBER(), fields);
}

/**
 * Staff invitations (spec 05 Account edge cases; spec 06 Invites; OQ7, OQ9). Sending adds an
 * invited membership per address, through `ensure_account_for_email`, so an existing account gets
 * a membership and never a second account (a removed membership comes back as the same row). The
 * link is a signed `staff_invite` (7 days, single use) naming the membership, and the membership
 * keeps that link's nonce: only the newest link works (Resend, deactivation and acceptance retire
 * it). Accepting is tenant-less (D16): the school comes only from the verified link. An account
 * this invitation created chooses its password there and is signed in (OQ9); any other account
 * must already be signed in as itself.
 */
@Injectable()
export class InvitesService {
  constructor(
    @Inject(TENANT_DB) private readonly db: QuadTenantDb,
    private readonly repository: UsersRepository,
    private readonly users: UsersService,
    private readonly roles: RolesService,
    private readonly authRepository: AuthRepository,
    private readonly signIn: SignInService,
    private readonly links: SignedLinks,
    private readonly hasher: PasswordHasher,
    private readonly audit: AuditService,
    @Inject(BREACH_CHECK) private readonly breachCheck: BreachCheck,
    @Inject(DELIVERY) private readonly delivery: DeliveryQueue,
    @Inject(CONFIG) private readonly config: Config,
    @Inject(CLOCK) private readonly now: Clock,
  ) {}

  /**
   * `POST /users/invite`: one invited membership per address, all or none: an address that is
   * already a member here refuses the batch (422 `already_member`, `fields.emails.<i>`).
   */
  async invite(
    auth: RequestAuth,
    access: RequestAccess,
    input: StaffInviteInput,
    ip: string,
  ): Promise<StaffInviteResult> {
    const actor = auditActorOf(schoolOf(auth), ip);
    const at = new Date(this.now());
    const sending = await this.racing(() =>
      this.db.withTenant(actor.tenantId, async (tx) => {
        const role = await this.roles.grantIn(tx, input.roleId);
        if (role === null) throw new NotFoundError();
        // Inviting with a role gives its sensitive keys: the granter must hold them (D32).
        if (!canGrant(sensitiveKeysOf(access.permissions), [], role.grant.sensitive)) {
          throw new ForbiddenError('forbidden', formatMessage('error.users.sensitiveNotHeld'));
        }
        const accountIds: string[] = [];
        for (const email of input.emails) {
          accountIds.push(await this.db.definers.ensureAccountForEmail(tx, email));
        }
        const { staff, family, removed } = await this.repository.membershipsByAccount(
          tx,
          accountIds,
        );
        const clash = clashOf(accountIds, staff, family);
        if (clash !== null) throw clash;
        const ids: string[] = [];
        for (const [index, email] of input.emails.entries()) {
          const accountId = accountIds[index];
          if (accountId === undefined) throw new InvariantError('An address has no account.');
          const invited = {
            accountId,
            name: nameFromEmail(email),
            email,
            roleId: role.role.id,
            at,
          };
          const removedId = removed.get(accountId);
          const id =
            removedId === undefined
              ? await this.repository.insertInvited(tx, actor.tenantId, invited)
              : removedId;
          if (removedId !== undefined) {
            await this.repository.reinstateInvited(tx, actor.tenantId, removedId, invited);
          }
          await this.record(tx, actor, 'user.invited', id, { roleId: role.role.id, resent: false });
          ids.push(id);
        }
        return this.sendingIn(tx, actor, ids, at);
      }),
    );
    await this.send(sending, at);
    return { items: sending.invites.map(({ member }) => toStaffMember(member, false, null)) };
  }

  /** `POST /users/:id/resend-invite`: a new link for a pending invitation; older ones stop. */
  async resend(auth: RequestAuth, userId: string, ip: string): Promise<void> {
    const actor = auditActorOf(schoolOf(auth), ip);
    const at = new Date(this.now());
    const sending = await this.db.withTenant(actor.tenantId, async (tx) => {
      const member = await this.repository.member(tx, userId);
      if (member === null) throw new NotFoundError();
      const refusal = staffActionRefusal('resend_invite', {
        status: member.status,
        twoStepOn: false,
      });
      if (refusal !== null) refuseAction(refusal);
      emailOf(member);
      await this.record(tx, actor, 'user.invited', userId, { resent: true });
      return this.sendingIn(tx, actor, [userId], at);
    });
    await this.send(sending, at);
  }

  /** `GET /auth/invites/:token`: what the invite page shows; any bad link is `invalid_link`. */
  async details(token: string): Promise<InviteDetails> {
    const payload = this.links.inspectLink(token, 'staff_invite', new Date(this.now()));
    const invitation = await this.invitation(payload);
    const { member } = invitation;
    const email = member.email ?? '';
    return {
      school: invitation.school,
      // A name still made from the address would spell out the masked part (M7).
      ...(member.name === nameFromEmail(email) ? {} : { name: member.name }),
      emailMasked: maskEmail(email),
      needsPassword: invitation.createdByInvite,
    };
  }

  /**
   * `POST /auth/invites/:token/accept`. The link is checked first without using it up, then the
   * person (the first password of an account this invitation created, or an existing account's
   * session), and only then is the link used up, so a refused attempt never burns it.
   */
  async accept(
    token: string,
    input: InviteAcceptInput,
    signedIn: SignedInAccount | null,
    client: SignInClient,
  ): Promise<SignInOutcome> {
    const now = new Date(this.now());
    const payload = this.links.inspectLink(token, 'staff_invite', now);
    const invitation = await this.invitation(payload);
    const { accountId } = invitation.member;
    if (!invitation.createdByInvite) {
      // An existing account accepts while signed in as itself (spec 05), never by the link alone.
      if (signedIn === null) throw new UnauthorizedError(formatMessage('error.invite.signInFirst'));
      if (signedIn.accountId !== accountId) {
        throw new ForbiddenError('forbidden', formatMessage('error.invite.otherAccount'));
      }
      await this.links.verifyLink(token, 'staff_invite', now);
      await this.activate(invitation, now, () => Promise.resolve(true));
      // The session stays where it is: active in its school, or choosing one (M8).
      return { next: signedIn.stage === 'active' ? 'done' : 'choose_school' };
    }
    if (input.password === undefined) {
      throw new ValidationError({ password: formatMessage('error.invite.choosePassword') });
    }
    await assertNewPassword(input.password, invitation.passwordMinLength, this.breachCheck);
    await this.links.verifyLink(token, 'staff_invite', now);
    const hash = await this.hasher.hash(input.password);
    // Only while the account still has no password (I3); otherwise the answer is a bad link's.
    await this.activate(invitation, now, (tx) =>
      this.authRepository.setFirstPasswordIn(tx, accountId, hash, now),
    );
    // OQ9: the one case besides the support session where a link leads to a session. The
    // usual steps follow (two-step set-up when the school requires it).
    return this.signIn.continueSignIn({
      accountId,
      session: null,
      keepSignedIn: false,
      method: 'password',
      twoStepDone: false,
      trustedByCookie: false,
      client,
      now,
    });
  }

  /**
   * The pending invitation a verified link names, read in the link's school only: a membership
   * still invited whose current link is this one (its nonce). Anything else is `invalid_link`,
   * which never names the school.
   */
  private async invitation(payload: SignedLinkPayload): Promise<Invitation> {
    const tenantId = payload.tid;
    if (tenantId === null) throw new InvalidLinkError();
    const invitation = await this.db.withTenant(tenantId, async (tx) => {
      const member = await this.repository.member(tx, payload.sub);
      if (member === null || member.status !== 'invited' || member.inviteNonce !== payload.nonce) {
        throw new InvalidLinkError();
      }
      const profile = await this.db.definers.currentTenantProfile(tx);
      if (profile === null || profile.status === 'deleted') throw new InvalidLinkError();
      const shared = await this.db.definers.memberHasOtherMemberships(tx, member.id);
      return { member, profile, shared };
    });
    const { member, profile, shared } = invitation;
    const [rules, credentials] = await Promise.all([
      this.db.definers.authSignInRules(member.accountId),
      this.authRepository.credentials(member.accountId),
    ]);
    return {
      tenantId,
      member,
      nonce: payload.nonce,
      school: profile.name,
      passwordMinLength: Math.max(
        MIN_PASSWORD_LENGTH,
        profile.passwordMinLength,
        ...rules.map((rule) => rule.passwordMinLength),
      ),
      createdByInvite: !shared && credentials.passwordHash === null,
    };
  }

  /**
   * Accepts under the account and the link's school: `first` runs first (the new invitee's
   * password), then the membership becomes active and `user.invite_accepted` is audited, all in one
   * transaction (M4). A lost race (the link retired, the password set meanwhile) is `invalid_link`.
   */
  private async activate(
    invitation: Invitation,
    at: Date,
    first: (tx: TenantTx) => Promise<boolean>,
  ): Promise<void> {
    const { member, tenantId, nonce } = invitation;
    await this.authRepository.inAccount(member.accountId, tenantId, async (tx) => {
      const accepted =
        (await first(tx)) &&
        (await this.repository.activateInvited(tx, {
          userId: member.id,
          accountId: member.accountId,
          nonce,
          at,
        }));
      if (!accepted) throw new InvalidLinkError();
      await this.audit.record(
        { tx, tenantId, userId: member.id, supportSessionId: null, platformUserId: null, ip: null },
        'user.invite_accepted',
        { type: 'user', id: member.id },
      );
    });
  }

  /** Runs `write`, turning a lost race into its answer (M5). */
  private async racing<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      throw raceAnswer(error) ?? error;
    }
  }

  /**
   * Issues each member's new link and records its nonce (only that link works now), and reads the
   * sender and the inviter's name ("{inviter} invited you"), all before the commit.
   */
  private async sendingIn(
    tx: TenantTx,
    actor: AuditActor,
    userIds: readonly string[],
    at: Date,
  ): Promise<Sending> {
    const invites: { member: StaffRow; token: string }[] = [];
    for (const userId of userIds) {
      const { token, nonce } = this.links.issueLink(
        { purpose: 'staff_invite', tid: actor.tenantId, sub: userId },
        at,
      );
      await this.repository.setInviteSent(tx, userId, { at, nonce });
      const member = await this.repository.member(tx, userId);
      if (member === null) throw new InvariantError('The invited membership is not visible.');
      invites.push({ member, token });
    }
    const school = await this.users.schoolSenderIn(tx);
    const inviter =
      actor.userId === null ? null : (await this.repository.member(tx, actor.userId))?.name;
    return { invites, school, inviter: inviter ?? school.name };
  }

  /** Queues each invitation email from the school (after the commit). */
  private async send(sending: Sending, at: Date): Promise<void> {
    for (const { member, token } of sending.invites) {
      await this.delivery.queueEmail({
        jobId: `staff-invite.${member.id}.${at.getTime()}`,
        to: emailOf(member),
        template: 'staff_invite',
        school: sending.school,
        params: {
          name: member.name,
          inviter: sending.inviter,
          link: new URL(`/sign-in/invite/${token}`, this.config.PUBLIC_WEB_URL).href,
          days: INVITE_DAYS,
        },
      });
    }
  }

  private async record(
    tx: TenantTx,
    actor: AuditActor,
    action: 'user.invited',
    userId: string,
    meta: Parameters<AuditService['record']>[3],
  ): Promise<void> {
    await this.audit.record({ tx, ...actor }, action, { type: 'user', id: userId }, meta);
  }
}
