import { describe, expect, it } from 'vitest';

import { SEED_TENANTS, seedDatabase } from '../src/internal';

import { useTestDatabase } from './setup';

const testDb = useTestDatabase();

describe('seed', () => {
  it('inserts the two seed schools with fixed ids, and running it twice changes nothing', async () => {
    await seedDatabase(testDb().ownerUrl);
    await seedDatabase(testDb().ownerUrl);
    const { rows } = await testDb().platform.query<Record<string, unknown>>(
      `select id, name, short_name, slug, country, region, time_zone, currency, locale, status,
              to_char(since, 'YYYY-MM-DD') as since
       from tenants order by slug`,
    );
    expect(rows).toEqual([
      {
        id: SEED_TENANTS.colomboIntl.id,
        name: 'Colombo International School',
        short_name: 'CIS',
        slug: 'colombo-intl',
        country: 'LK',
        region: 'ap-south',
        time_zone: 'Asia/Colombo',
        currency: 'LKR',
        locale: 'en-LK',
        status: 'active',
        since: '2024-01-01',
      },
      {
        id: SEED_TENANTS.kandyHill.id,
        name: 'Kandy Hill Academy',
        short_name: 'KHA',
        slug: 'kandy-hill',
        country: 'LK',
        region: 'ap-south',
        time_zone: 'Asia/Colombo',
        currency: 'LKR',
        locale: 'en-LK',
        status: 'active',
        since: '2024-06-01',
      },
    ]);
  });

  it('restores edited seed rows to their seed values', async () => {
    await testDb().platform.query(`update tenants set name = 'Renamed' where slug = 'kandy-hill'`);
    await seedDatabase(testDb().ownerUrl);
    const { rows } = await testDb().platform.query<{ name: string }>(
      `select name from tenants where id = $1`,
      [SEED_TENANTS.kandyHill.id],
    );
    expect(rows).toEqual([{ name: 'Kandy Hill Academy' }]);
  });
});
