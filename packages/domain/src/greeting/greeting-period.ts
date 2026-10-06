export type GreetingPeriod = 'morning' | 'afternoon' | 'evening' | 'night';

export interface GreetingResult {
  period: GreetingPeriod;
  word: 'Good morning' | 'Good afternoon' | 'Good evening' | 'Hello';
}

export function greetingPeriod(now: Date, timeZone: string): GreetingResult {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(now),
  );

  if (hour >= 5 && hour < 12) {
    return { period: 'morning', word: 'Good morning' };
  }

  if (hour >= 12 && hour < 17) {
    return { period: 'afternoon', word: 'Good afternoon' };
  }

  if (hour >= 17 && hour < 20) {
    return { period: 'evening', word: 'Good evening' };
  }

  if (hour >= 20) {
    return { period: 'night', word: 'Good evening' };
  }

  return { period: 'night', word: 'Hello' };
}
