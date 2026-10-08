import { z } from 'zod';

/**
 * The greeting band for the time of day in the school's time zone (spec 03, the greeting
 * section). `greetingPeriod` in `@quad/domain` computes it and the API returns it in `GET /me`;
 * `GreetingScene` in `@quad/ui` draws one scene per band.
 */
export const GreetingPeriod = z.enum(['morning', 'afternoon', 'evening', 'night']);
export type GreetingPeriod = z.infer<typeof GreetingPeriod>;

/** The words shown with each band ("Hello" before 05:00). */
export const GreetingWord = z.enum(['Good morning', 'Good afternoon', 'Good evening', 'Hello']);
export type GreetingWord = z.infer<typeof GreetingWord>;

export const Greeting = z.object({ period: GreetingPeriod, word: GreetingWord });
export type Greeting = z.infer<typeof Greeting>;
