import { describe, expect, it } from 'vitest';

import { PLATFORM_TABLES, createDefinerCalls, findTenancyViolations } from '../src/internal';

import { useTestDatabase } from './setup';

const testDb = useTestDatabase();

interface SuppressionRow {
  address: string;
  reason: string;
  source: string;
}

async function rows(): Promise<SuppressionRow[]> {
  const { owner } = testDb();
  const result = await owner.query<SuppressionRow>(
    'select address::text, reason::text, source from email_suppressions order by address',
  );
  return result.rows;
}

describe('email_suppressions (platform table, spec 04)', () => {
  it('is a platform table and the tenancy check reports nothing', async () => {
    expect(PLATFORM_TABLES).toContain('email_suppressions');
    expect(await findTenancyViolations(testDb().owner)).toEqual([]);
  });

  it('is closed to quad_app, open to quad_platform', async () => {
    const { app, platform } = testDb();
    await expect(app.query('select * from email_suppressions')).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      app.query(
        `insert into email_suppressions (address, reason, source) values ('x@y.z', 'manual', 't')`,
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(platform.query('select count(*) from email_suppressions')).resolves.toBeTruthy();
  });
});

describe('record_email_suppression (security definer, D16)', () => {
  it('quad_app can execute it, PUBLIC cannot, and it runs as quad_owner with a pinned search_path', async () => {
    const { owner } = testDb();
    const { rows: grants } = await owner.query<{
      app: boolean;
      platform: boolean;
      definer: boolean;
      owner: string;
      config: string[];
    }>(
      `select has_function_privilege('quad_app', p.oid, 'EXECUTE') as app,
              has_function_privilege('quad_platform', p.oid, 'EXECUTE') as platform,
              p.prosecdef as definer,
              pg_get_userbyid(p.proowner) as owner,
              p.proconfig as config
       from pg_proc p where p.proname = 'record_email_suppression'`,
    );
    expect(grants).toEqual([
      {
        app: true,
        platform: false,
        definer: true,
        owner: 'quad_owner',
        config: ['search_path=public, pg_temp'],
      },
    ]);
  });

  it('inserts through the quad_app definer call, then upserts the reason, source and time', async () => {
    const definers = createDefinerCalls(testDb().app);
    await definers.recordEmailSuppression({
      address: 'A@Example.com',
      reason: 'bounce',
      source: 'ses',
    });
    expect(await rows()).toEqual([{ address: 'A@Example.com', reason: 'bounce', source: 'ses' }]);
    const { rows: before } = await testDb().owner.query<{ at: Date }>(
      'select at from email_suppressions',
    );

    // citext: the same address in another case is the same row.
    await definers.recordEmailSuppression({
      address: 'a@example.com',
      reason: 'complaint',
      source: 'manual-entry',
    });
    expect(await rows()).toEqual([
      { address: 'A@Example.com', reason: 'complaint', source: 'manual-entry' },
    ]);
    const { rows: after } = await testDb().owner.query<{ at: Date }>(
      'select at from email_suppressions',
    );
    expect(after[0]!.at.getTime()).toBeGreaterThanOrEqual(before[0]!.at.getTime());
  });

  it('refuses a reason outside the enum', async () => {
    await expect(
      testDb().app.query(`select record_email_suppression('b@example.com', 'spam', 'ses')`),
    ).rejects.toThrow(/invalid input value for enum/);
  });
});
