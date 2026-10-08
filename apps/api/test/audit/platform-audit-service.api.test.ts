import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { PlatformAuditService } from '../../src/platform/audit/platform-audit.service';
import { PLATFORM_DB } from '../../src/platform/tokens';
import { useDatabaseApp } from '../helpers/database-app';
import { insertPlatformUser, insertSchool } from '../helpers/identity';

import type { QuadPlatformDb } from '@quad/db';

const { db, app } = useDatabaseApp();

// Only src/platform/** injects PLATFORM_DB; the test reaches it through the app for arrangement.
const platformDb = () => app().get<symbol, QuadPlatformDb>(PLATFORM_DB, { strict: false });
const service = () => app().get(PlatformAuditService, { strict: false });

async function rowsFor(actor: string) {
  const { rows } = await db().platform.query<Record<string, unknown>>(
    `select actor_platform_user_id, action, target_type, target_id, tenant_id, host(ip) as ip,
            user_agent, meta
     from platform_audit where actor_platform_user_id = $1 order by at`,
    [actor],
  );
  return rows;
}

describe('PlatformAuditService.record (spec 05 → Audit, D17)', () => {
  it('writes one platform_audit row per withPlatform write, in that transaction', async () => {
    const staff = await insertPlatformUser(db(), 'Ruwan Mendis');
    const school = await insertSchool(db());
    const visit = randomUUID();
    await platformDb().withPlatform(async (tx) => {
      await service().record(tx, {
        actorPlatformUserId: staff,
        action: 'support_session.started',
        target: { type: 'support_session', id: visit },
        tenantId: school.id,
        ip: '198.51.100.7',
        userAgent: 'Quad test browser',
        meta: { reason: 'Helping with a test' },
      });
      await service().record(tx, {
        actorPlatformUserId: staff,
        action: 'tenant.renamed',
        target: { type: 'tenant', id: school.id },
      });
    });
    expect(await rowsFor(staff)).toEqual([
      {
        actor_platform_user_id: staff,
        action: 'support_session.started',
        target_type: 'support_session',
        target_id: visit,
        tenant_id: school.id,
        ip: '198.51.100.7',
        user_agent: 'Quad test browser',
        meta: { reason: 'Helping with a test' },
      },
      {
        actor_platform_user_id: staff,
        action: 'tenant.renamed',
        target_type: 'tenant',
        target_id: school.id,
        tenant_id: null,
        ip: null,
        user_agent: null,
        meta: {},
      },
    ]);
  });

  it('leaves no row when the platform write rolls back', async () => {
    const staff = await insertPlatformUser(db(), 'Ruwan Mendis');
    await expect(
      platformDb().withPlatform(async (tx) => {
        await service().record(tx, {
          actorPlatformUserId: staff,
          action: 'support_session.ended',
          target: null,
        });
        throw new Error('The platform write failed.');
      }),
    ).rejects.toThrow(/platform write failed/);
    expect(await rowsFor(staff)).toEqual([]);
  });
});
