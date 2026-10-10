import { describe, expect, it } from 'vitest';

import {
  Greeting,
  GreetingPeriod,
  IsoDateTimeSchema,
  Me,
  MeUpdateInput,
  SessionIdParams,
  SessionSummary,
  SessionSummaryList,
} from '../index';

const SCHOOL_ID = '0192a6f4-1b2c-7d3e-8f40-123456789abc';
const ROLE_ID = '0192a6f4-1b2c-7d3e-8f40-123456789abd';

const me = {
  person: {
    name: 'Prishan Maduka',
    firstName: 'Prishan',
    theme: 'system',
    locale: 'en-LK',
    roleNames: ['School admin'],
  },
  school: {
    id: SCHOOL_ID,
    name: 'Colombo International School',
    shortName: 'CIS',
    timeZone: 'Asia/Colombo',
    brand: {
      color: '#1F6F5C',
      light: {
        fill: '#1F6F5C',
        fillStrong: '#1B5F4F',
        ink: '#FFFFFF',
        text: '#1F6F5C',
        soft: '#DBE8E5',
        railActive: '#23725F',
        railActiveInk: '#FFFFFF',
      },
      dark: {
        fill: '#2C7866',
        fillStrong: '#266758',
        ink: '#FFFFFF',
        text: '#699F92',
        soft: '#192D4A',
        railActive: '#1F6F5C',
        railActiveInk: '#FFFFFF',
      },
    },
  },
  memberships: [
    {
      tenantId: ROLE_ID,
      name: 'Kandy Hills College',
      shortName: 'KHC',
      brandColor: null,
      roleNames: ['Teacher'],
      suspended: false,
    },
  ],
  preview: null,
  support: null,
  greeting: { period: 'morning', word: 'Good morning' },
};

const pathOf = (result: { success: boolean; error?: { issues: { path: unknown[] }[] } }) =>
  result.error?.issues[0]?.path;

describe('Me', () => {
  it('accepts the signed-in person, their school and the greeting', () => {
    expect(Me.safeParse(me).success).toBe(true);
  });

  it('needs the person’s role names in this school (the profile menu and no-access page)', () => {
    const person: Partial<typeof me.person> = { ...me.person };
    delete person.roleNames;
    expect(pathOf(Me.safeParse({ ...me, person }))).toEqual(['person', 'roleNames']);
  });

  it('accepts the preview and support banners', () => {
    const banners = {
      ...me,
      preview: {
        roleId: ROLE_ID,
        roleName: 'Teacher',
        sampleUser: { id: SCHOOL_ID, name: 'Nadeesha Jayasinghe' },
      },
      support: { schoolName: 'Colombo International School', platformUserName: 'Ruwan Mendis' },
    };
    expect(Me.safeParse(banners).success).toBe(true);
  });

  it('refuses a brand colour that is not a hex colour, at its path', () => {
    const result = Me.safeParse({
      ...me,
      school: {
        ...me.school,
        brand: { ...me.school.brand, light: { ...me.school.brand.light, fill: 'teal' } },
      },
    });
    expect(result.success).toBe(false);
    expect(pathOf(result)).toEqual(['school', 'brand', 'light', 'fill']);
  });

  it('refuses an unknown greeting period', () => {
    const result = Me.safeParse({ ...me, greeting: { period: 'noon', word: 'Hello' } });
    expect(pathOf(result)).toEqual(['greeting', 'period']);
  });
});

describe('GreetingPeriod and Greeting', () => {
  it('has the four bands of spec 03', () => {
    expect(GreetingPeriod.options).toEqual(['morning', 'afternoon', 'evening', 'night']);
  });

  it('pairs a period with one of the greeting words', () => {
    expect(Greeting.safeParse({ period: 'night', word: 'Good evening' }).success).toBe(true);
    expect(pathOf(Greeting.safeParse({ period: 'night', word: 'Good night' }))).toEqual(['word']);
  });
});

describe('MeUpdateInput', () => {
  it('accepts a name, a theme and a locale, and trims the name', () => {
    const parsed = MeUpdateInput.parse({ name: '  Prishan  ', theme: 'dark', locale: 'si-LK' });
    expect(parsed).toEqual({ name: 'Prishan', theme: 'dark', locale: 'si-LK' });
  });

  it('accepts a null locale, which means the school’s locale', () => {
    expect(MeUpdateInput.safeParse({ locale: null }).success).toBe(true);
  });

  it.each([
    [{ theme: 'sepia' }, ['theme']],
    [{ name: '   ' }, ['name']],
    [{ name: 'x'.repeat(121) }, ['name']],
    [{ locale: 'not a locale!' }, ['locale']],
    [{}, []],
  ])('refuses %j at %j', (input, path) => {
    const result = MeUpdateInput.safeParse(input);
    expect(result.success).toBe(false);
    expect(pathOf(result)).toEqual(path);
  });
});

describe('SessionSummary', () => {
  const summary = {
    id: SCHOOL_ID,
    kind: 'web',
    deviceName: null,
    userAgent: 'Mozilla/5.0',
    createdAt: '2026-10-08T03:30:00.000Z',
    lastSeenAt: '2026-10-08T04:00:00.000Z',
    current: true,
  };

  it('accepts one of the person’s own signed-in devices', () => {
    expect(SessionSummary.safeParse(summary).success).toBe(true);
    expect(SessionSummaryList.safeParse({ items: [summary], nextCursor: null }).success).toBe(true);
  });

  it('refuses a console session and a time that is not UTC ISO 8601', () => {
    expect(pathOf(SessionSummary.safeParse({ ...summary, kind: 'console' }))).toEqual(['kind']);
    expect(pathOf(SessionSummary.safeParse({ ...summary, lastSeenAt: 'yesterday' }))).toEqual([
      'lastSeenAt',
    ]);
  });

  it('takes a uuid session id in the path', () => {
    expect(SessionIdParams.safeParse({ id: SCHOOL_ID }).success).toBe(true);
    expect(pathOf(SessionIdParams.safeParse({ id: 'abc' }))).toEqual(['id']);
  });
});

describe('IsoDateTimeSchema', () => {
  it('accepts UTC instants only', () => {
    expect(IsoDateTimeSchema.safeParse('2026-10-08T03:30:00Z').success).toBe(true);
    expect(IsoDateTimeSchema.safeParse('2026-10-08T09:00:00+05:30').success).toBe(false);
  });
});
