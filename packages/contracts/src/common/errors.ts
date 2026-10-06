import { z } from 'zod';

/** Error codes from spec 06 (Conventions). */
export const ErrorCode = z.enum([
  'validation',
  'unauthorized',
  'forbidden',
  'module_not_in_plan',
  'school_suspended',
  'not_found',
  'conflict',
  'seat_limit',
  'slot_taken',
  'clash',
  'in_use',
  'business_rule',
  'app_update_required',
  'rate_limited',
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ErrorBodySchema = z.object({
  code: z.string(),
  message: z.string(),
  fields: z.record(z.string(), z.string()).optional(),
});
export type ErrorBody = z.infer<typeof ErrorBodySchema>;
