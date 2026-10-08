import type { NewTenant } from './schema';

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
