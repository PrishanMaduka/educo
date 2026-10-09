import { randomBytes } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { PermissionModule, SensitiveKey } from '@quad/contracts';
import {
  NO_ACCESS,
  bitsOf,
  canGrant,
  effectivePermissions,
  modulesOutsidePlan,
  normaliseRow,
  pageAccess,
  planMatrix,
  roleHome,
  sensitiveKeysOf,
} from '@quad/domain';

import { PermissionsService, planModulesOf } from '../../common/access/permissions.service';
import { AuditService, auditActorOf } from '../../common/audit/audit.service';
import { formatMessage } from '../../common/delivery/templates/render';
import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../common/errors';
import { FOREIGN_KEY_VIOLATION, postgresCodeOf } from '../../common/pg-error';
import { schoolOf } from '../../common/session/request-auth';
import { TENANT_DB } from '../../tokens';

import { RolesRepository } from './roles.repository';

import type { RoleRow, StoredRoleGrant } from './roles.repository';
import type { RequestAccess } from '../../common/access/permissions.service';
import type { AuditActor } from '../../common/audit/audit.service';
import type { RequestAuth } from '../../common/session/request-auth';
import type {
  PlanModule,
  Role,
  RoleCreateInput,
  RoleList,
  RoleMatrix,
  RolePermissionsInput,
  RoleUpdateInput,
} from '@quad/contracts';
import type { QuadTenantDb, TenantTx } from '@quad/db';
import type { PermissionMatrix, RoleGrant } from '@quad/domain';

/** What a role grant stores: the `bit(5)` text of each granted row, and the keys. */
function storedOf(matrix: PermissionMatrix, sensitive: readonly SensitiveKey[]): StoredRoleGrant {
  const bits: Partial<Record<PermissionModule, string>> = {};
  for (const module of PermissionModule.options) {
    const row = matrix[module];
    if (row !== undefined) bits[module] = bitsOf(row);
  }
  return { matrix: bits, sensitive: SensitiveKey.options.filter((key) => sensitive.includes(key)) };
}

/** A whole matrix for the response: every module, each row normalised. */
function fullMatrixOf(grant: RoleGrant): RoleMatrix {
  const row = (module: PermissionModule) => ({
    ...normaliseRow(grant.matrix[module] ?? NO_ACCESS),
  });
  return {
    admissions: row('admissions'),
    crm: row('crm'),
    sis: row('sis'),
    attendance: row('attendance'),
    lms: row('lms'),
    fees: row('fees'),
    finance: row('finance'),
    transport: row('transport'),
    settings: row('settings'),
  };
}

/** A change to a role is refused for a system role: their permissions are fixed (spec 05). */
function refuseSystem(role: RoleRow): void {
  if (role.system) {
    throw new BusinessRuleError('system_role_locked', formatMessage('error.roles.systemLocked'));
  }
}

/**
 * Nobody changes a role they hold themselves (fix round 1, M6): they could widen their own access
 * past what anyone gave them, or lock themselves out. Another member with `users.manage` does it.
 */
async function refuseOwnRole(
  repository: RolesRepository,
  tx: TenantTx,
  actor: AuditActor,
  roleId: string,
): Promise<void> {
  if (actor.userId !== null && (await repository.holds(tx, actor.userId, roleId))) {
    throw new BusinessRuleError('own_role_locked', formatMessage('error.roles.ownLocked'));
  }
}

/** The 422 when a grant names modules outside the school's plan, each named on its row. */
function refuseOutsidePlan(outsidePlan: readonly PermissionModule[]): void {
  if (outsidePlan.length === 0) return;
  throw new BusinessRuleError(
    'module_not_in_plan',
    formatMessage('error.moduleNotInPlan'),
    Object.fromEntries(
      outsidePlan.map((module) => [`matrix.${module}`, formatMessage('error.moduleNotInPlan')]),
    ),
  );
}

/** The 403 when a role would give a sensitive key the granter does not hold (spec 08). */
function refuseUnheldKeys(): never {
  throw new ForbiddenError('forbidden', formatMessage('error.users.sensitiveNotHeld'));
}

/**
 * Users & roles → Roles & permissions (spec 05 Roles; spec 06; spec 08). Every write runs in
 * one `withTenant` transaction with its audit entry, moves `roles.updated_at` (the 0015 triggers)
 * and then drops the school's cached matrices (`invalidateTenant`), so a member sees the change
 * on their next request. A school admin never gives a sensitive key they do not hold (`canGrant`
 * against the keys stored now).
 */
@Injectable()
export class RolesService {
  constructor(
    @Inject(TENANT_DB) private readonly db: QuadTenantDb,
    private readonly repository: RolesRepository,
    private readonly permissions: PermissionsService,
    private readonly audit: AuditService,
  ) {}

  /** `GET /roles`: every role, with members, pages, home and matrix (the Preview card). */
  list(auth: RequestAuth): Promise<RoleList> {
    const { tenantId } = schoolOf(auth);
    return this.db.withTenant(tenantId, async (tx) => {
      const planModules = await this.planModulesIn(tx);
      const rows = await this.repository.list(tx);
      const counts = await this.repository.memberCounts(tx);
      const grants = await this.permissions.roleGrantsIn(tx, rows);
      const items = rows.map((row) =>
        this.toRole(row, grants.get(row.id), counts.get(row.id) ?? 0, planModules),
      );
      return { items, nextCursor: null, outsidePlan: modulesOutsidePlan(planModules) };
    });
  }

  /** The role with its counts, read in the caller's transaction (a member of this module). */
  async roleIn(tx: TenantTx, roleId: string): Promise<Role> {
    const row = await this.repository.byId(tx, roleId);
    if (row === null) throw new NotFoundError();
    const grants = await this.permissions.roleGrantsIn(tx, [row]);
    const counts = await this.repository.memberCounts(tx);
    const planModules = await this.planModulesIn(tx);
    return this.toRole(row, grants.get(row.id), counts.get(row.id) ?? 0, planModules);
  }

  /** A role of the school with its grant, or null (another school's id is not there). */
  async grantIn(
    tx: TenantTx,
    roleId: string,
  ): Promise<{ readonly role: RoleRow; readonly grant: RoleGrant } | null> {
    const role = await this.repository.byId(tx, roleId);
    if (role === null) return null;
    const grant = (await this.permissions.roleGrantsIn(tx, [role])).get(role.id);
    return { role, grant: grant ?? { matrix: {}, sensitive: [] } };
  }

  /**
   * `POST /roles`: a custom role copying its base role's matrix (in the plan) and keys, or, with
   * `permissions`, created with that grant: checked as `PUT …/permissions` checks it (422 outside
   * the plan, 403 for keys the granter lacks) in the same transaction, so a refusal creates nothing.
   */
  async create(
    auth: RequestAuth,
    access: RequestAccess,
    input: RoleCreateInput,
    ip: string,
  ): Promise<Role> {
    const actor = auditActorOf(schoolOf(auth), ip);
    const role = await this.db.withTenant(actor.tenantId, async (tx) => {
      const base = input.baseRoleKey === null ? null : await this.baseGrant(tx, input.baseRoleKey);
      const planModules = await this.planModulesIn(tx);
      const sent = input.permissions;
      let grant: StoredRoleGrant;
      if (sent === undefined) {
        grant = storedOf(
          planMatrix(base?.matrix ?? {}, planModules).granted,
          base?.sensitive ?? [],
        );
      } else {
        const { granted, outsidePlan } = planMatrix(sent.matrix, planModules);
        refuseOutsidePlan(outsidePlan);
        grant = storedOf(granted, sent.sensitive);
      }
      // A new role holds nothing yet, so every key in the final grant is one being given.
      if (!canGrant(sensitiveKeysOf(access.permissions), [], grant.sensitive)) {
        refuseUnheldKeys();
      }
      const id = await this.repository.insert(tx, actor.tenantId, {
        key: `custom_${randomBytes(6).toString('hex')}`,
        name: input.name,
        description: input.description ?? null,
        color: input.color,
        scope: input.scope,
        baseRoleKey: input.baseRoleKey,
      });
      await this.repository.replaceGrant(tx, actor.tenantId, id, grant);
      // The entry says what the new role can do, as role.permissions_changed does.
      await this.record(tx, actor, 'role.created', id, {
        baseRoleKey: input.baseRoleKey,
        matrix: grant.matrix,
        sensitive: [...grant.sensitive],
      });
      return this.roleIn(tx, id);
    });
    await this.permissions.invalidateTenant(actor.tenantId);
    return role;
  }

  /** `PATCH /roles/:id`: a custom role's name, description, colour or scope. */
  async update(
    auth: RequestAuth,
    roleId: string,
    input: RoleUpdateInput,
    ip: string,
  ): Promise<Role> {
    const actor = auditActorOf(schoolOf(auth), ip);
    const role = await this.db.withTenant(actor.tenantId, async (tx) => {
      const current = await this.repository.lockById(tx, roleId);
      if (current === null) throw new NotFoundError();
      refuseSystem(current);
      await refuseOwnRole(this.repository, tx, actor, roleId);
      await this.repository.update(tx, roleId, input);
      await this.record(tx, actor, 'role.updated', roleId, { fields: Object.keys(input).sort() });
      return this.roleIn(tx, roleId);
    });
    await this.permissions.invalidateTenant(actor.tenantId);
    return role;
  }

  /** `DELETE /roles/:id`: 409 `in_use` while anyone holds or previews it. */
  async delete(auth: RequestAuth, roleId: string, ip: string): Promise<void> {
    const actor = auditActorOf(schoolOf(auth), ip);
    try {
      await this.db.withTenant(actor.tenantId, async (tx) => {
        const current = await this.repository.lockById(tx, roleId);
        if (current === null) throw new NotFoundError();
        refuseSystem(current);
        if (((await this.repository.memberCounts(tx)).get(roleId) ?? 0) > 0) {
          throw new ConflictError('in_use', formatMessage('error.roles.inUse'));
        }
        await this.repository.delete(tx, roleId);
        await this.record(tx, actor, 'role.deleted', roleId, { name: current.name });
      });
    } catch (error) {
      // A session still previewing the role holds it (sessions_preview_role_fk, NO ACTION).
      if (postgresCodeOf(error) === FOREIGN_KEY_VIOLATION) {
        throw new ConflictError('in_use', formatMessage('error.roles.inUse'));
      }
      throw error;
    }
    await this.permissions.invalidateTenant(actor.tenantId);
  }

  /**
   * `PUT /roles/:id/permissions`: the whole matrix, normalised, only for modules in the plan (422
   * `module_not_in_plan`), and keys the granter holds when they are new (403).
   */
  async setPermissions(
    auth: RequestAuth,
    access: RequestAccess,
    roleId: string,
    input: RolePermissionsInput,
    ip: string,
  ): Promise<Role> {
    const actor = auditActorOf(schoolOf(auth), ip);
    const role = await this.db.withTenant(actor.tenantId, async (tx) => {
      const current = await this.repository.lockById(tx, roleId);
      if (current === null) throw new NotFoundError();
      refuseSystem(current);
      await refuseOwnRole(this.repository, tx, actor, roleId);
      const { granted, outsidePlan } = planMatrix(input.matrix, await this.planModulesIn(tx));
      refuseOutsidePlan(outsidePlan);
      // `current` comes from the database, never from the request (Task 11 ruling).
      const stored = (await this.permissions.roleGrantsIn(tx, [current])).get(roleId);
      if (
        !canGrant(sensitiveKeysOf(access.permissions), stored?.sensitive ?? [], input.sensitive)
      ) {
        refuseUnheldKeys();
      }
      const next = storedOf(granted, input.sensitive);
      await this.repository.replaceGrant(tx, actor.tenantId, roleId, next);
      await this.record(tx, actor, 'role.permissions_changed', roleId, {
        matrix: next.matrix,
        sensitive: [...next.sensitive],
      });
      return this.roleIn(tx, roleId);
    });
    await this.permissions.invalidateTenant(actor.tenantId);
    return role;
  }

  /** The base role's grant by key; a key this school does not have is a 400 on `baseRoleKey`. */
  private async baseGrant(tx: TenantTx, key: string): Promise<RoleGrant> {
    const base = await this.repository.byKey(tx, key);
    if (base === null) {
      throw new ValidationError({ baseRoleKey: formatMessage('error.roles.baseNotFound') });
    }
    return (
      (await this.permissions.roleGrantsIn(tx, [base])).get(base.id) ?? {
        matrix: {},
        sensitive: [],
      }
    );
  }

  private async planModulesIn(tx: TenantTx): Promise<PlanModule[]> {
    const profile = await this.db.definers.currentTenantProfile(tx);
    return planModulesOf(profile?.modules ?? []);
  }

  private async record(
    tx: TenantTx,
    actor: AuditActor,
    action: 'role.created' | 'role.updated' | 'role.deleted' | 'role.permissions_changed',
    roleId: string,
    meta: Parameters<AuditService['record']>[3],
  ): Promise<void> {
    await this.audit.record({ tx, ...actor }, action, { type: 'role', id: roleId }, meta);
  }

  private toRole(
    row: RoleRow,
    grant: RoleGrant | undefined,
    memberCount: number,
    planModules: readonly PlanModule[],
  ): Role {
    const roleGrant = grant ?? { matrix: {}, sensitive: [] };
    const perms = effectivePermissions({ roles: [roleGrant], planModules });
    return {
      ...row,
      memberCount,
      pageCount: pageAccess(perms, planModules).filter((page) => page.access !== 'hidden').length,
      home: roleHome(perms, row.scope, planModules),
      matrix: fullMatrixOf(roleGrant),
      sensitive: SensitiveKey.options.filter((key) => roleGrant.sensitive.includes(key)),
    };
  }
}
