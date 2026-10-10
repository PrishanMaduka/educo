/** The When filter's choices on the audit logs (D49): today and the last 7, 30 and 90 days. */
export const DAY_RANGES = ['today', 'last7', 'last30', 'last90'] as const;
export type DayRange = (typeof DAY_RANGES)[number];

/** How many days each range covers, today included. */
const DAYS: Readonly<Record<DayRange, number>> = { today: 1, last7: 7, last30: 30, last90: 90 };

const MINUTE = 60_000;

/** The calendar date `instant` falls on in `timeZone`. */
function localDate(instant: Date, timeZone: string): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((entry) => entry.type === type)?.value);
  return { year: part('year'), month: part('month'), day: part('day') };
}

/** How far `timeZone` is ahead of UTC at `instant`, in minutes. */
function offsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((entry) => entry.type === type)?.value);
  const asUtc = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second'),
  );
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / MINUTE);
}

/**
 * The `from` of an audit query for a range: the UTC instant of midnight in `timeZone` at the start
 * of its first day (spec 06: the web apps work out instants from local dates; the portal uses the
 * school's zone, the console the browser's). The
 * offset is read twice, so a clock change between UTC and local midnight lands on the right hour.
 */
export function dayRangeFrom(range: DayRange, now: Date, timeZone: string): string {
  const today = localDate(now, timeZone);
  const midnightAsUtc = Date.UTC(today.year, today.month - 1, today.day - (DAYS[range] - 1));
  let instant = midnightAsUtc - offsetMinutes(new Date(midnightAsUtc), timeZone) * MINUTE;
  instant = midnightAsUtc - offsetMinutes(new Date(instant), timeZone) * MINUTE;
  return new Date(instant).toISOString();
}
