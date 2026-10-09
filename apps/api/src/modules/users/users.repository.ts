import { Injectable } from '@nestjs/common';
import {
  and,
  asc,
  eq,
  exists,
  ilike,
  inArray,
  isNull,
  or,
  roles,
  schoolSettings,
  sql,
  userRoles,
  users,
} from '@quad/db';

import type { MembershipStatus, StaffListQuery, SystemRoleKey } from '@quad/contracts';
import type { TenantTx } from '@quad/db';

/** The school's system admin role key (spec 05). */
export const ADMIN_ROLE_KEY: SystemRoleKey = 'admin';

/** A member of staff as the list and the row actions need them. */
export interface StaffRow {
  readonly id: string;
  readonly accountId: string;
  readonly name: string;
  readonly email: string | null;
  readonly status: MembershipStatus;
  readonly lastSignInAt: Date | null;
  readonly inviteSentAt: Date | null;
  readonly roleId: string | null;
  readonly roleName: string | null;
}

/** Where a page of `GET /users` starts: after this name and id. */
export interface StaffKeyset {
  readonly name: string;
  readonly id: string;
}

/** A new invited membership (`POST /users/invite`). */
export interface InvitedMember {
  readonly accountId: string;
  readonly name: string;
  readonly email: string;
  readonly roleId: string;
  readonly at: Date;
}

/** The SQL `LIKE` pattern that finds `text` anywhere, with its wildcards matched literally. */
function containing(text: string): string {
  return `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

const staffColumns = {
  id: users.id,
  accountId: users.accountId,
  name: users.name,
  email: users.email,
  status: users.status,
  lastSignInAt: users.lastSignInAt,
  inviteSentAt: users.inviteSentAt,
  roleId: roles.id,
  roleName: roles.name,
};

/** A live staff membership (not a guardian or relative, not deleted). */
const isStaff = and(eq(users.kind, 'staff'), isNull(users.deletedAt));

/** The school's system admin role (spec 05: system roles have fixed keys). */
const isAdminRole = and(eq(roles.key, ADMIN_ROLE_KEY), eq(roles.system, true));

/**
 * Users & roles → Staff accounts (spec 08). Every method takes the caller's `withTenant`
 * transaction, so RLS keeps it to the session's school: another school's member or role is
 * simply not there.
 */
@Injectable()
export class UsersRepository {
  /** A page of staff, ordered by name then id, one extra row telling the caller there is more. */
  list(tx: TenantTx, query: StaffListQuery, after: StaffKeyset | null): Promise<StaffRow[]> {
    return this.selectStaff(tx)
      .where(
        and(
          isStaff,
          query.status === undefined ? undefined : eq(users.status, query.status),
          query.roleId === undefined
            ? undefined
            : exists(
                tx
                  .select({ one: sql`1` })
                  .from(userRoles)
                  .where(and(eq(userRoles.userId, users.id), eq(userRoles.roleId, query.roleId))),
              ),
          query.q === undefined
            ? undefined
            : or(ilike(users.name, containing(query.q)), ilike(users.email, containing(query.q))),
          after === null
            ? undefined
            : sql`(${users.name}, ${users.id}) > (${after.name}, ${after.id}::uuid)`,
        ),
      )
      .orderBy(asc(users.name), asc(users.id))
      .limit(query.limit + 1);
  }

  /** The members counted in the story summary: active and invited staff. */
  async summaryMembers(
    tx: TenantTx,
  ): Promise<{ readonly id: string; readonly status: MembershipStatus }[]> {
    return tx
      .select({ id: users.id, status: users.status })
      .from(users)
      .where(and(isStaff, inArray(users.status, ['active', 'invited'])));
  }

  /** One member of staff, or null (another school's id, a guardian, a deleted one). */
  async member(tx: TenantTx, userId: string): Promise<StaffRow | null> {
    const [row] = await this.selectStaff(tx)
      .where(and(isStaff, eq(users.id, userId)))
      .limit(1);
    return row ?? null;
  }

  /** Every role the member holds, as deciding its grant needs them. */
  rolesOf(
    tx: TenantTx,
    userId: string,
  ): Promise<{ readonly id: string; readonly key: string; readonly system: boolean }[]> {
    return tx
      .select({ id: roles.id, key: roles.key, system: roles.system })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(eq(userRoles.userId, userId))
      .orderBy(asc(roles.id));
  }

  /**
   * Makes an invited staff membership of `accountId` active (accepting the invitation); false
   * when it is no longer invited or is not that account's.
   */
  async activateInvited(tx: TenantTx, userId: string, accountId: string): Promise<boolean> {
    const rows = await tx
      .update(users)
      .set({ status: 'active' })
      .where(
        and(
          isStaff,
          eq(users.id, userId),
          eq(users.accountId, accountId),
          eq(users.status, 'invited'),
        ),
      )
      .returning({ id: users.id });
    return rows.length > 0;
  }

  /** Which of `accountIds` already have a membership here (any kind or status). */
  async membersByAccount(tx: TenantTx, accountIds: readonly string[]): Promise<Set<string>> {
    if (accountIds.length === 0) return new Set();
    const rows = await tx
      .select({ accountId: users.accountId })
      .from(users)
      .where(inArray(users.accountId, [...accountIds]));
    return new Set(rows.map((row) => row.accountId));
  }

  /** Adds an invited staff membership holding `roleId` as its primary role; returns its id. */
  async insertInvited(tx: TenantTx, tenantId: string, member: InvitedMember): Promise<string> {
    const [row] = await tx
      .insert(users)
      .values({
        tenantId,
        accountId: member.accountId,
        kind: 'staff',
        name: member.name,
        email: member.email,
        status: 'invited',
        inviteSentAt: member.at,
      })
      .returning({ id: users.id });
    if (row === undefined) throw new Error('The membership row was not written.');
    await tx
      .insert(userRoles)
      .values({ tenantId, userId: row.id, roleId: member.roleId, primary: true });
    return row.id;
  }

  /** Replaces the member's roles with `roleId` as the only, primary one. */
  async setRole(tx: TenantTx, tenantId: string, userId: string, roleId: string): Promise<void> {
    await tx.delete(userRoles).where(eq(userRoles.userId, userId));
    await tx.insert(userRoles).values({ tenantId, userId, roleId, primary: true });
  }

  async setStatus(tx: TenantTx, userId: string, status: MembershipStatus): Promise<void> {
    await tx.update(users).set({ status }).where(eq(users.id, userId));
  }

  async setInviteSent(tx: TenantTx, userId: string, at: Date): Promise<void> {
    await tx.update(users).set({ inviteSentAt: at }).where(eq(users.id, userId));
  }

  /**
   * Locks the school's system admin role row (`FOR UPDATE`) until the transaction ends: every
   * change that could leave the school without an active admin takes it first, so two such
   * changes run one after the other and the second counts what the first committed.
   */
  async lockAdminRole(tx: TenantTx): Promise<string | null> {
    const [row] = await tx.select({ id: roles.id }).from(roles).where(isAdminRole).for('update');
    return row?.id ?? null;
  }

  /** The active staff members holding the system admin role, read after `lockAdminRole`. */
  async activeAdminIds(tx: TenantTx): Promise<string[]> {
    const rows = await tx
      .selectDistinct({ id: users.id })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(and(isStaff, eq(users.status, 'active'), isAdminRole));
    return rows.map((row) => row.id);
  }

  /** The school's Reply-To for school mail (its office email), if it has one. */
  async officeEmail(tx: TenantTx): Promise<string | null> {
    const [row] = await tx
      .select({ officeEmail: schoolSettings.officeEmail })
      .from(schoolSettings)
      .limit(1);
    return row?.officeEmail ?? null;
  }

  /** The staff columns with the primary role joined (a member without one has nulls). */
  private selectStaff(tx: TenantTx) {
    return tx
      .select(staffColumns)
      .from(users)
      .leftJoin(userRoles, and(eq(userRoles.userId, users.id), eq(userRoles.primary, true)))
      .leftJoin(roles, eq(roles.id, userRoles.roleId))
      .$dynamic();
  }
}
