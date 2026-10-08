import { z } from 'zod';

/**
 * Error codes from spec 06 (Conventions), plus `internal` for the 500 the API returns when
 * something unexpected fails (the cause is logged, never sent to the client), and
 * `invalid_link` (400) for any signed link that is refused (spec 05; D32).
 */
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
  'invalid_link',
  'rate_limited',
  'internal',
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ErrorBodySchema = z.object({
  code: z.string(),
  message: z.string(),
  fields: z.record(z.string(), z.string()).optional(),
});
export type ErrorBody = z.infer<typeof ErrorBodySchema>;
