import type { NewTenant } from './schema';
import type {
  MembershipKind,
  PlanModule,
  PlatformRole,
  RoleScope,
  SystemRoleKey,
  TwoStepRule,
} from '@quad/contracts';

/**
 * The sample schools every environment except production starts with. Ids are fixed so tests,
 * fixtures and links can refer to them.
 */
export const SEED_TENANTS = {
  colomboIntl: {
    id: '01926f00-0000-7000-8000-000000000001',
    name: 'Colombo International School',
    shortName: 'CIS',
    slug: 'colombo-intl',
    country: 'LK',
    region: 'ap-south',
    timeZone: 'Asia/Colombo',
    currency: 'LKR',
    locale: 'en-LK',
    status: 'active',
    since: '2024-01-01',
  },
  kandyHill: {
    id: '01926f00-0000-7000-8000-000000000002',
    name: 'Kandy Hill Academy',
    shortName: 'KHA',
    slug: 'kandy-hill',
    country: 'LK',
    region: 'ap-south',
    timeZone: 'Asia/Colombo',
    currency: 'LKR',
    locale: 'en-LK',
    status: 'active',
    since: '2024-06-01',
  },
} as const satisfies Record<string, NewTenant & { id: string }>;

export type SeedSchool = keyof typeof SEED_TENANTS;

/** What Quad manages for each seed school: brand colour, plan modules and two-step rule. */
export const SEED_SCHOOL_ACCESS = {
  colomboIntl: {
    brandColor: '#DD4A42',
    modules: ['admissions', 'crm', 'sis', 'lms', 'fees', 'finance', 'parent', 'transport'],
    twoStep: 'staff',
  },
  kandyHill: {
    brandColor: '#2BB0A0',
    modules: ['admissions', 'crm', 'sis', 'lms', 'fees', 'finance', 'parent'],
    twoStep: 'admins',
  },
} as const satisfies Record<
  SeedSchool,
  {
    readonly brandColor: string;
    readonly modules: readonly PlanModule[];
    readonly twoStep: TwoStepRule;
  }
>;

/**
 * The seven system roles every school has (spec 05, School roles), named as the prototype's role
 * list names them. Their permissions are the fixed defaults in `packages/domain`
 * (`systemRoleMatrix`), never stored rows; the scope here must match it (the API's
 * `seed-data.test.ts` checks).
 */
export const SEED_SYSTEM_ROLES = {
  admin: { name: 'School admin', scope: 'school' },
  principal: { name: 'Principal', scope: 'school' },
  finance: { name: 'Finance officer', scope: 'school' },
  admissions: { name: 'Admissions officer', scope: 'school' },
  teacher: { name: 'Teacher', scope: 'own_classes' },
  counsellor: { name: 'Counsellor', scope: 'school' },
  frontdesk: { name: 'Front desk', scope: 'school' },
} as const satisfies Record<SystemRoleKey, { readonly name: string; readonly scope: RoleScope }>;

/** Quad staff who sign in to the console: email, password (`SEED_PASSWORD`) and TOTP (D37). */
export const SEED_PLATFORM_USERS = {
  owner: {
    id: '01926f00-0000-7000-8000-000000000301',
    name: 'Nora Lindqvist',
    email: 'owner@quad.local',
    role: 'owner',
  },
  support: {
    id: '01926f00-0000-7000-8000-000000000302',
    name: 'Amal Gunawardena',
    email: 'support@quad.local',
    role: 'support',
  },
} as const satisfies Record<
  string,
  {
    readonly id: string;
    readonly name: string;
    readonly email: string;
    readonly role: PlatformRole;
  }
>;

/** One seeded membership: the school, its fixed `users.id`, its kind and its system roles. */
export interface SeedMembership {
  readonly school: SeedSchool;
  readonly userId: string;
  readonly kind: MembershipKind;
  /** The primary role first. */
  readonly roles: readonly SystemRoleKey[];
}

/** One seeded person: the global account and its memberships (fictional prototype people). */
export interface SeedPerson {
  readonly accountId: string;
  readonly name: string;
  readonly email?: string;
  readonly phoneE164?: string;
  /**
   * Staff sign in with `SEED_PASSWORD` and an authenticator (the local fixed code `000000` passes
   * it); a parent signs in with a one-time code only.
   */
  readonly staff: boolean;
  readonly memberships: readonly SeedMembership[];
}

/**
 * The sample people of CLAUDE.md "Seeded local accounts", with fixed ids. Role names are shown,
 * not job titles: "Teacher · Mathematics" and "Head of Mathematics" arrive with M3.
 */
export const SEED_PEOPLE = {
  prishan: {
    accountId: '01926f00-0000-7000-8000-000000000101',
    name: 'Prishan Maduka',
    email: 'prishan.maduka@colombo-intl.local',
    staff: true,
    memberships: [
      {
        school: 'colomboIntl',
        userId: '01926f00-0000-7000-8000-000000000201',
        kind: 'staff',
        roles: ['admin'],
      },
    ],
  },
  nadeesha: {
    accountId: '01926f00-0000-7000-8000-000000000102',
    name: 'Nadeesha Jayasinghe',
    email: 'nadeesha.jayasinghe@colombo-intl.local',
    staff: true,
    memberships: [
      {
        school: 'colomboIntl',
        userId: '01926f00-0000-7000-8000-000000000202',
        kind: 'staff',
        roles: ['teacher'],
      },
    ],
  },
  ruwan: {
    accountId: '01926f00-0000-7000-8000-000000000103',
    name: 'Ruwan Mendis',
    email: 'ruwan.mendis@quad.local',
    staff: true,
    memberships: [
      {
        school: 'colomboIntl',
        userId: '01926f00-0000-7000-8000-000000000203',
        kind: 'staff',
        roles: ['teacher'],
      },
      {
        school: 'kandyHill',
        userId: '01926f00-0000-7000-8000-000000000204',
        kind: 'staff',
        roles: ['teacher'],
      },
    ],
  },
  dilini: {
    accountId: '01926f00-0000-7000-8000-000000000104',
    name: 'Dilini Fernando',
    email: 'dilini.fernando@colombo-intl.local',
    staff: true,
    memberships: [
      {
        school: 'colomboIntl',
        userId: '01926f00-0000-7000-8000-000000000205',
        kind: 'staff',
        roles: ['finance'],
      },
    ],
  },
  dilhani: {
    accountId: '01926f00-0000-7000-8000-000000000105',
    name: 'Dilhani Perera',
    phoneE164: '+94770000001',
    staff: false,
    memberships: [
      {
        school: 'colomboIntl',
        userId: '01926f00-0000-7000-8000-000000000206',
        kind: 'guardian',
        roles: [],
      },
    ],
  },
} as const satisfies Record<string, SeedPerson>;
