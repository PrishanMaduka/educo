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

/**
 * An address the email queue and a mail header can take (`EmailJobSchema.to`). Stricter than the
 * demo form's check, which lets through `josé@…`, `x<a@b.co>` and quoted forms.
 */
export const SendableAddress = z.string().email().max(320);

/** One line a visitor typed (a name, a school): never a line break, so it can sit in a subject. */
export const TypedLine = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[^\r\n\u2028\u2029]*$/, { message: 'must be one line' });
/** A note a visitor typed: line breaks allowed. */
export const TypedNote = z.string().trim().min(1).max(1000);
