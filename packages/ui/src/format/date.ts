export type DateStyle = 'short' | 'long' | 'weekday';

const LOCALE = 'en-GB';

/** Formats a date in the school's time zone: "5 Oct", "5 October 2026" or "Monday 5 October". */
export function formatDate(date: Date | string, timeZone: string, style: DateStyle): string {
  const value = typeof date === 'string' ? new Date(date) : date;
  const options: Intl.DateTimeFormatOptions =
    style === 'short'
      ? { day: 'numeric', month: 'short' }
      : style === 'long'
        ? { day: 'numeric', month: 'long', year: 'numeric' }
        : { weekday: 'long', day: 'numeric', month: 'long' };
  const parts = new Intl.DateTimeFormat(LOCALE, { ...options, timeZone }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '';
  return [get('weekday'), get('day'), get('month'), get('year')].filter(Boolean).join(' ');
}
