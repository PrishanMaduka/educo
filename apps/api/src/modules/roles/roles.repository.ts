import { Injectable } from '@nestjs/common';
import { PermissionModule } from '@quad/contracts';
import {
  and,
  asc,
  count,
  desc,
  eq,
  rolePermissions,
  roleSensitive,
  roles,
  userRoles,
} from '@quad/db';

import type { RoleScope, RoleUpdateInput, SensitiveKey } from '@quad/contracts';
import type { TenantTx } from '@quad/db';

/** A role row as the Roles & permissions page reads it. */
export interface RoleRow {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly description: string | null;
  readonly color: string | null;
  readonly system: boolean;
  readonly scope: RoleScope;
  readonly baseRoleKey: string | null;
}

/** A new custom role (`POST /roles`). */
export interface NewCustomRole {
  readonly key: string;
  readonly name: string;
  readonly description: string | null;
  readonly color: string;
  readonly scope: RoleScope;
  readonly baseRoleKey: string | null;
}

/** A matrix as `bit(5)` text per module, and the sensitive keys: what a role stores. */
export interface StoredRoleGrant {
  readonly matrix: Partial<Record<PermissionModule, string>>;
  readonly sensitive: readonly SensitiveKey[];
}

const roleColumns = {
  id: roles.id,
  key: roles.key,
  name: roles.name,
  description: roles.description,
  color: roles.color,
  system: roles.system,
  scope: roles.scope,
  baseRoleKey: roles.baseRoleKey,
};

/**
 * Users & roles → Roles & permissions (spec 05, 08). Every method takes the caller's
 * `withTenant` transaction, so RLS keeps it to the session's school. Writes to the matrix move
 * `roles.updated_at` through the 0015 triggers (the permission cache key), with no bump here.
 */
@Injectable()
export class RolesRepository {
  /** Every role of the school: system roles first, then by name. */
  list(tx: TenantTx): Promise<RoleRow[]> {
    return tx
      .select(roleColumns)
      .from(roles)
      .orderBy(desc(roles.system), asc(roles.name), asc(roles.id));
  }

  /** How many members hold each role, by role id (roles nobody holds are left out). */
  async memberCounts(tx: TenantTx): Promise<Map<string, number>> {
    const rows = await tx
      .select({ roleId: userRoles.roleId, members: count() })
      .from(userRoles)
      .groupBy(userRoles.roleId);
    return new Map(rows.map((row) => [row.roleId, row.members]));
  }

  /** Whether `userId` holds `roleId`. */
  async holds(tx: TenantTx, userId: string, roleId: string): Promise<boolean> {
    const [row] = await tx
      .select({ roleId: userRoles.roleId })
      .from(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)))
      .limit(1);
    return row !== undefined;
  }

  async byId(tx: TenantTx, roleId: string): Promise<RoleRow | null> {
    const [row] = await tx.select(roleColumns).from(roles).where(eq(roles.id, roleId)).limit(1);
    return row ?? null;
  }

  /** Locks the role row for a change (`FOR UPDATE`), or null when it is not the school's. */
  async lockById(tx: TenantTx, roleId: string): Promise<RoleRow | null> {
    const [row] = await tx
      .select(roleColumns)
      .from(roles)
      .where(eq(roles.id, roleId))
      .limit(1)
      .for('update');
    return row ?? null;
  }

  async byKey(tx: TenantTx, key: string): Promise<RoleRow | null> {
    const [row] = await tx.select(roleColumns).from(roles).where(eq(roles.key, key)).limit(1);
    return row ?? null;
  }

  async insert(tx: TenantTx, tenantId: string, role: NewCustomRole): Promise<string> {
    const [row] = await tx
      .insert(roles)
      .values({ tenantId, ...role, system: false })
      .returning({ id: roles.id });
    if (row === undefined) throw new Error('The role row was not written.');
    return row.id;
  }

  async update(tx: TenantTx, roleId: string, changes: RoleUpdateInput): Promise<void> {
    await tx
      .update(roles)
      .set({
        ...(changes.name === undefined ? {} : { name: changes.name }),
        ...(changes.description === undefined ? {} : { description: changes.description }),
        ...(changes.color === undefined ? {} : { color: changes.color }),
        ...(changes.scope === undefined ? {} : { scope: changes.scope }),
      })
      .where(eq(roles.id, roleId));
  }

  /** Deletes the role; its matrix and keys go with it (cascade). */
  async delete(tx: TenantTx, roleId: string): Promise<void> {
    await tx.delete(roles).where(eq(roles.id, roleId));
  }

  /** Replaces the role's matrix rows and sensitive keys. */
  async replaceGrant(
    tx: TenantTx,
    tenantId: string,
    roleId: string,
    grant: StoredRoleGrant,
  ): Promise<void> {
    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
    await tx.delete(roleSensitive).where(eq(roleSensitive.roleId, roleId));
    const rows = PermissionModule.options.flatMap((module) => {
      const actions = grant.matrix[module];
      return actions === undefined ? [] : [{ tenantId, roleId, module, actions }];
    });
    if (rows.length > 0) await tx.insert(rolePermissions).values(rows);
    if (grant.sensitive.length > 0) {
      await tx
        .insert(roleSensitive)
        .values(grant.sensitive.map((key) => ({ tenantId, roleId, key })));
    }
  }
}
