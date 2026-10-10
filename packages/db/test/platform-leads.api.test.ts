import { createHash } from 'node:crypto';

import pg from 'pg';
import { beforeEach, describe, expect, it } from 'vitest';

import { PLATFORM_TABLES, createDefinerCalls, findTenancyViolations } from '../src/internal';

import { useTestDatabase } from './setup';

import type { DemoRequestRecord } from '../src/internal';

const testDb = useTestDatabase();

const SIGNATURE =
  'record_demo_request(lead_kind, text, citext, text, students_band, text, text, text, text, bytea, text)';

const ipHash = createHash('sha256').update('203.0.113.7').digest();

const schoolRequest: DemoRequestRecord = {
  kind: 'school_demo',
  name: 'Sample Person',
  email: 'Lead@School.example',
  school: 'Sample School',
  students: '300_1000',
  curriculum: 'ib',
  country: 'Portugal',
  city: null,
  note: null,
  ipHash,
  userAgent: 'Mozilla/5.0 (test)',
};

const parentRequest: DemoRequestRecord = {
  kind: 'parent_intro',
  name: 'Sample Parent',
  email: 'lead@school.example',
  school: 'Sample School',
  students: null,
  curriculum: null,
  country: null,
  city: 'Lisbon',
  note: 'We would love this.\nThank you.',
  ipHash,
  userAgent: null,
};

interface LeadRow {
  id: string;
  kind: string;
  name: string;
  email: string;
  school_name: string;
  students_band: string | null;
  curriculum: string | null;
  country: string | null;
  city: string | null;
  note: string | null;
  source: string;
  status: string;
  ip_hash: Buffer;
  user_agent: string | null;
  created_at: Date;
  updated_at: Date;
}

async function leads(): Promise<LeadRow[]> {
  const { rows } = await testDb().owner.query<LeadRow>(
    `select id, kind::text, name, email::text, school_name, students_band::text, curriculum,
            country, city, note, source::text, status::text, ip_hash, user_agent, created_at,
            updated_at
     from platform_leads order by created_at, id`,
  );
  return rows;
}

const record = (input: DemoRequestRecord) =>
  createDefinerCalls(testDb().app).recordDemoRequest(input);

beforeEach(async () => {
  await testDb().owner.query('delete from platform_leads');
});

describe('platform_leads (platform table, spec 04, D57)', () => {
  it('is a platform table and the tenancy check reports nothing', async () => {
    expect(PLATFORM_TABLES).toContain('platform_leads');
    expect(await findTenancyViolations(testDb().owner)).toEqual([]);
  });

  it.each([
    ['a select', 'select * from platform_leads'],
    [
      'an insert',
      `insert into platform_leads (kind, name, email, school_name, ip_hash)
       values ('school_demo', 'A', 'a@b.example', 'S', '\\x00')`,
    ],
    ['an update', `update platform_leads set status = 'won'`],
    ['a delete', 'delete from platform_leads'],
  ])('refuses quad_app %s', async (_command, statement) => {
    await expect(testDb().app.query(statement)).rejects.toThrow(/permission denied/);
  });

  it('gives a new lead the defaults: from the landing page, status new', async () => {
    await record(schoolRequest);
    const [lead] = await leads();
    expect(lead).toMatchObject({ source: 'landing', status: 'new' });
    expect(lead?.created_at.getTime()).toBe(lead?.updated_at.getTime());
  });

  it.each([
    ['a note over 1,000 characters', { ...parentRequest, note: 'x'.repeat(1001) }],
    ['a user agent over 400 characters', { ...schoolRequest, userAgent: 'x'.repeat(401) }],
    ['an IP hash that is not 32 bytes', { ...schoolRequest, ipHash: Buffer.alloc(16) }],
  ])('refuses %s', async (_name, input) => {
    await expect(record(input)).rejects.toThrow(/check constraint/);
  });
});

describe('record_demo_request (security definer, D16, D57)', () => {
  it('is a security definer owned by quad_owner, with a pinned search_path, executable by quad_app only', async () => {
    const { rows } = await testDb().owner.query(
      `select p.prosecdef as definer,
              pg_get_userbyid(p.proowner) as owner,
              p.proconfig as config,
              has_function_privilege('quad_app', p.oid, 'EXECUTE') as app,
              has_function_privilege('quad_platform', p.oid, 'EXECUTE') as platform,
              exists (select 1 from aclexplode(p.proacl) a
                      where a.grantee = 0 and a.privilege_type = 'EXECUTE') as public
       from pg_proc p where p.oid = $1::regprocedure`,
      [SIGNATURE],
    );
    expect(rows).toEqual([
      {
        definer: true,
        owner: 'quad_owner',
        // pg_temp last, so a temporary table cannot stand in for platform_leads.
        config: ['search_path=pg_catalog, public, pg_temp'],
        app: true,
        platform: false,
        public: false,
      },
    ]);
  });

  it('inserts a lead and says it was created', async () => {
    const result = await record(schoolRequest);
    expect(result.created).toBe(true);
    expect(await leads()).toEqual([
      expect.objectContaining({
        id: result.leadId,
        kind: 'school_demo',
        name: 'Sample Person',
        email: 'Lead@School.example',
        school_name: 'Sample School',
        students_band: '300_1000',
        curriculum: 'ib',
        country: 'Portugal',
        city: null,
        note: null,
        ip_hash: ipHash,
        user_agent: 'Mozilla/5.0 (test)',
      }),
    ]);
  });

  it('updates the same lead for a repeat within 24 hours from the email in another case', async () => {
    const first = await record(schoolRequest);
    const [before] = await leads();
    const second = await record({
      ...schoolRequest,
      email: 'LEAD@school.EXAMPLE',
      name: 'Sample Person Two',
      students: '1000_2500',
      curriculum: 'cambridge',
      country: null,
      userAgent: null,
    });
    expect(second).toEqual({ leadId: first.leadId, created: false });
    const rows = await leads();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: first.leadId,
      name: 'Sample Person Two',
      students_band: '1000_2500',
      curriculum: 'cambridge',
      country: null,
    });
    expect(rows[0]?.created_at).toEqual(before?.created_at);
    expect(rows[0]!.updated_at.getTime()).toBeGreaterThan(before!.updated_at.getTime());
  });

  it("keeps the first request's IP hash and user agent on a repeat (the abuse signal, D57)", async () => {
    const first = await record(schoolRequest);
    await record({
      ...schoolRequest,
      name: 'Sample Person Two',
      ipHash: createHash('sha256').update('198.51.100.9').digest(),
      userAgent: 'Other/1.0',
    });
    const rows = await leads();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: first.leadId, name: 'Sample Person Two' });
    expect(rows[0]?.ip_hash.equals(ipHash)).toBe(true);
    expect(rows[0]?.user_agent).toBe('Mozilla/5.0 (test)');
  });

  it('inserts a new lead once the earlier one is more than 24 hours old', async () => {
    const first = await record(schoolRequest);
    await testDb().owner.query(
      `update platform_leads set created_at = now() - interval '24 hours 1 second'`,
    );
    const second = await record(schoolRequest);
    expect(second.created).toBe(true);
    expect(second.leadId).not.toBe(first.leadId);
    expect(await leads()).toHaveLength(2);
  });

  it('inserts a new lead when the earlier one is no longer new', async () => {
    const first = await record(schoolRequest);
    await testDb().owner.query(`update platform_leads set status = 'contacted'`);
    const second = await record(schoolRequest);
    expect(second.created).toBe(true);
    expect(second.leadId).not.toBe(first.leadId);
  });

  it('keeps a parent lead and a school lead from the same email as two rows', async () => {
    const school = await record(schoolRequest);
    const parent = await record(parentRequest);
    expect(parent.created).toBe(true);
    expect(parent.leadId).not.toBe(school.leadId);
    expect((await leads()).map((lead) => lead.kind)).toEqual(['school_demo', 'parent_intro']);
    expect((await leads())[1]).toMatchObject({ note: 'We would love this.\nThank you.' });
  });

  it('gives one lead for two concurrent requests from one email (the advisory lock)', async () => {
    const { appUrl, app } = testDb();
    const holder = new pg.Client({ connectionString: appUrl });
    await holder.connect();
    try {
      // The first request is in flight: inserted, holding the lock, not yet committed.
      await holder.query('begin');
      const { rows } = await holder.query<{ lead_id: string; created: boolean }>(
        `select * from record_demo_request($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          'school_demo',
          'A',
          'race@school.example',
          'S',
          null,
          null,
          null,
          null,
          null,
          ipHash,
          null,
        ],
      );
      const second = createDefinerCalls(app).recordDemoRequest({
        ...schoolRequest,
        email: 'Race@School.example',
      });
      // The second waits on the first's lock rather than missing its uncommitted row.
      await expect.poll(() => waitingOnLock(appUrl), { timeout: 5_000 }).toBe(true);
      await holder.query('commit');
      expect(await second).toEqual({ leadId: rows[0]?.lead_id, created: false });
    } finally {
      await holder.end();
    }
    expect(await leads()).toHaveLength(1);
  });
});

/** True when some session of this database waits on an advisory lock. */
async function waitingOnLock(url: string): Promise<boolean> {
  const { owner } = testDb();
  const database = new URL(url).pathname.slice(1);
  const { rows } = await owner.query<{ waiting: boolean }>(
    `select exists (
       select 1 from pg_locks l join pg_stat_activity a on a.pid = l.pid
       where l.locktype = 'advisory' and not l.granted and a.datname = $1
     ) as waiting`,
    [database],
  );
  return rows[0]?.waiting ?? false;
}
