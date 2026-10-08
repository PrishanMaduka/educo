import { z } from 'zod';

/** A person's name as it appears in a greeting or a sentence. */
export const PersonName = z.string().trim().min(1).max(100);
/** A link into the web app; `defineEmailTemplate` also checks its origin. */
export const Link = z.string().url().max(2048);
/** A positive whole number of days, minutes or attempts. */
export const Count = z.number().int().positive().max(10_000);
/** A one-time code: six digits (spec 05). */
export const OneTimeCode = z.string().regex(/^\d{6}$/, { message: 'must be six digits' });

/** An IANA time zone name the runtime knows (`Asia/Colombo`). */
export const TimeZone = z.string().refine(
  (zone) => {
    try {
      new Intl.DateTimeFormat('en-GB', { timeZone: zone });
      return true;
    } catch {
      return false;
    }
  },
  { message: 'must be an IANA time zone' },
);
