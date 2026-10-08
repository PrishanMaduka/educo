import { z } from 'zod';

/** An instant in a response: ISO 8601 in UTC (`…Z`), spec 06 Conventions. */
export const IsoDateTimeSchema = z.string().datetime();
export type IsoDateTime = z.infer<typeof IsoDateTimeSchema>;
