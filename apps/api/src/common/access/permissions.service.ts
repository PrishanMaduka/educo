import { createHash } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import {
  IdSchema,
  PermissionModule,
  PlanModule,
  SensitiveKey,
  SystemRoleKey,
  USERS_MANAGE,
} from '@quad/contracts';
import { effectivePermissions, rowOf, systemRoleMatrix } from '@quad/domain';
import { z } from 'zod';

import { errorForLog } from '../../observability/logger';
import { LOGGER, REDIS } from '../../tokens';
import { UnauthorizedError } from '../errors';
import { requestAuthOf } from '../session/request-auth';

import { PermissionsRepository } from './permissions.repository';

import type { AccessRole, StoredGrant } from './permissions.repository';
import type { RequestAuth } from '../session/request-auth';
import type { PermissionKey, RoleScope, TenantStatus } from '@quad/contracts';
import type { TenantTx } from '@quad/db';
import type { PermissionRow, RoleGrant } from '@quad/domain';
import type { FastifyRequest } from 'fastify';
import type { Redis } from 'ioredis';
import type { Logger } from 'pino';

/** Spec 05 / D32: a role set's matrices are cached in Redis for 30 s. */
export const PERMISSION_CACHE_SECONDS = 30;
/** The per-school index outlives the entries it lists, so an entry is never left unindexed. */
const INDEX_SECONDS = 2 * PERMISSION_CACHE_SECONDS;
const KEY_PREFIX = 'quad:perms';
const indexKey = (tenantId: string) => `${KEY_PREFIX}:idx:${tenantId}`;

/** What a request may do in its school: read once per request (`forRequest`). */
export interface RequestAccess {
  readonly tenantId: string;
  readonly status: TenantStatus;
  readonly suspendReason: string | null;
  readonly planModules: readonly PlanModule[];
  /** The effective keys (`effectivePermissions`): the previewed role's while a preview is on. */
  readonly permissions: ReadonlySet<PermissionKey>;
  /** The scope that picks the home page: the previewed role's, else the primary role's. */
  readonly scope: RoleScope;
  /** A Quad support visit: `@Sensitive` always refuses it safeguarding and medical. */
  readonly support: boolean;
  /** The previewed role, when a preview is on and the role still exists. */
  readonly previewRoleId: string | null;
}

/** What deciding a role's grant needs: system roles take their fixed defaults. */
export type GrantedRole = Pick<AccessRole, 'id' | 'key' | 'system'>;

/** A request in a school: everything `RequestAccess` is computed from (never request input). */
export type SchoolRequestAuth = RequestAuth & { readonly tenantId: string };

const CachedGrants = z.record(
  IdSchema,
  z.object({
    matrix: z.record(PermissionModule, z.string().regex(/^[01]{5}$/)),
    sensitive: z.array(SensitiveKey),
  }),
);

/** The plan modules a school profile lists, ignoring any this API does not know. */
export function planModulesOf(modules: readonly string[]): PlanModule[] {
  return modules.flatMap((module) => {
    const parsed = PlanModule.safeParse(module);
    return parsed.success ? [parsed.data] : [];
  });
}

/** The first 22 base64url characters of SHA-256, as the parent tokens' `rh` (D32). */
const hashOf = (value: string) =>
  createHash('sha256').update(value).digest('base64url').slice(0, 22);

function toGrant(stored: StoredGrant): RoleGrant {
  const matrix: Partial<Record<PermissionModule, PermissionRow>> = {};
  for (const module of PermissionModule.options) {
    const bits = stored.matrix[module];
    if (bits !== undefined) matrix[module] = rowOf(bits);
  }
  return { matrix, sensitive: stored.sensitive };
}

/**
 * A system role's permissions are fixed (spec 05): its defaults come from `systemRoleMatrix`,
 * never from rows a write could change. Any other role reads its stored matrix.
 */
function systemKeyOf(role: GrantedRole): SystemRoleKey | null {
  if (!role.system) return null;
  const parsed = SystemRoleKey.safeParse(role.key);
  return parsed.success ? parsed.data : null;
}

/**
 * Effective permissions for the guards and `GET /me/permissions` (spec 05; Task 12).
 *
 * Each request reads its school's profile (status, suspend reason, plan modules) and the roles in
 * play (the member's, and the previewed role) afresh, in one `withTenant` transaction. The stored
 * matrices of custom roles are cached in Redis for 30 s under
 * `quad:perms:{tenant}:{roles hash}:{max(roles.updated_at)}`, so a role write that moves
 * `updated_at` (every one does) or a new role assignment is seen on the next request, and
 * `invalidateTenant` (Task 13, after any role or permission write) drops the school's entries at
 * once. The result is kept per request, so the guards and the route share one read.
 *
 * If Redis fails, the matrices are read from Postgres and the API logs the metric
 * `permission_cache_unavailable`: reading the database is the source of truth, so this is not a
 * fail-open (nothing is granted that the database does not hold).
 */
@Injectable()
export class PermissionsService {
  private readonly perRequest = new WeakMap<FastifyRequest, Promise<RequestAccess>>();

  constructor(
    private readonly repository: PermissionsRepository,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  /** The request's access, read once per request. 401 when the session is not in a school. */
  forRequest(request: FastifyRequest): Promise<RequestAccess> {
    const cached = this.perRequest.get(request);
    if (cached !== undefined) return cached;
    const auth = requestAuthOf(request);
    if (auth === undefined || auth.tenantId === null) throw new UnauthorizedError();
    const access = this.of({ ...auth, tenantId: auth.tenantId });
    this.perRequest.set(request, access);
    return access;
  }

  /** The access of `auth`, read now (`POST /me/role-preview` answers with the new preview's). */
  async of(auth: SchoolRequestAuth): Promise<RequestAccess> {
    // Only a staff browser session acts through roles: the parent app's tokens are not
    // role-based, and a support visit has no membership (fix round 1, I1).
    const userId = auth.kind === 'web' ? auth.userId : null;
    const previewRoleId = auth.kind === 'web' ? auth.previewRoleId : null;
    // A support visit, or a member session tied to one: the support set, never safeguarding or
    // medical (spec 05). One value for the permissions and for `@Sensitive` (M2).
    const support =
      auth.kind === 'support' || (auth.kind === 'web' && auth.supportSessionId !== null);
    const stamp = await this.repository.stamp(auth.tenantId, userId, previewRoleId);
    if (stamp.profile === null) throw new UnauthorizedError();
    const planModules = planModulesOf(stamp.profile.modules);
    const inPlay = [...stamp.roles, ...(stamp.preview === null ? [] : [stamp.preview])];
    const grants = await this.grantsOf(auth.tenantId, inPlay);
    const grantOf = (role: AccessRole): RoleGrant =>
      grants.get(role.id) ?? { matrix: {}, sensitive: [] };
    const roles = stamp.roles.map(grantOf);
    const own = effectivePermissions({ roles, planModules, support });
    // A preview counts only while the member may still preview (users.manage, fix round 1 I2);
    // otherwise they act as themselves, and the session stays read-only until they end it.
    const preview = stamp.preview !== null && own.has(USERS_MANAGE) ? stamp.preview : null;
    const permissions =
      preview === null
        ? own
        : effectivePermissions({ roles, planModules, support, preview: grantOf(preview) });
    const primary = stamp.roles.find((role) => role.primary) ?? stamp.roles[0];
    return {
      tenantId: auth.tenantId,
      status: stamp.profile.status,
      suspendReason: stamp.profile.suspendReason,
      planModules,
      permissions,
      scope: preview?.scope ?? primary?.scope ?? 'school',
      support,
      previewRoleId: stamp.preview?.id ?? null,
    };
  }

  /**
   * Drops every cached matrix of the school. Task 13 calls it after each role or permission
   * write (`POST`/`PATCH`/`DELETE /roles`, `PUT /roles/:id/permissions`, a role change on a user).
   */
  async invalidateTenant(tenantId: string): Promise<void> {
    await this.cacheSafely('invalidate', async () => {
      const index = indexKey(tenantId);
      const keys = await this.redis.smembers(index);
      await this.redis.del(index, ...keys);
    });
  }

  /**
   * The grants of `roles` read in the caller's transaction (Users & roles, Task 13): system roles
   * from their fixed defaults, custom ones from their stored rows, never from the cache, so a
   * write (`canGrant`, the role list) decides on what the database holds now.
   */
  async roleGrantsIn(tx: TenantTx, roles: readonly GrantedRole[]): Promise<Map<string, RoleGrant>> {
    const grants = new Map<string, RoleGrant>();
    const custom: string[] = [];
    for (const role of roles) {
      const key = systemKeyOf(role);
      if (key === null) custom.push(role.id);
      else grants.set(role.id, systemRoleMatrix(key));
    }
    const stored = await this.repository.grantsIn(tx, custom);
    for (const [id, grant] of stored) grants.set(id, toGrant(grant));
    return grants;
  }

  /** Every role's grant: system roles from their fixed defaults, custom ones from the cache or Postgres. */
  private async grantsOf(
    tenantId: string,
    inPlay: readonly AccessRole[],
  ): Promise<Map<string, RoleGrant>> {
    const grants = new Map<string, RoleGrant>();
    const custom: AccessRole[] = [];
    for (const role of inPlay) {
      const key = systemKeyOf(role);
      if (key === null) custom.push(role);
      else grants.set(role.id, systemRoleMatrix(key));
    }
    if (custom.length === 0) return grants;
    const stored = await this.storedGrants(tenantId, custom);
    for (const [id, grant] of stored) grants.set(id, toGrant(grant));
    return grants;
  }

  private async storedGrants(
    tenantId: string,
    custom: readonly AccessRole[],
  ): Promise<Map<string, StoredGrant>> {
    const ids = [...new Set(custom.map((role) => role.id))].sort();
    const lastChange = custom
      .map((role) => BigInt(role.updatedAtMicros))
      .reduce((max, at) => (at > max ? at : max), 0n);
    const key = `${KEY_PREFIX}:${tenantId}:${hashOf(ids.join(','))}:${lastChange}`;

    // `undefined` is a failed read (Redis down), `null` a miss.
    const raw = await this.cacheSafely('read', () => this.redis.get(key));
    const hit = typeof raw === 'string' ? parseGrants(raw) : null;
    if (hit !== null && ids.every((id) => hit.has(id))) return hit;

    const grants = await this.repository.grants(tenantId, ids);
    // After a failed read, a write would only wait for Redis to fail again (fix round 1, M3).
    if (raw === undefined) return grants;
    const index = indexKey(tenantId);
    await this.cacheSafely('write', () =>
      this.redis
        .multi()
        .set(key, JSON.stringify(Object.fromEntries(grants)), 'EX', PERMISSION_CACHE_SECONDS)
        .sadd(index, key)
        .expire(index, INDEX_SECONDS)
        .exec(),
    );
    return grants;
  }

  private async cacheSafely<T>(
    operation: string,
    command: () => Promise<T>,
  ): Promise<T | undefined> {
    try {
      return await command();
    } catch (error) {
      this.logger.warn(
        { metric: 'permission_cache_unavailable', operation, error: errorForLog(error) },
        'Permission cache skipped: Redis did not answer',
      );
      return undefined;
    }
  }
}

function parseGrants(raw: string): Map<string, StoredGrant> | null {
  try {
    const parsed = CachedGrants.safeParse(JSON.parse(raw));
    return parsed.success ? new Map(Object.entries(parsed.data)) : null;
  } catch {
    return null;
  }
}
