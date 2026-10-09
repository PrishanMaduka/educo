import { z } from 'zod';

/**
 * What a school's audit log records (`audit_log.action`, spec 05 → Audit): stable `area.verb`
 * keys, written only through the API's `AuditService`. Add keys; never rename one, because
 * stored rows and filters use them.
 */
export const AuditAction = z.enum([
  'auth.sign_in',
  'auth.sign_in_failed',
  'auth.sign_out',
  'auth.password_reset',
  'auth.two_step_enabled',
  'user.invited',
  'user.role_changed',
  'user.deactivated',
  'user.reactivated',
  'user.two_step_reminded',
  'user.password_reset_sent',
  'user.signed_out_everywhere',
  'role.created',
  'role.updated',
  'role.deleted',
  'role.permissions_changed',
  'role_preview.started',
  'role_preview.ended',
  'settings.updated',
  'support_session.started',
  'support_session.ended',
  'audit.exported',
]);
export type AuditAction = z.infer<typeof AuditAction>;

/**
 * What Quad staff do, recorded in `platform_audit` (spec 05 → Audit) through the API's
 * `PlatformAuditService`, or by the definers that write it themselves: `tenant.renamed`
 * (`update_current_tenant_name`) and `support_session.ended` (`end_support_session`). In a
 * support visit, `record_support_audit` also copies the school's `AuditAction` there (dual audit).
 */
export const PlatformAuditAction = z.enum([
  'tenant.renamed',
  'support_session.started',
  'support_session.ended',
]);
export type PlatformAuditAction = z.infer<typeof PlatformAuditAction>;
