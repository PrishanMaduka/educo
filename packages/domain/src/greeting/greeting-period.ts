export type GreetingPeriod = 'morning' | 'afternoon' | 'evening' | 'night';

export interface GreetingResult {
  period: GreetingPeriod;
  word: 'Good morning' | 'Good afternoon' | 'Good evening' | 'Hello';
}

export function greetingPeriod(now: Date, timeZone: string): GreetingResult {
  // Get local hour using Intl.DateTimeFormat
  // This will throw RangeError if timeZone is invalid
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    hour: '2-digit',
  });

  const parts = formatter.formatToParts(now);
  const hourPart = parts.find((p) => p.type === 'hour');
  // Formatter explicitly requests hour, so this should always be present
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const hour = parseInt(hourPart!.value, 10);

  // Determine period based on hour
  let period: GreetingPeriod;
  let word: GreetingResult['word'];

  if (hour >= 5 && hour < 12) {
    // 05:00 - 11:59
    period = 'morning';
    word = 'Good morning';
  } else if (hour >= 12 && hour < 17) {
    // 12:00 - 16:59
    period = 'afternoon';
    word = 'Good afternoon';
  } else if (hour >= 17 && hour < 20) {
    // 17:00 - 19:59
    period = 'evening';
    word = 'Good evening';
  } else if (hour >= 20) {
    // 20:00 - 23:59
    period = 'night';
    word = 'Good evening';
  } else {
    // 00:00 - 04:59
    period = 'night';
    word = 'Hello';
  }

  return { period, word };
}
