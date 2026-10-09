import { z } from 'zod';

/**
 * Error codes from spec 06 (Conventions), plus `internal` for the 500 the API returns when
 * something unexpected fails (the cause is logged, never sent to the client), and these from
 * spec 05 (D32): `invalid_link` (400) for any signed link that is refused, `invalid_credentials`
 * (401) for a wrong email or password, `account_locked` (403) after the lockout rule,
 * `invalid_code` (400) for a wrong two-step or recovery code, `two_step_required` (403) and
 * `preview_read_only` (403, Task 12) for a write while previewing a role.
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
  'invalid_credentials',
  'account_locked',
  'invalid_code',
  'two_step_required',
  'preview_read_only',
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
