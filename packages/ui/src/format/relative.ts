import { formatDate } from './date';

const LOCALE = 'en-GB';
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * How long ago something happened, for "last active" and "invite sent": "now", "10 minutes ago",
 * "yesterday", "6 days ago", then the date in the school's time zone ("1 Oct"). `now` is passed
 * in, never read from the clock here.
 */
export function formatRelative(date: Date | string, now: Date, timeZone: string): string {
  const at = typeof date === 'string' ? new Date(date) : date;
  const elapsed = Math.max(0, now.getTime() - at.getTime());
  if (elapsed >= 7 * DAY) return formatDate(at, timeZone, 'short');
  const words = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });
  if (elapsed < MINUTE) return words.format(0, 'second');
  if (elapsed < HOUR) return words.format(-Math.floor(elapsed / MINUTE), 'minute');
  if (elapsed < DAY) return words.format(-Math.floor(elapsed / HOUR), 'hour');
  return words.format(-Math.floor(elapsed / DAY), 'day');
}
