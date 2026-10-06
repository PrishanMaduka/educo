import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';

import { InvalidTenantIdError, closeDb, withPlatform, withTenant } from '../src/index';
import { SEED_TENANTS } from '../src/seed-data';

// The module-level helpers connect with DATABASE_URL / DATABASE_PLATFORM_URL (local defaults
// here). These checks read only session settings, so they need no tables.
afterAll(async () => {
  await closeDb();
});

describe('default withTenant and withPlatform', () => {
  it('sets app.tenant_id for the transaction only', async () => {
    const id = SEED_TENANTS.colomboIntl.id;
    const inside = await withTenant(id, async (tx) => {
      const result = await tx.execute<{ tenant: string; role: string }>(
        sql`select current_setting('app.tenant_id', true) as tenant, current_user as role`,
      );
      return result.rows[0];
    });
    expect(inside).toEqual({ tenant: id, role: 'quad_app' });
  });

  it('throws InvalidTenantIdError before connecting', async () => {
    await expect(withTenant('nope', () => Promise.resolve(1))).rejects.toBeInstanceOf(
      InvalidTenantIdError,
    );
  });

  it('runs withPlatform as quad_platform', async () => {
    const role = await withPlatform(async (tx) => {
      const result = await tx.execute<{ role: string }>(sql`select current_user as role`);
      return result.rows[0]?.role;
    });
    expect(role).toBe('quad_platform');
  });

  it('closes the default pools and can open them again', async () => {
    await closeDb();
    await closeDb();
    const role = await withPlatform(async (tx) => {
      const result = await tx.execute<{ role: string }>(sql`select current_user as role`);
      return result.rows[0]?.role;
    });
    expect(role).toBe('quad_platform');
  });
});
