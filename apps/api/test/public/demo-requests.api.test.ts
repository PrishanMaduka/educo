import { createHmac, hkdfSync, randomBytes } from 'node:crypto';

import { TURNSTILE_DUMMY_TOKEN } from '@quad/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PLATFORM_DB } from '../../src/platform/tokens';
import { TENANT_DB, TURNSTILE } from '../../src/tokens';
import { captureLogs } from '../app';
import { localEnv } from '../env';
import { RecordingDelivery } from '../fakes/delivery';
import { Browser, randomIp } from '../helpers/browser';
import { useDatabaseApp } from '../helpers/database-app';
import { insertSchool, sessionHeaders, signedInMember } from '../helpers/identity';

import type { TurnstileVerifier } from '../../src/common/turnstile/turnstile';
import type { QuadPlatformDb, QuadTenantDb } from '@quad/db';

/**
 * A fixed clock, so the windows never roll over mid-test: 03:30:01 UTC, so the hour window
 * resets in 1,799 s and the day window (aligned to UTC midnight) in 73,799 s.
 */
const NOW = Date.UTC(2026, 9, 10, 3, 30, 1);
const HOUR_RETRY_AFTER = '1799';
const DAY_RETRY_AFTER = '73799';

const delivery = new RecordingDelivery();
const logs = captureLogs();
const { app, db } = useDatabaseApp(
  {},
  { logger: logs.logger, overrides: { now: () => NOW, delivery } },
);

/** `.env.example`'s local default: with SALES_INBOX unset, local sends go to Mailpit's inbox. */
const SALES_INBOX = 'sales@quad.local';

/** The email jobs queued for one lead, in order. */
const jobsFor = (leadId: string) =>
  delivery.emails.filter(({ jobId }) => jobId.startsWith(`demo-request.${leadId}.`));
/** A sales job id: the lead, then a per-request part, so a repeat is never dropped. */
const SALES_ID = (leadId: string) =>
  new RegExp(`^demo-request\\.${leadId}\\.sales\\.[0-9a-f-]{36}$`);

afterEach(() => {
  vi.restoreAllMocks();
});

const ROUTE = '/public/demo-requests';
/** A fresh address per request: the per-email buckets outlive a test run in Redis. */
const freshEmail = (): string => `lead-${randomBytes(6).toString('hex')}@example.test`;

const schoolRequest = (overrides: Record<string, unknown> = {}) => ({
  kind: 'school',
  name: 'Sample Person',
  email: freshEmail(),
  school: 'Sample School',
  country: 'Portugal',
  students: '300_1000',
  curriculum: 'ib',
  turnstileToken: TURNSTILE_DUMMY_TOKEN,
  ...overrides,
});

const parentRequest = (overrides: Record<string, unknown> = {}) => ({
  kind: 'parent',
  name: 'Sample Parent',
  email: freshEmail(),
  school: 'Sample School',
  city: 'Lisbon',
  note: 'Our school would love this.\nPlease get in touch.',
  turnstileToken: TURNSTILE_DUMMY_TOKEN,
  ...overrides,
});

interface LeadRow {
  readonly id: string;
  readonly kind: string;
  readonly source: string;
  readonly status: string;
  readonly name: string;
  readonly email: string;
  readonly school: string;
  readonly students_band: string | null;
  readonly curriculum: string | null;
  readonly country: string | null;
  readonly city: string | null;
  readonly note: string | null;
  readonly ip_hash: Buffer;
  readonly user_agent: string | null;
  readonly owner_platform_user_id: string | null;
  readonly converted_tenant_id: string | null;
}

/** The leads for an email, read as the owner (quad_app has no privilege on platform_leads). */
async function leadsFor(email: string): Promise<LeadRow[]> {
  const { rows } = await db().owner.query<LeadRow>(
    `select id, kind, source, status, name, email::text as email, school_name as school, students_band,
            curriculum, country, city, note, ip_hash, user_agent, owner_platform_user_id,
            converted_tenant_id
       from platform_leads where email = $1`,
    [email],
  );
  return rows;
}

/** HMAC-SHA256 of the address under HKDF(SESSION_SECRET, info "quad lead ip"), 32 bytes. */
function expectedIpHash(ip: string): Buffer {
  const key = Buffer.from(
    hkdfSync('sha256', localEnv().SESSION_SECRET ?? '', '', 'quad lead ip', 32),
  );
  return createHmac('sha256', key).update(ip, 'utf8').digest();
}

const turnstile = (): TurnstileVerifier => app().get<symbol, TurnstileVerifier>(TURNSTILE);

describe('POST /public/demo-requests: a school or parent asks for a demo (spec 06, 19; D57)', () => {
  it('stores a school request as a new landing lead and queues the sales and confirmation emails', async () => {
    const browser = new Browser(app, undefined, 'Mozilla/5.0 (Sample)');
    const body = schoolRequest();

    const response = await browser.post(ROUTE, body);

    expect(response.statusCode).toBe(202);
    expect(response.body).toBe('');
    const [lead, ...others] = await leadsFor(body.email);
    expect(others).toEqual([]);
    expect(lead).toMatchObject({
      kind: 'school_demo',
      source: 'landing',
      status: 'new',
      name: 'Sample Person',
      email: body.email,
      school: 'Sample School',
      students_band: '300_1000',
      curriculum: 'ib',
      country: 'Portugal',
      city: null,
      note: null,
      user_agent: 'Mozilla/5.0 (Sample)',
      owner_platform_user_id: null,
      converted_tenant_id: null,
    });
    if (lead === undefined) throw new Error('no lead');
    const [sales, confirm, ...more] = jobsFor(lead.id);
    expect(more).toEqual([]);
    expect(sales?.jobId).toMatch(SALES_ID(lead.id));
    // The sales email gets the request as parsed, without the anti-spam fields.
    expect(sales?.job).toEqual({
      to: SALES_INBOX,
      tenantId: null,
      school: null,
      template: 'demo_request_sales',
      params: {
        kind: 'school',
        name: 'Sample Person',
        email: body.email,
        school: 'Sample School',
        country: 'Portugal',
        students: '300_1000',
        curriculum: 'ib',
        link: `http://localhost:3001/leads/${lead.id}`,
      },
    });
    // The confirmation carries only the kind: nothing the visitor typed.
    expect(confirm).toEqual({
      jobId: `demo-request.${lead.id}.confirm`,
      job: {
        to: body.email,
        tenantId: null,
        school: null,
        template: 'demo_request_confirmation',
        params: { kind: 'school' },
      },
    });
  });

  it('logs each stored lead with its id, whether it is new and its kind, and nothing personal', async () => {
    const browser = new Browser(app);
    const body = parentRequest();
    const before = logs.lines.length;

    expect((await browser.post(ROUTE, body)).statusCode).toBe(202);

    const [lead] = await leadsFor(body.email);
    if (lead === undefined) throw new Error('no lead');
    const lines = logs.lines.slice(before);
    expect(lines).toContainEqual(
      expect.objectContaining({ leadId: lead.id, created: true, kind: 'parent_intro' }),
    );
    const text = JSON.stringify(lines);
    for (const personal of [body.email, body.name, body.school, browser.ip]) {
      expect(text).not.toContain(personal);
    }
  });

  it('stores a parent request as a parent_intro lead with its city and note', async () => {
    const body = parentRequest();
    const queuedBefore = delivery.emails.length;

    const response = await new Browser(app).post(ROUTE, body);

    expect(response.statusCode).toBe(202);
    const [lead] = await leadsFor(body.email);
    expect(lead).toMatchObject({
      kind: 'parent_intro',
      source: 'landing',
      status: 'new',
      school: 'Sample School',
      city: 'Lisbon',
      note: 'Our school would love this.\nPlease get in touch.',
      students_band: null,
      curriculum: null,
      country: null,
    });
    if (lead === undefined) throw new Error('no lead');
    // Exactly two emails, to SALES_INBOX and to the parent; nothing to the school (OQ1).
    expect(delivery.emails.slice(queuedBefore)).toEqual(jobsFor(lead.id));
    expect(jobsFor(lead.id).map(({ job }) => [job.template, job.to])).toEqual([
      ['demo_request_sales', SALES_INBOX],
      ['demo_request_confirmation', body.email],
    ]);
    expect(jobsFor(lead.id)[1]?.job.params).toEqual({ kind: 'parent' });
  });

  it('stores the IP only as HMAC-SHA256 under the HKDF "quad lead ip" key, never the address', async () => {
    const browser = new Browser(app);
    const body = schoolRequest();
    const before = logs.lines.length;

    expect((await browser.post(ROUTE, body)).statusCode).toBe(202);

    const [lead] = await leadsFor(body.email);
    if (lead === undefined) throw new Error('no lead');
    expect(lead.ip_hash).toHaveLength(32);
    expect(lead.ip_hash.equals(expectedIpHash(browser.ip))).toBe(true);
    // The raw address is nowhere in the row (as text or bytes) nor in the request's logs.
    expect(JSON.stringify(lead)).not.toContain(browser.ip);
    expect(lead.ip_hash.includes(Buffer.from(browser.ip, 'utf8'))).toBe(false);
    const requestLogs = JSON.stringify(logs.lines.slice(before));
    expect(requestLogs).toContain('Request completed');
    expect(requestLogs).not.toContain(browser.ip);
  });

  it('cuts the user agent to 400 characters', async () => {
    const body = schoolRequest();
    const browser = new Browser(app, undefined, `Agent/${'x'.repeat(500)}`);

    expect((await browser.post(ROUTE, body)).statusCode).toBe(202);

    const [lead] = await leadsFor(body.email);
    expect(lead?.user_agent).toBe(`Agent/${'x'.repeat(394)}`);
  });

  it('stores no user agent when the header is blank', async () => {
    const body = parentRequest();

    const response = await new Browser(app).post(ROUTE, body, {
      headers: { 'user-agent': ' ' },
    });

    expect(response.statusCode).toBe(202);
    const [lead] = await leadsFor(body.email);
    expect(lead?.user_agent).toBeNull();
  });

  it('asks Turnstile with the token, the client IP and the demo-request action', async () => {
    const verify = vi.spyOn(turnstile(), 'verify');
    const browser = new Browser(app);

    expect((await browser.post(ROUTE, schoolRequest())).statusCode).toBe(202);

    expect(verify).toHaveBeenCalledExactlyOnceWith({
      token: TURNSTILE_DUMMY_TOKEN,
      remoteIp: browser.ip,
      action: 'demo-request',
    });
  });

  describe('validation', () => {
    it.each([
      [
        'a bad email',
        schoolRequest({ email: `not-an-address-${randomBytes(6).toString('hex')}` }),
        'email',
      ],
      ['a missing school', schoolRequest({ school: undefined }), 'school'],
      ['a parent with no school', parentRequest({ school: undefined }), 'school'],
      ['a missing Turnstile token', schoolRequest({ turnstileToken: undefined }), 'turnstileToken'],
      ['an unknown kind', schoolRequest({ kind: 'teacher' }), 'kind'],
    ])('answers 400 validation for %s, storing and sending nothing', async (_case, body, field) => {
      const verify = vi.spyOn(turnstile(), 'verify');
      const queuedBefore = delivery.emails.length;

      const response = await new Browser(app).post(ROUTE, body);

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        code: 'validation',
        fields: { [field]: expect.any(String) as unknown },
      });
      expect(verify).not.toHaveBeenCalled();
      expect(delivery.emails.length).toBe(queuedBefore);
      if (typeof body.email === 'string') expect(await leadsFor(body.email)).toEqual([]);
    });

    // A cross-site form can post text/plain without a preflight; the app refuses it everywhere
    // (D28 follow-up). No cookie is read here, so a forged post gains nothing a script could not
    // do itself; what stops one is the Turnstile token, which is bound to our hostname (D57).
    it('answers 415 for a text/plain post before counting or checking anything', async () => {
      const response = await app()
        .getHttpAdapter()
        .getInstance()
        .inject({
          method: 'POST',
          url: `/api/v1${ROUTE}`,
          remoteAddress: randomIp(),
          headers: { 'content-type': 'text/plain' },
          payload: JSON.stringify(schoolRequest()),
        });
      expect(response.statusCode).toBe(415);
    });
  });

  describe('captcha', () => {
    it('answers 400 captcha_failed for a refused token, with no lead and no email', async () => {
      const body = schoolRequest({ turnstileToken: 'fail' });
      const queuedBefore = delivery.emails.length;

      const response = await new Browser(app).post(ROUTE, body);

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: 'captcha_failed' });
      expect(await leadsFor(body.email)).toEqual([]);
      expect(delivery.emails.length).toBe(queuedBefore);
    });

    it('answers 503 captcha_unavailable when Cloudflare cannot answer (fail closed), with no lead and no email', async () => {
      const body = parentRequest({ turnstileToken: 'unavailable' });
      const queuedBefore = delivery.emails.length;
      const before = logs.lines.length;

      const response = await new Browser(app).post(ROUTE, body);

      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({ code: 'captcha_unavailable' });
      expect(await leadsFor(body.email)).toEqual([]);
      expect(delivery.emails.length).toBe(queuedBefore);
      expect(logs.lines.slice(before)).toContainEqual(
        expect.objectContaining({ metric: 'demo_request_captcha_unavailable' }),
      );
    });
  });

  describe('honeypot', () => {
    it('answers 202 to a filled website field without asking Turnstile, storing or sending anything', async () => {
      const verify = vi.spyOn(turnstile(), 'verify');
      const body = schoolRequest({ website: 'https://spam.example' });
      const queuedBefore = delivery.emails.length;
      const before = logs.lines.length;

      const response = await new Browser(app).post(ROUTE, body);

      expect(response.statusCode).toBe(202);
      expect(response.body).toBe('');
      expect(verify).not.toHaveBeenCalled();
      expect(await leadsFor(body.email)).toEqual([]);
      expect(delivery.emails.length).toBe(queuedBefore);
      const lines = logs.lines.slice(before);
      expect(lines).toContainEqual(expect.objectContaining({ metric: 'demo_request_honeypot' }));
      expect(JSON.stringify(lines)).not.toContain(body.email);
    });

    it('treats an empty website field as a person', async () => {
      const body = parentRequest({ website: '' });
      expect((await new Browser(app).post(ROUTE, body)).statusCode).toBe(202);
      expect(await leadsFor(body.email)).toHaveLength(1);
    });
  });

  describe('rate limits', () => {
    it('counts a refused captcha against the IP: after 5 fail tokens a valid 6th request gets 429', async () => {
      const browser = new Browser(app);
      for (let sent = 0; sent < 5; sent += 1) {
        const refused = await browser.post(ROUTE, schoolRequest({ turnstileToken: 'fail' }));
        expect(refused.statusCode).toBe(400);
        expect(refused.json()).toMatchObject({ code: 'captcha_failed' });
      }
      const sixth = schoolRequest();

      const limited = await browser.post(ROUTE, sixth);

      expect(limited.statusCode).toBe(429);
      expect(limited.json()).toMatchObject({ code: 'rate_limited' });
      expect(limited.headers['retry-after']).toBe(HOUR_RETRY_AFTER);
      expect(await leadsFor(sixth.email)).toEqual([]);
    });

    it('counts an email only once its captcha passes, so no one can use up a prospect’s requests', async () => {
      const email = freshEmail();
      for (let sent = 0; sent < 4; sent += 1) {
        const refused = await new Browser(app).post(
          ROUTE,
          schoolRequest({ email, turnstileToken: 'fail' }),
        );
        expect(refused.statusCode).toBe(400);
      }
      // A honeypot hit does not count either.
      expect(
        (await new Browser(app).post(ROUTE, schoolRequest({ email, website: 'x' }))).statusCode,
      ).toBe(202);

      const real = await new Browser(app).post(ROUTE, schoolRequest({ email }));

      expect(real.statusCode).toBe(202);
      expect(await leadsFor(email)).toHaveLength(1);
    });

    it('answers the 6th request in an hour from one IP with 429 rate_limited and Retry-After', async () => {
      const browser = new Browser(app);
      for (let sent = 0; sent < 5; sent += 1) {
        expect((await browser.post(ROUTE, schoolRequest())).statusCode).toBe(202);
      }
      const verify = vi.spyOn(turnstile(), 'verify');
      const sixth = schoolRequest();

      const limited = await browser.post(ROUTE, sixth);

      expect(limited.statusCode).toBe(429);
      expect(limited.json()).toMatchObject({ code: 'rate_limited' });
      expect(limited.headers['retry-after']).toBe(HOUR_RETRY_AFTER);
      expect(verify).not.toHaveBeenCalled();
      expect(await leadsFor(sixth.email)).toEqual([]);
      // Another address has its own bucket.
      expect((await new Browser(app).post(ROUTE, schoolRequest())).statusCode).toBe(202);
    });

    it('answers the 4th request in a day for one email with 429, from any IP', async () => {
      const email = freshEmail();
      for (let sent = 0; sent < 3; sent += 1) {
        expect((await new Browser(app).post(ROUTE, schoolRequest({ email }))).statusCode).toBe(202);
      }

      const verify = vi.spyOn(turnstile(), 'verify');
      const queuedBefore = delivery.emails.length;

      const limited = await new Browser(app).post(ROUTE, parentRequest({ email }));

      expect(limited.statusCode).toBe(429);
      expect(limited.json()).toMatchObject({ code: 'rate_limited' });
      expect(limited.headers['retry-after']).toBe(DAY_RETRY_AFTER);
      // Counted after the captcha (D57), and nothing is stored or sent.
      expect(verify).toHaveBeenCalledOnce();
      expect(await leadsFor(email)).toHaveLength(1);
      expect(delivery.emails.length).toBe(queuedBefore);
    });

    it('counts A@x.com and a@x.com (and padded or other-case spellings) as one email', async () => {
      const local = `lead-${randomBytes(6).toString('hex')}`;
      const spellings = [
        `${local.toUpperCase()}@EXAMPLE.TEST`,
        ` ${local}@Example.Test `,
        `${local[0]?.toUpperCase() ?? ''}${local.slice(1)}@example.test`,
      ];
      for (const email of spellings) {
        expect((await new Browser(app).post(ROUTE, schoolRequest({ email }))).statusCode).toBe(202);
      }

      const limited = await new Browser(app).post(
        ROUTE,
        schoolRequest({ email: `${local}@example.test` }),
      );

      expect(limited.statusCode).toBe(429);
      expect(limited.json()).toMatchObject({ code: 'rate_limited' });
    });
  });

  describe('a repeat within 24 hours (no lead enumeration)', () => {
    it('answers byte-identically, updates the one lead, and queues only another sales email', async () => {
      const email = freshEmail();
      const first = await new Browser(app).post(ROUTE, schoolRequest({ email }));
      const repeat = await new Browser(app).post(
        ROUTE,
        schoolRequest({ email, name: 'Sample Person Again', students: 'over_2500' }),
      );

      expect(repeat.statusCode).toBe(first.statusCode);
      expect(repeat.statusCode).toBe(202);
      expect(repeat.rawPayload.equals(first.rawPayload)).toBe(true);
      // Everything but the date and the request id, which differ for every response.
      const headersOf = (response: typeof first) =>
        Object.entries(response.headers).filter(
          ([name]) => !['date', 'x-request-id'].includes(name),
        );
      expect(headersOf(repeat)).toEqual(headersOf(first));

      const [lead, ...others] = await leadsFor(email);
      expect(others).toEqual([]);
      expect(lead).toMatchObject({ name: 'Sample Person Again', students_band: 'over_2500' });
      if (lead === undefined) throw new Error('no lead');
      const [firstSales, confirm, repeatSales, ...more] = jobsFor(lead.id).map(
        ({ jobId }) => jobId,
      );
      expect(more).toEqual([]);
      expect(confirm).toBe(`demo-request.${lead.id}.confirm`);
      expect(firstSales).toMatch(SALES_ID(lead.id));
      expect(repeatSales).toMatch(SALES_ID(lead.id));
      // A job id of its own, so BullMQ never drops the repeat as a duplicate of the first
      // sales email while that one is pending, retrying or kept as failed.
      expect(repeatSales).not.toBe(firstSales);
      expect(jobsFor(lead.id)[2]?.job.params).toMatchObject({
        name: 'Sample Person Again',
        students: 'over_2500',
      });
    });
  });

  describe('tenant-less (D16): nothing in the request picks a school', () => {
    it('opens no tenant, account, open or platform transaction', async () => {
      const tenantDb = app().get<symbol, QuadTenantDb>(TENANT_DB);
      const platformDb = app().get<symbol, QuadPlatformDb>(PLATFORM_DB);
      const spies = [
        vi.spyOn(tenantDb, 'withTenant'),
        vi.spyOn(tenantDb, 'withAccount'),
        vi.spyOn(tenantDb, 'withOpen'),
        vi.spyOn(platformDb, 'withPlatform'),
      ];
      const record = vi.spyOn(tenantDb.definers, 'recordDemoRequest');

      expect((await new Browser(app).post(ROUTE, schoolRequest())).statusCode).toBe(202);

      expect(record).toHaveBeenCalledOnce();
      for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    });

    it.each(['tenantId', 'tenant_id', 'schoolId', 'school_id', 'convertedTenantId'])(
      'refuses a body with %s as 400 validation',
      async (key) => {
        const body = schoolRequest({ [key]: '0192a6f4-1b2c-7d3e-8f40-123456789abd' });

        const response = await new Browser(app).post(ROUTE, body);

        expect(response.statusCode).toBe(400);
        expect(response.json()).toMatchObject({
          code: 'validation',
          fields: { _root: expect.any(String) as unknown },
        });
        expect(await leadsFor(body.email)).toEqual([]);
      },
    );

    it('needs no session, and a staff session changes nothing: no school reaches the lead or the emails', async () => {
      const school = await insertSchool(db());
      const { session } = await signedInMember(db(), school);
      const signedIn = schoolRequest();
      const anonymous = schoolRequest();

      const withSession = await new Browser(app).post(ROUTE, signedIn, {
        headers: sessionHeaders(session),
      });
      const without = await new Browser(app).post(ROUTE, anonymous);

      expect(withSession.statusCode).toBe(202);
      expect(withSession.rawPayload.equals(without.rawPayload)).toBe(true);
      const [lead] = await leadsFor(signedIn.email);
      expect(lead).toMatchObject({ converted_tenant_id: null, owner_platform_user_id: null });
      if (lead === undefined) throw new Error('no lead');
      const queued = jobsFor(lead.id);
      expect(queued).toHaveLength(2);
      expect(queued.map(({ job }) => job.tenantId)).toEqual([null, null]);
    });
  });
});
