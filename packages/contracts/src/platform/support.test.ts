import { describe, expect, it } from 'vitest';

import {
  PlatformTenant,
  PlatformTenantList,
  PlatformTenantListQuery,
  SUPPORT_REASON_MAX,
  SUPPORT_REASON_MIN,
  SupportSessionCreateInput,
  SupportSessionExit,
  SupportSessionLink,
  SupportSessionRedeemInput,
  TenantIdParams,
} from '../index';

const ID = '018f6b3a-0000-7000-8000-000000000001';

const pathOf = (result: { success: boolean; error?: { issues: { path: unknown[] }[] } }) =>
  result.error?.issues[0]?.path;

describe('SupportSessionCreateInput (POST /platform/tenants/:id/support-session)', () => {
  it('takes a reason of 10 to 500 characters, trimmed', () => {
    expect(SUPPORT_REASON_MIN).toBe(10);
    expect(SUPPORT_REASON_MAX).toBe(500);
    expect(SupportSessionCreateInput.parse({ reason: '  Fixing the timetable import  ' })).toEqual({
      reason: 'Fixing the timetable import',
    });
    expect(SupportSessionCreateInput.parse({ reason: 'x'.repeat(500) }).reason).toHaveLength(500);
  });

  it.each([
    [{}, ['reason']],
    [{ reason: '' }, ['reason']],
    [{ reason: 'too short' }, ['reason']],
    [{ reason: `   ${'x'.repeat(9)}   ` }, ['reason']],
    [{ reason: 'x'.repeat(501) }, ['reason']],
    [{ reason: 42 }, ['reason']],
    [{ reason: 'A good reason here', tenantId: ID }, []],
  ])('refuses %j at %j', (input, path) => {
    expect(pathOf(SupportSessionCreateInput.safeParse(input))).toEqual(path);
  });

  it('keeps line breaks in the reason', () => {
    expect(SupportSessionCreateInput.parse({ reason: 'Line one here\nline two' }).reason).toBe(
      'Line one here\nline two',
    );
  });

  it.each(['\u0000', '\t', '\r', '\u001b', '\u007f', '\u0085', '\u009f'])(
    'refuses the control character %j inside the reason',
    (control) => {
      const result = SupportSessionCreateInput.safeParse({ reason: `A good${control}reason here` });
      expect(pathOf(result)).toEqual(['reason']);
    },
  );

  it.each([
    ['U+202E right-to-left override', '\u202e'],
    ['U+2066 left-to-right isolate', '\u2066'],
    ['U+200B zero-width space', '\u200b'],
    ['U+2060 word joiner', '\u2060'],
    ['U+FEFF byte order mark', '\ufeff'],
    ['U+00AD soft hyphen', '\u00ad'],
    // Unicode tag characters spell subdivision flags (England: U+1F3F4 then gbeng and the cancel tag).
    [
      'the tag characters of a subdivision flag',
      '\u{1f3f4}\u{e0067}\u{e0062}\u{e0065}\u{e006e}\u{e0067}\u{e007f}',
    ],
  ])('refuses the invisible format character %s inside the reason', (_name, format) => {
    const result = SupportSessionCreateInput.safeParse({ reason: `A good${format}reason here` });
    expect(pathOf(result)).toEqual(['reason']);
  });

  it('keeps the zero-width joiner and non-joiner that Sinhala and Tamil words need', () => {
    // "ශ්‍රී ලංකාව" (Sri Lanka) spells its rakaransaya with U+200D.
    const reason =
      'Help for \u0dc1\u0dca\u200d\u0dbb\u0dd3 \u0dbd\u0d82\u0d9a\u0dcf\u0dc0 and a\u200cb';
    expect(SupportSessionCreateInput.parse({ reason }).reason).toBe(reason);
  });

  it('answers with the single-use link into the staff portal', () => {
    expect(SupportSessionLink.parse({ url: 'https://quad-edu.com/sign-in/support/a.b' })).toEqual({
      url: 'https://quad-edu.com/sign-in/support/a.b',
    });
    expect(SupportSessionLink.safeParse({ url: 'not a url' }).success).toBe(false);
  });

  it('names the school by id in the path', () => {
    expect(TenantIdParams.parse({ id: ID })).toEqual({ id: ID });
    expect(pathOf(TenantIdParams.safeParse({ id: 'colombo-intl' }))).toEqual(['id']);
  });
});

describe('SupportSessionRedeemInput and SupportSessionExit (staff portal)', () => {
  it('takes the signed link token in the body', () => {
    expect(SupportSessionRedeemInput.parse({ token: 'a.b' })).toEqual({ token: 'a.b' });
  });

  it.each([
    [{}, ['token']],
    [{ token: '' }, ['token']],
    [{ token: 'x'.repeat(2049) }, ['token']],
    [{ token: 'a.b', tenantId: ID }, []],
  ])('refuses %j at %j', (input, path) => {
    expect(pathOf(SupportSessionRedeemInput.safeParse(input))).toEqual(path);
  });

  it('exits to the console', () => {
    expect(SupportSessionExit.parse({ redirect: 'https://console.quad-edu.com' })).toEqual({
      redirect: 'https://console.quad-edu.com',
    });
  });
});

describe('PlatformTenant (GET /platform/tenants)', () => {
  const tenant = {
    id: ID,
    name: 'Colombo International School',
    shortName: 'CIS',
    status: 'active',
    brandColor: '#1F3A5F',
  };

  it('lists a school with its id, names, status and colour (or none)', () => {
    expect(PlatformTenant.parse(tenant)).toEqual(tenant);
    expect(PlatformTenant.parse({ ...tenant, brandColor: null }).brandColor).toBeNull();
    expect(PlatformTenantList.parse({ items: [tenant], nextCursor: null }).items).toHaveLength(1);
  });

  it.each([
    [{ ...tenant, status: 'gone' }, ['status']],
    [{ ...tenant, brandColor: 'navy' }, ['brandColor']],
  ])('refuses %j at %j', (input, path) => {
    expect(pathOf(PlatformTenant.safeParse(input))).toEqual(path);
  });

  it('pages with a cursor and a limit of at most 200', () => {
    expect(PlatformTenantListQuery.parse({})).toEqual({ limit: 50 });
    expect(pathOf(PlatformTenantListQuery.safeParse({ limit: '201' }))).toEqual(['limit']);
  });
});
