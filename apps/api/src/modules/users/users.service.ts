import { Inject, Injectable } from '@nestjs/common';
import { IdSchema } from '@quad/contracts';
import {
  canGrant,
  sensitiveKeysOf,
  staffActionRefusal,
  staffChangeRefusal,
  statusAfterChange,
} from '@quad/domain';
import { z } from 'zod';

import { PermissionsService } from '../../common/access/permissions.service';
import { AuditService, auditActorOf } from '../../common/audit/audit.service';
import { SignedLinks } from '../../common/crypto/signed-links';
import { formatMessage } from '../../common/delivery/templates/render';
import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../common/errors';
import { decodeCursor, pageOf } from '../../common/pagination/cursor';
import { FOREIGN_KEY_VIOLATION, postgresCodeOf } from '../../common/pg-error';
import { schoolOf } from '../../common/session/request-auth';
import { SessionService } from '../../common/session/session.service';
import { CLOCK, CONFIG, DELIVERY, TENANT_DB } from '../../tokens';
import { RESET_LINK_MINUTES } from '../auth/jobs/password-reset-request.processor';
import { RolesService } from '../roles/roles.service';

import { toStaffMember } from './users.mapper';
import { ADMIN_ROLE_KEY, UsersRepository } from './users.repository';

import type { StaffRow } from './users.repository';
import type { RequestAccess } from '../../common/access/permissions.service';
import type { AuditActor } from '../../common/audit/audit.service';
import type { DeliveryQueue } from '../../common/delivery/delivery.service';
import type { SchoolSender } from '../../common/delivery/email';
import type { RequestAuth } from '../../common/session/request-auth';
import type { Config } from '../../config';
import type { Clock } from '../../tokens';
import type { StaffList, StaffListQuery, StaffMember, StaffUpdateInput } from '@quad/contracts';
import type { QuadTenantDb, TenantTx } from '@quad/db';
import type { StaffActionRefusal, StaffChangeRefusal } from '@quad/domain';

/** Where Remind sends a member to turn on two-step sign-in (the staff portal's own page). */
export const TWO_STEP_PAGE = '/app/me/two-step';

const StaffKeyset = z.object({ name: z.string(), id: IdSchema });

const isAdmin = (role: { readonly key: string; readonly system: boolean }) =>
  role.system && role.key === ADMIN_ROLE_KEY;

function refuseChange(refusal: StaffChangeRefusal): never {
  switch (refusal) {
    case 'self':
      throw new BusinessRuleError('business_rule', formatMessage('error.users.notYourself'));
    case 'last_admin':
      throw new BusinessRuleError('last_admin', formatMessage('error.users.lastAdmin'));
    case 'status_not_allowed':
      throw new BusinessRuleError('business_rule', formatMessage('error.users.acceptInviteFirst'));
  }
}

/** Remind's 409, and 422 for an action that does not apply to the member. */
export function refuseAction(refusal: StaffActionRefusal): never {
  switch (refusal) {
    case 'two_step_on':
      throw new ConflictError('conflict', formatMessage('error.users.twoStepOn'));
    case 'not_active':
      throw new BusinessRuleError('business_rule', formatMessage('error.users.notActive'));
    case 'not_invited':
      throw new BusinessRuleError('business_rule', formatMessage('error.users.notInvited'));
  }
}

/** A member's address, or 422 when the school has none to write to. */
export function emailOf(member: StaffRow): string {
  if (member.email === null) {
    throw new BusinessRuleError('business_rule', formatMessage('error.users.noEmail'));
  }
  return member.email;
}

/**
 * Users & roles → Staff accounts (spec 05, 06, 08). Every change runs in one `withTenant`
 * transaction with its audit entry. Cross-account work goes through the tenant-scoped definers
 * (`member_two_step_status`, `revoke_member_sessions`, `clear_member_preview`), never another
 * person's account rows; the session cache and the school's permission cache are dropped after
 * the commit, so the change is seen on the member's next request. Email is queued after the
 * commit.
 */
@Injectable()
export class UsersService {
  constructor(
    @Inject(TENANT_DB) private readonly db: QuadTenantDb,
    private readonly repository: UsersRepository,
    private readonly roles: RolesService,
    private readonly permissions: PermissionsService,
    private readonly sessions: SessionService,
    private readonly links: SignedLinks,
    private readonly audit: AuditService,
    @Inject(DELIVERY) private readonly delivery: DeliveryQueue,
    @Inject(CONFIG) private readonly config: Config,
    @Inject(CLOCK) private readonly now: Clock,
  ) {}

  /** `GET /users`: a page of staff and the school's story summary. */
  list(auth: RequestAuth, query: StaffListQuery): Promise<StaffList> {
    const { tenantId, userId } = schoolOf(auth);
    const after = decodeCursor(StaffKeyset, query.cursor);
    return this.db.withTenant(tenantId, async (tx) => {
      const page = pageOf(await this.repository.list(tx, query, after), query.limit, (last) => ({
        name: last.name,
        id: last.id,
      }));
      const counted = await this.repository.summaryMembers(tx);
      const active = counted.filter((member) => member.status === 'active').map((m) => m.id);
      const twoStep = await this.twoStepOf(tx, [...page.items.map((row) => row.id), ...active]);
      return {
        items: page.items.map((row) => toStaffMember(row, twoStep.get(row.id) === true, userId)),
        nextCursor: page.nextCursor,
        summary: {
          staff: counted.length,
          withoutTwoStep: active.filter((id) => twoStep.get(id) !== true).length,
        },
      };
    });
  }

  /**
   * `PATCH /users/:id`: a new role or status. Takes the admin role lock first, so two changes
   * that could leave no active admin run one after the other (`lockAdminRole`).
   */
  async update(
    auth: RequestAuth,
    access: RequestAccess,
    userId: string,
    input: StaffUpdateInput,
    ip: string,
  ): Promise<StaffMember> {
    const actor = auditActorOf(schoolOf(auth), ip);
    const result = await this.roleStillThere(() =>
      this.db.withTenant(actor.tenantId, async (tx) => {
        await this.repository.lockAdminRole(tx);
        const target = await this.repository.member(tx, userId);
        if (target === null) throw new NotFoundError();
        const held = await this.repository.rolesOf(tx, userId);
        const next = input.roleId === undefined ? null : await this.roles.grantIn(tx, input.roleId);
        if (input.roleId !== undefined && next === null) throw new NotFoundError();
        const roleChanges = next !== null && !(held.length === 1 && held[0]?.id === next.role.id);
        // A never-accepted invitation goes back to invited, never active (fix round 1, I1).
        const nextStatus =
          input.status === undefined
            ? target.status
            : statusAfterChange({
                current: target.status,
                requested: input.status,
                accepted: target.acceptedAt !== null,
              });
        const otherAdmins = (await this.repository.activeAdminIds(tx)).filter(
          (id) => id !== userId,
        );
        const refusal = staffChangeRefusal({
          actorUserId: actor.userId,
          target: { id: target.id, status: target.status, isAdmin: held.some(isAdmin) },
          nextIsAdmin: next === null || !roleChanges ? held.some(isAdmin) : isAdmin(next.role),
          roleChanges,
          nextStatus,
          otherActiveAdmins: otherAdmins.length,
        });
        if (refusal !== null) refuseChange(refusal);
        if (roleChanges) {
          // Assigning a role gives its sensitive keys: the granter must hold the new ones (D32).
          const current = [...(await this.permissions.roleGrantsIn(tx, held)).values()];
          const before = current.flatMap((grant) => grant.sensitive);
          if (!canGrant(sensitiveKeysOf(access.permissions), before, next.grant.sensitive)) {
            throw new ForbiddenError('forbidden', formatMessage('error.users.sensitiveNotHeld'));
          }
          await this.repository.setRole(tx, actor.tenantId, userId, next.role.id);
          await this.record(tx, actor, 'user.role_changed', userId, {
            from: held.map((role) => role.id),
            to: next.role.id,
          });
        }
        const statusChanges = nextStatus !== target.status;
        if (statusChanges) {
          await this.repository.setStatus(tx, userId, nextStatus);
          if (nextStatus === 'deactivated') {
            await this.record(tx, actor, 'user.deactivated', userId, {});
          } else {
            await this.record(tx, actor, 'user.reactivated', userId, { status: nextStatus });
          }
        }
        if (roleChanges || nextStatus === 'deactivated') {
          // A role change or a deactivation ends the member's preview here (Task 12 review, I2).
          await this.db.definers.clearMemberPreview(tx, userId);
        }
        if (statusChanges && nextStatus === 'deactivated') {
          // Spec 05: leaving a school revokes that school's sessions and refresh families.
          await this.db.definers.revokeMemberSessions(tx, userId);
        }
        const updated = await this.repository.member(tx, userId);
        if (updated === null) throw new NotFoundError();
        const twoStep = await this.twoStepOf(tx, [userId]);
        return {
          member: toStaffMember(updated, twoStep.get(userId) === true, actor.userId),
          accountId: target.accountId,
          roleChanges,
          statusChanges,
        };
      }),
    );
    if (result.roleChanges) await this.permissions.invalidateTenant(actor.tenantId);
    if (result.roleChanges || result.statusChanges) {
      await this.sessions.invalidateMember(result.accountId, actor.tenantId);
    }
    return result.member;
  }

  /** Runs `write`; the new role deleted meanwhile (a 23503 on `user_roles`) is a 404 (M5). */
  private async roleStillThere<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (postgresCodeOf(error) === FOREIGN_KEY_VIOLATION) throw new NotFoundError();
      throw error;
    }
  }

  /** `POST /users/:id/remind-two-step`: emails the member to turn on two-step sign-in. */
  async remindTwoStep(auth: RequestAuth, userId: string, ip: string): Promise<void> {
    const actor = auditActorOf(schoolOf(auth), ip);
    const { member, school } = await this.db.withTenant(actor.tenantId, async (tx) => {
      const found = await this.repository.member(tx, userId);
      if (found === null) throw new NotFoundError();
      const twoStepOn = (await this.twoStepOf(tx, [userId])).get(userId) === true;
      const refusal = staffActionRefusal('remind_two_step', { status: found.status, twoStepOn });
      if (refusal !== null) refuseAction(refusal);
      emailOf(found);
      await this.record(tx, actor, 'user.two_step_reminded', userId, {});
      return { member: found, school: await this.schoolSenderIn(tx) };
    });
    await this.delivery.queueEmail({
      jobId: `two-step-reminder.${userId}.${this.now()}`,
      to: emailOf(member),
      template: 'two_step_reminder',
      school,
      params: { name: member.name, link: new URL(TWO_STEP_PAGE, this.config.PUBLIC_WEB_URL).href },
    });
  }

  /**
   * `POST /users/:id/reset-password`: emails a single-use `password_reset` link carrying this
   * school (OQ8: an admin-started reset names the school, for the audit).
   */
  async resetPassword(auth: RequestAuth, userId: string, ip: string): Promise<void> {
    const actor = auditActorOf(schoolOf(auth), ip);
    const { member, to } = await this.db.withTenant(actor.tenantId, async (tx) => {
      const found = await this.repository.member(tx, userId);
      if (found === null) throw new NotFoundError();
      const refusal = staffActionRefusal('reset_password', {
        status: found.status,
        twoStepOn: false,
      });
      if (refusal !== null) refuseAction(refusal);
      // The account's own sign-in address, never the school's copy of it (fix round 1, M2).
      const address = await this.db.definers.memberAccountEmail(tx, userId);
      if (address === null) {
        throw new BusinessRuleError('business_rule', formatMessage('error.users.noEmail'));
      }
      await this.record(tx, actor, 'user.password_reset_sent', userId, {});
      return { member: found, to: address };
    });
    const now = this.now();
    const token = this.links.signLink(
      { purpose: 'password_reset', tid: actor.tenantId, sub: member.accountId },
      new Date(now),
    );
    await this.delivery.queueEmail({
      jobId: `password-reset.member.${userId}.${now}`,
      to,
      template: 'password_reset',
      params: {
        name: member.name,
        link: new URL(`/sign-in/reset/${token}`, this.config.PUBLIC_WEB_URL).href,
        minutes: RESET_LINK_MINUTES,
      },
    });
  }

  /**
   * `POST /users/:id/sign-out-everywhere`: ends the member's sessions in this school only
   * (OQ10), web sessions and refresh families alike; their other schools are left alone.
   */
  async signOutEverywhere(auth: RequestAuth, userId: string, ip: string): Promise<void> {
    const actor = auditActorOf(schoolOf(auth), ip);
    const accountId = await this.db.withTenant(actor.tenantId, async (tx) => {
      const found = await this.repository.member(tx, userId);
      if (found === null) throw new NotFoundError();
      await this.db.definers.revokeMemberSessions(tx, userId);
      await this.record(tx, actor, 'user.signed_out_everywhere', userId, {});
      return found.accountId;
    });
    await this.sessions.invalidateMember(accountId, actor.tenantId);
  }

  /**
   * Who sends school mail (D19): the school's name, and its office email as Reply-To. Read in the
   * caller's transaction (the school is `app.tenant_id`).
   */
  async schoolSenderIn(tx: TenantTx): Promise<SchoolSender> {
    const profile = await this.db.definers.currentTenantProfile(tx);
    if (profile === null) throw new NotFoundError();
    return { name: profile.name, replyTo: await this.repository.officeEmail(tx) };
  }

  /** Whether each member has two-step sign-in on (`member_two_step_status`). */
  async twoStepOf(tx: TenantTx, userIds: readonly string[]): Promise<Map<string, boolean>> {
    const rows = await this.db.definers.memberTwoStepStatus(tx, [...new Set(userIds)]);
    return new Map(rows.map((row) => [row.userId, row.totpEnabled]));
  }

  private async record(
    tx: TenantTx,
    actor: AuditActor,
    action:
      | 'user.role_changed'
      | 'user.deactivated'
      | 'user.reactivated'
      | 'user.two_step_reminded'
      | 'user.password_reset_sent'
      | 'user.signed_out_everywhere',
    userId: string,
    meta: Parameters<AuditService['record']>[3],
  ): Promise<void> {
    await this.audit.record({ tx, ...actor }, action, { type: 'user', id: userId }, meta);
  }
}
