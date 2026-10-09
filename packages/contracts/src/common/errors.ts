import { z } from 'zod';

/**
 * Error codes from spec 06 (Conventions), plus `internal` for the 500 the API returns when
 * something unexpected fails (the cause is logged, never sent to the client), and these from
 * spec 05 (D32): `invalid_link` (400) for any signed link that is refused, `invalid_credentials`
 * (401) for a wrong email or password, `account_locked` (403) after the lockout rule,
 * `invalid_code` (400) for a wrong two-step or recovery code, `two_step_required` (403) and
 * `preview_read_only` (403, Task 12) for a write while previewing a role, and `unavailable` (503)
 * when sign-in cannot reach the lockout counter (it fails closed). Users & roles (Task 13) adds
 * three business-rule codes (422): `last_admin` (the school's last active admin cannot be demoted
 * or deactivated), `system_role_locked` (a system role cannot be changed or deleted) and
 * `already_member` (an invited address already belongs to a member of the school), and, from
 * fix round 1, `own_role_locked` (nobody changes a role they hold themselves). Task 15 adds
 * `family_member` (422): an invited address belongs to a guardian or relative of the school,
 * whose one membership there can never become staff.
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
  'last_admin',
  'system_role_locked',
  'already_member',
  'own_role_locked',
  'family_member',
  'app_update_required',
  'invalid_link',
  'invalid_credentials',
  'account_locked',
  'invalid_code',
  'two_step_required',
  'preview_read_only',
  'rate_limited',
  'unavailable',
  'internal',
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ErrorBodySchema = z.object({
  code: z.string(),
  message: z.string(),
  fields: z.record(z.string(), z.string()).optional(),
});
export type ErrorBody = z.infer<typeof ErrorBodySchema>;
