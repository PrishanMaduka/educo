import { Inject, Injectable } from '@nestjs/common';
import { eq, inArray, rolePermissions, roleSensitive, roles, sql, userRoles } from '@quad/db';

import { TENANT_DB } from '../../tokens';

import type { PermissionModule, RoleScope, SensitiveKey } from '@quad/contracts';
import type { QuadTenantDb, TenantProfile, TenantTx } from '@quad/db';

/** A role as the permission check needs it. */
export interface AccessRole {
  readonly id: string;
  readonly key: string;
  readonly system: boolean;
  readonly scope: RoleScope;
  readonly primary: boolean;
  /** `updated_at` in epoch microseconds, as text (a JavaScript Date would drop them). */
  readonly updatedAtMicros: string;
}

/** What every request in a school reads afresh: the school's profile and the roles in play. */
export interface AccessStamp {
  readonly profile: TenantProfile | null;
  /** The membership's own roles. */
  readonly roles: readonly AccessRole[];
  /** The role being previewed, when one is on and still visible. */
  readonly preview: AccessRole | null;
}

/** A custom role's stored matrix (`bit(5)` text per module) and sensitive keys. */
export interface StoredGrant {
  readonly matrix: Partial<Record<PermissionModule, string>>;
  readonly sensitive: SensitiveKey[];
}

const roleColumns = {
  id: roles.id,
  key: roles.key,
  system: roles.system,
  scope: roles.scope,
  updatedAtMicros: sql<string>`(extract(epoch from ${roles.updatedAt}) * 1000000)::bigint::text`,
};

/**
 * The permission check's reads (spec 05), every one inside `withTenant`, so RLS keeps them to
 * the session's school: another school's role id simply is not there.
 */
@Injectable()
export class PermissionsRepository {
  constructor(@Inject(TENANT_DB) private readonly db: QuadTenantDb) {}

  /** The profile, the member's roles and the previewed role, in one transaction. */
  stamp(
    tenantId: string,
    userId: string | null,
    previewRoleId: string | null,
  ): Promise<AccessStamp> {
    return this.db.withTenant(tenantId, async (tx) => ({
      profile: await this.db.definers.currentTenantProfile(tx),
      roles: userId === null ? [] : await this.memberRoles(tx, userId),
      preview: previewRoleId === null ? null : await this.role(tx, previewRoleId),
    }));
  }

  /** The stored matrices and sensitive keys of `roleIds` (custom roles). */
  async grants(tenantId: string, roleIds: readonly string[]): Promise<Map<string, StoredGrant>> {
    const grants = new Map<string, StoredGrant>(
      roleIds.map((id) => [id, { matrix: {}, sensitive: [] }]),
    );
    if (roleIds.length === 0) return grants;
    await this.db.withTenant(tenantId, async (tx) => {
      const rows = await tx
        .select({
          roleId: rolePermissions.roleId,
          module: rolePermissions.module,
          actions: rolePermissions.actions,
        })
        .from(rolePermissions)
        .where(inArray(rolePermissions.roleId, [...roleIds]));
      for (const row of rows) {
        const grant = grants.get(row.roleId);
        if (grant) grant.matrix[row.module] = row.actions;
      }
      const keys = await tx
        .select({ roleId: roleSensitive.roleId, key: roleSensitive.key })
        .from(roleSensitive)
        .where(inArray(roleSensitive.roleId, [...roleIds]));
      for (const row of keys) grants.get(row.roleId)?.sensitive.push(row.key);
    });
    return grants;
  }

  private memberRoles(tx: TenantTx, userId: string): Promise<AccessRole[]> {
    return tx
      .select({ ...roleColumns, primary: userRoles.primary })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(eq(userRoles.userId, userId));
  }

  private async role(tx: TenantTx, roleId: string): Promise<AccessRole | null> {
    const [row] = await tx
      .select({ ...roleColumns, primary: sql<boolean>`false` })
      .from(roles)
      .where(eq(roles.id, roleId))
      .limit(1);
    return row ?? null;
  }
}
