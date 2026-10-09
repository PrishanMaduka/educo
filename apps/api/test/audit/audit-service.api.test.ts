import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { AuditService } from '../../src/common/audit/audit.service';
import { TENANT_DB } from '../../src/tokens';
import { useDatabaseApp } from '../helpers/database-app';
import {
  insertPlatformUser,
  insertSchool,
  insertSupportVisit,
  signedInMember,
} from '../helpers/identity';

import type { AuditActor } from '../../src/common/audit/audit.service';
import type { QuadTenantDb } from '@quad/db';

const { db, app } = useDatabaseApp();

const audit = () => app().get(AuditService);
const tenantDb = () => app().get<symbol, QuadTenantDb>(TENANT_DB);

async function auditRows(tenantId: string) {
  const { rows } = await db().platform.query<Record<string, unknown>>(
    `select tenant_id, actor_user_id, actor_platform_user_id, support_session_id, action,
            target_type, target_id, meta, host(ip) as ip
     from audit_log where tenant_id = $1`,
    [tenantId],
  );
  return rows;
}

async function platformRows(supportSessionId: string) {
  const { rows } = await db().platform.query<Record<string, unknown>>(
    `select actor_platform_user_id, action, target_type, target_id, tenant_id, meta
     from platform_audit where meta->>'support_session_id' = $1`,
    [supportSessionId],
  );
  return rows;
}

describe('AuditService.record (spec 05 → Audit)', () => {
  it("writes the member's action in the change's own transaction", async () => {
    const school = await insertSchool(db());
    const { userId } = await signedInMember(db(), school);
    const actor: AuditActor = {
      tenantId: school.id,
      userId,
      supportSessionId: null,
      platformUserId: null,
      ip: '203.0.113.9',
    };
    const target = randomUUID();
    await tenantDb().withTenant(school.id, (tx) =>
      audit().record(
        { tx, ...actor },
        'user.role_changed',
        { type: 'user', id: target },
        {
          from: 'teacher',
          to: 'admin',
        },
      ),
    );
    expect(await auditRows(school.id)).toEqual([
      {
        tenant_id: school.id,
        actor_user_id: userId,
        actor_platform_user_id: null,
        support_session_id: null,
        action: 'user.role_changed',
        target_type: 'user',
        target_id: target,
        meta: { from: 'teacher', to: 'admin' },
        ip: '203.0.113.9',
      },
    ]);
  });

  it('leaves no audit row when the change rolls back', async () => {
    const school = await insertSchool(db());
    const { userId } = await signedInMember(db(), school);
    await expect(
      tenantDb().withTenant(school.id, async (tx) => {
        await audit().record(
          {
            tx,
            tenantId: school.id,
            userId,
            supportSessionId: null,
            platformUserId: null,
            ip: null,
          },
          'settings.updated',
          { type: 'school', id: school.id },
        );
        throw new Error('The change failed after the audit was written.');
      }),
    ).rejects.toThrow(/change failed/);
    expect(await auditRows(school.id)).toEqual([]);
  });

  it('in a support visit, writes one audit_log row for the visit and one platform_audit row', async () => {
    const school = await insertSchool(db());
    const staff = await insertPlatformUser(db(), 'Ruwan Mendis');
    const visit = await insertSupportVisit(db(), staff, school.id);
    const target = randomUUID();
    await tenantDb().withTenant(school.id, (tx) =>
      audit().record(
        {
          tx,
          tenantId: school.id,
          userId: null,
          supportSessionId: visit.id,
          platformUserId: staff,
          ip: null,
        },
        'user.deactivated',
        { type: 'user', id: target },
      ),
    );
    expect(await auditRows(school.id)).toEqual([
      expect.objectContaining({
        actor_user_id: null,
        actor_platform_user_id: staff,
        support_session_id: visit.id,
        action: 'user.deactivated',
      }),
    ]);
    expect(await platformRows(visit.id)).toEqual([
      {
        actor_platform_user_id: staff,
        action: 'user.deactivated',
        target_type: 'user',
        target_id: target,
        tenant_id: school.id,
        meta: { support_session_id: visit.id },
      },
    ]);
  });

  it('writes neither row for a support visit that has ended: the change is refused', async () => {
    const school = await insertSchool(db());
    const staff = await insertPlatformUser(db(), 'Ruwan Mendis');
    const visit = await insertSupportVisit(db(), staff, school.id);
    await tenantDb().definers.endSupportSession(visit.tokenHash);
    await expect(
      tenantDb().withTenant(school.id, (tx) =>
        audit().record(
          {
            tx,
            tenantId: school.id,
            userId: null,
            supportSessionId: visit.id,
            platformUserId: staff,
            ip: null,
          },
          'user.invited',
          null,
        ),
      ),
    ).rejects.toThrow();
    expect(await auditRows(school.id)).toEqual([]);
    expect(await platformRows(visit.id)).toEqual([]);
  });

  it('treats a member session that names a visit as the member: never a row without an actor', async () => {
    const school = await insertSchool(db());
    const { userId } = await signedInMember(db(), school);
    const staff = await insertPlatformUser(db(), 'Ruwan Mendis');
    const visit = await insertSupportVisit(db(), staff, school.id);
    await tenantDb().withTenant(school.id, (tx) =>
      audit().record(
        {
          tx,
          tenantId: school.id,
          userId,
          supportSessionId: visit.id,
          platformUserId: null,
          ip: null,
        },
        'settings.updated',
        null,
      ),
    );
    expect(await auditRows(school.id)).toEqual([
      expect.objectContaining({
        actor_user_id: userId,
        actor_platform_user_id: null,
        support_session_id: null,
      }),
    ]);
    expect(await platformRows(visit.id)).toEqual([]);
  });

  it('refuses a Quad staff member without a support visit, and writes nothing', async () => {
    const school = await insertSchool(db());
    const staff = await insertPlatformUser(db(), 'Ruwan Mendis');
    await expect(
      tenantDb().withTenant(school.id, (tx) =>
        audit().record(
          {
            tx,
            tenantId: school.id,
            userId: null,
            supportSessionId: null,
            platformUserId: staff,
            ip: null,
          },
          'settings.updated',
          null,
        ),
      ),
    ).rejects.toThrow(/support visit/);
    expect(await auditRows(school.id)).toEqual([]);
  });

  it("cannot write into another school's log from this school's transaction (RLS)", async () => {
    const schoolA = await insertSchool(db());
    const schoolB = await insertSchool(db());
    await expect(
      tenantDb().withTenant(schoolA.id, (tx) =>
        audit().record(
          {
            tx,
            tenantId: schoolB.id,
            userId: null,
            supportSessionId: null,
            platformUserId: null,
            ip: null,
          },
          'settings.updated',
          null,
        ),
      ),
    ).rejects.toThrow();
    expect(await auditRows(schoolB.id)).toEqual([]);
  });
});
