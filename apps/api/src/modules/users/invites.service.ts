import { Inject, Injectable } from '@nestjs/common';
import {
  MIN_PASSWORD_LENGTH,
  SIGNED_LINK_RULES,
  canGrant,
  maskEmail,
  nameFromEmail,
  sensitiveKeysOf,
  signedLinkIssuedAt,
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
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../common/errors';
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
  SignedLinkPayload,
  StaffInviteInput,
  StaffInviteResult,
} from '@quad/contracts';
import type { QuadTenantDb, TenantTx } from '@quad/db';

/** The invite link's lifetime in days, for the email (OQ7: 7 days). */
const INVITE_DAYS = (SIGNED_LINK_RULES.staff_invite.ttlSeconds ?? 0) / (24 * 60 * 60);

/** What sending invitations needs after the commit. */
interface Sending {
  readonly members: readonly StaffRow[];
  readonly school: SchoolSender;
  readonly inviter: string;
}

/** The invited membership a verified link names, and its school. */
interface Invitation {
  readonly tenantId: string;
  readonly member: StaffRow;
  readonly school: string;
  readonly passwordMinLength: number;
}

/** The person signed in on the request accepting an invitation (`InvitesController`). */
export interface SignedInAccount {
  readonly accountId: string;
}

/**
 * Staff invitations (spec 05 Account edge cases; spec 06 Invites; OQ7, OQ9). Sending adds an
 * invited membership per address, through `ensure_account_for_email`, so an existing account gets
 * a membership and never a second account. The link is a signed `staff_invite` (7 days, single
 * use) naming the membership; Resend moves `invite_sent_at`, which retires older links. Accepting
 * is tenant-less (D16): the school comes only from the verified link. A new account chooses its
 * password there and is signed in (OQ9); an existing account must already be signed in as itself.
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
    const sending = await this.db.withTenant(actor.tenantId, async (tx) => {
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
      const existing = await this.repository.membersByAccount(tx, accountIds);
      const clashes = accountIds.flatMap((id, index) => (existing.has(id) ? [index] : []));
      if (clashes.length > 0) {
        const message = formatMessage('error.users.alreadyMember');
        throw new BusinessRuleError(
          'already_member',
          message,
          Object.fromEntries(clashes.map((index) => [`emails.${index}`, message])),
        );
      }
      const members: StaffRow[] = [];
      for (const [index, email] of input.emails.entries()) {
        const accountId = accountIds[index];
        if (accountId === undefined) throw new Error('An address has no account.');
        const id = await this.repository.insertInvited(tx, actor.tenantId, {
          accountId,
          name: nameFromEmail(email),
          email,
          roleId: role.role.id,
          at,
        });
        await this.record(tx, actor, id, { roleId: role.role.id, resent: false });
        members.push(await this.memberIn(tx, id));
      }
      return this.sendingIn(tx, actor, members);
    });
    await this.send(actor.tenantId, sending, at);
    return { items: sending.members.map((member) => toStaffMember(member, false)) };
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
      await this.repository.setInviteSent(tx, userId, at);
      await this.record(tx, actor, userId, { resent: true });
      return this.sendingIn(tx, actor, [member]);
    });
    await this.send(actor.tenantId, sending, at);
  }

  /** `GET /auth/invites/:token`: what the invite page shows; any bad link is `invalid_link`. */
  async details(token: string): Promise<InviteDetails> {
    const payload = this.links.inspectLink(token, 'staff_invite', new Date(this.now()));
    const invitation = await this.invitation(payload);
    const { passwordHash } = await this.authRepository.credentials(invitation.member.accountId);
    return {
      school: invitation.school,
      name: invitation.member.name,
      emailMasked: maskEmail(invitation.member.email ?? ''),
      needsPassword: passwordHash === null,
    };
  }

  /**
   * `POST /auth/invites/:token/accept`. The link is checked first without using it up, then the
   * person (a new account's password, or an existing account's session), and only then is the
   * link used up, so a refused attempt never burns it.
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
    const { passwordHash } = await this.authRepository.credentials(accountId);
    if (passwordHash !== null) {
      // An existing account accepts while signed in as itself (spec 05), never by the link alone.
      if (signedIn === null) throw new UnauthorizedError(formatMessage('error.invite.signInFirst'));
      if (signedIn.accountId !== accountId) {
        throw new ForbiddenError('forbidden', formatMessage('error.invite.otherAccount'));
      }
      await this.links.verifyLink(token, 'staff_invite', now);
      await this.activate(invitation, (tx) =>
        this.repository.activateInvited(tx, invitation.member.id, accountId),
      );
      return { next: 'choose_school' };
    }
    if (input.password === undefined) {
      throw new ValidationError({ password: formatMessage('error.invite.choosePassword') });
    }
    await assertNewPassword(input.password, invitation.passwordMinLength, this.breachCheck);
    await this.links.verifyLink(token, 'staff_invite', now);
    const hash = await this.hasher.hash(input.password);
    await this.activate(invitation, async (tx) => {
      // A disabled account keeps its old state; the answer is the same as for any bad link.
      if (!(await this.authRepository.setPasswordIn(tx, accountId, hash, now))) return false;
      return this.repository.activateInvited(tx, invitation.member.id, accountId);
    });
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
   * still invited, and a link signed no earlier than the latest invitation (Resend). Anything
   * else is `invalid_link`, which never names the school.
   */
  private async invitation(payload: SignedLinkPayload): Promise<Invitation> {
    const tenantId = payload.tid;
    if (tenantId === null) throw new InvalidLinkError();
    const issuedAt = signedLinkIssuedAt(payload);
    return this.db.withTenant(tenantId, async (tx) => {
      const member = await this.repository.member(tx, payload.sub);
      if (member === null || member.status !== 'invited') throw new InvalidLinkError();
      const sentAt =
        member.inviteSentAt === null ? null : Math.floor(member.inviteSentAt.getTime() / 1000);
      if (issuedAt === null || (sentAt !== null && issuedAt < sentAt)) throw new InvalidLinkError();
      const profile = await this.db.definers.currentTenantProfile(tx);
      if (profile === null || profile.status === 'deleted') throw new InvalidLinkError();
      const rules = await this.db.definers.authSignInRules(member.accountId);
      const passwordMinLength = Math.max(
        MIN_PASSWORD_LENGTH,
        profile.passwordMinLength,
        ...rules.map((rule) => rule.passwordMinLength),
      );
      return { tenantId, member, school: profile.name, passwordMinLength };
    });
  }

  /** Runs the acceptance under the account and the link's school; a lost race is `invalid_link`. */
  private async activate(
    invitation: Invitation,
    change: (tx: TenantTx) => Promise<boolean>,
  ): Promise<void> {
    const done = await this.authRepository.inAccount(
      invitation.member.accountId,
      invitation.tenantId,
      change,
    );
    if (!done) throw new InvalidLinkError();
  }

  private async memberIn(tx: TenantTx, userId: string): Promise<StaffRow> {
    const member = await this.repository.member(tx, userId);
    if (member === null) throw new Error('The invited membership is not visible.');
    return member;
  }

  /** The sender and the inviter's name ("{inviter} invited you"), read before the commit. */
  private async sendingIn(
    tx: TenantTx,
    actor: AuditActor,
    members: readonly StaffRow[],
  ): Promise<Sending> {
    const school = await this.users.schoolSenderIn(tx);
    const inviter =
      actor.userId === null ? null : (await this.repository.member(tx, actor.userId))?.name;
    return { members, school, inviter: inviter ?? school.name };
  }

  /** Signs each member's link and queues the email from the school (after the commit). */
  private async send(tenantId: string, sending: Sending, at: Date): Promise<void> {
    for (const member of sending.members) {
      const token = this.links.signLink(
        { purpose: 'staff_invite', tid: tenantId, sub: member.id },
        at,
      );
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
    userId: string,
    meta: Parameters<AuditService['record']>[3],
  ): Promise<void> {
    await this.audit.record({ tx, ...actor }, 'user.invited', { type: 'user', id: userId }, meta);
  }
}
