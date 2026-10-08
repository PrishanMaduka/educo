import type { AuditAction, PlatformAuditAction } from '@quad/contracts';

export type { AuditAction, PlatformAuditAction };

/** What an audit entry is about (`audit_log.target_type`, `platform_audit.target_type`). */
export type AuditTargetType =
  'account' | 'audit_log' | 'role' | 'school' | 'session' | 'support_session' | 'tenant' | 'user';

export interface AuditTarget {
  readonly type: AuditTargetType;
  /** A record id, or null when the action has no single record. */
  readonly id: string | null;
}

/** A JSON value for `meta`: ids, codes and before/after values, never secrets or tokens. */
export type AuditJson =
  string | number | boolean | null | readonly AuditJson[] | { readonly [key: string]: AuditJson };

export type AuditMeta = Readonly<Record<string, AuditJson>>;
