import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { InvalidTenantIdError, closeDb, withPlatform, withTenant } from '../src/index';
import { SEED_TENANTS } from '../src/seed-data';

import { useTestDatabase } from './setup';

const testDb = useTestDatabase();
const ENV_KEYS = ['DATABASE_URL', 'DATABASE_PLATFORM_URL'] as const;
const savedEnv = new Map<string, string | undefined>();

// The module-level helpers read DATABASE_URL / DATABASE_PLATFORM_URL on first use; point them
// at this file's fresh database and put the environment back afterwards.
beforeAll(() => {
  for (const key of ENV_KEYS) {
    savedEnv.set(key, process.env[key]);
  }
  process.env.DATABASE_URL = testDb().appUrl;
  process.env.DATABASE_PLATFORM_URL = testDb().platformUrl;
});

afterAll(async () => {
  await closeDb();
  for (const key of ENV_KEYS) {
    const value = savedEnv.get(key);
    if (value === undefined) {
      Reflect.deleteProperty(process.env, key);
    } else {
      process.env[key] = value;
    }
  }
});

describe('default withTenant and withPlatform', () => {
  it('sets app.tenant_id for the transaction only', async () => {
    const id = SEED_TENANTS.colomboIntl.id;
    const inside = await withTenant(id, async (tx) => {
      const result = await tx.execute<{ tenant: string; role: string; db: string }>(
        sql`select current_setting('app.tenant_id', true) as tenant, current_user as role,
                   current_database() as db`,
      );
      return result.rows[0];
    });
    expect(inside).toEqual({ tenant: id, role: 'quad_app', db: testDb().name });
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
