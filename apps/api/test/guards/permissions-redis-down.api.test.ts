import { describe, expect, it } from 'vitest';

import { CLOSED_PORTS, captureLogs } from '../app';
import { assignRole, insertCustomRole, setPlanModules, setRoleMatrix } from '../helpers/access';
import { Browser } from '../helpers/browser';
import { useDatabaseApp } from '../helpers/database-app';
import { insertSchool, sessionHeaders, signedInMember } from '../helpers/identity';

import { GuardsProbeModule } from './probe.module';

// Redis is unreachable for this whole file (a closed port).
const { lines, logger } = captureLogs();
const { db, app } = useDatabaseApp(
  { REDIS_URL: CLOSED_PORTS.REDIS_URL },
  { logger, overrides: { testModules: [GuardsProbeModule] } },
);

describe('the permission cache with Redis down (D32: read Postgres, never grant more)', () => {
  it('reads the matrix from Postgres, so grants and refusals follow the database', async () => {
    const at = await insertSchool(db());
    await setPlanModules(db(), at.id, ['fees', 'sis']);
    const member = await signedInMember(db(), at);
    const roleId = await insertCustomRole(db(), at.id, { matrix: { fees: '10000' } });
    await assignRole(db(), at.id, member.userId, roleId);
    const fees = () =>
      new Browser(app).get('/probe/guards/fees', { headers: sessionHeaders(member.session) });

    expect((await fees()).statusCode).toBe(200);
    // No cache to go stale: the next request already sees a change, with no bump or invalidation.
    await setRoleMatrix(db(), at.id, roleId, { sis: '10000' });
    const refused = await fees();
    expect(refused.statusCode).toBe(403);
    expect(refused.json()).toMatchObject({ code: 'forbidden' });

    expect(lines).toContainEqual(
      expect.objectContaining({ metric: 'permission_cache_unavailable' }),
    );
    // Every Redis call waits for its failure (about 2 s each), so this test takes a while.
  }, 60_000);
});
