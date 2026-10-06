import { randomBytes } from 'node:crypto';

import { tenants, uuidv7 } from '../src/internal';

import type { NewTenant, PlatformRunner, Tenant } from '../src/internal';

/** A valid `tenants` row with a unique id and slug; override any column. */
export function buildTenant(overrides: Partial<NewTenant> = {}): NewTenant {
  const suffix = randomBytes(4).toString('hex');
  return {
    id: uuidv7(),
    name: `Test School ${suffix}`,
    shortName: 'TS',
    slug: `test-${suffix}`,
    country: 'LK',
    region: 'ap-south',
    timeZone: 'Asia/Colombo',
    currency: 'LKR',
    locale: 'en-LK',
    status: 'active',
    ...overrides,
  };
}

/** Inserts a tenant through `withPlatform` (tenants is a platform table). */
export async function insertTenant(
  withPlatform: PlatformRunner,
  overrides: Partial<NewTenant> = {},
): Promise<Tenant> {
  const [row] = await withPlatform((tx) =>
    tx.insert(tenants).values(buildTenant(overrides)).returning(),
  );
  if (!row) {
    throw new Error('Tenant insert returned no row.');
  }
  return row;
}
