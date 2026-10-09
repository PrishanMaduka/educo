import { Injectable } from '@nestjs/common';
import { and, eq, isNull, roles, users } from '@quad/db';

import type { MeUpdateInput, RoleScope, ThemeChoice } from '@quad/contracts';
import type { TenantTx } from '@quad/db';

/** What the school knows about the person (their `users` row). */
export interface MemberProfile {
  readonly name: string;
  readonly theme: ThemeChoice;
  readonly locale: string | null;
}

/**
 * The person's own membership and the names the banners show. Every call takes the caller's
 * `withTenant` transaction, so RLS keeps it to the session's school.
 */
@Injectable()
export class MeRepository {
  async member(tx: TenantTx, userId: string): Promise<MemberProfile | null> {
    const [row] = await tx
      .select({ name: users.name, theme: users.theme, locale: users.locale })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row ?? null;
  }

  /** Updates the given fields of the membership; false when it is not visible. */
  async updateMember(tx: TenantTx, userId: string, changes: MeUpdateInput): Promise<boolean> {
    const rows = await tx
      .update(users)
      .set({
        ...(changes.name === undefined ? {} : { name: changes.name }),
        ...(changes.theme === undefined ? {} : { theme: changes.theme }),
        ...(changes.locale === undefined ? {} : { locale: changes.locale }),
      })
      .where(eq(users.id, userId))
      .returning({ id: users.id });
    return rows.length > 0;
  }

  async roleName(tx: TenantTx, roleId: string): Promise<string | null> {
    const [row] = await tx
      .select({ name: roles.name })
      .from(roles)
      .where(eq(roles.id, roleId))
      .limit(1);
    return row?.name ?? null;
  }

  /** A role of the session's school (RLS hides another school's), for a preview. */
  async previewRole(
    tx: TenantTx,
    roleId: string,
  ): Promise<{ readonly id: string; readonly scope: RoleScope } | null> {
    const [row] = await tx
      .select({ id: roles.id, scope: roles.scope })
      .from(roles)
      .where(eq(roles.id, roleId))
      .limit(1);
    return row ?? null;
  }

  /** Whether `userId` is an active staff member of the session's school (a preview's sample). */
  async isActiveStaff(tx: TenantTx, userId: string): Promise<boolean> {
    const [row] = await tx
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.id, userId),
          eq(users.kind, 'staff'),
          eq(users.status, 'active'),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);
    return row !== undefined;
  }
}
