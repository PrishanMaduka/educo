import { z } from 'zod';

/** Every record id is a UUID string. */
export const IdSchema = z.string().uuid();
export type Id = z.infer<typeof IdSchema>;
