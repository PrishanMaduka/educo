import type { Money } from '@quad/ui';

/*
 * Sample records for the style guide. They stand in for data the API returns (names, classes, amounts),
 * so they are data, not copy, and do not belong in en.json.
 */
export const SAMPLE_TIME_ZONE = 'Asia/Colombo';

/** A fixed date, so the style guide renders the same on the server and in the browser. */
export const SAMPLE_DATE = new Date('2026-10-07T04:30:00Z');

export const SAMPLE_STUDENTS = [
  {
    id: 'st-1',
    name: 'Amaya Perera',
    className: '7B',
    due: { amountMinor: 4_500_000, currency: 'LKR' },
  },
  { id: 'st-2', name: 'Kavin Fernando', className: '7B', due: { amountMinor: 0, currency: 'LKR' } },
  {
    id: 'st-3',
    name: 'Nethmi Silva',
    className: '8A',
    due: { amountMinor: 1_250_000, currency: 'LKR' },
  },
] as const satisfies readonly { id: string; name: string; className: string; due: Money }[];

export type SampleStudent = (typeof SAMPLE_STUDENTS)[number];

export const SAMPLE_CLASSES = ['7A', '7B', '8A', '8B'] as const;

export const SAMPLE_COLLECTED: Money = { amountMinor: 420_000_000, currency: 'LKR' };
export const SAMPLE_OUTSTANDING: Money = { amountMinor: 78_000_000, currency: 'LKR' };

export const SAMPLE_TREND = [88, 90, 89, 91, 92, 91, 93, 94] as const;

export const SAMPLE_KPI_VALUE = '94%';
