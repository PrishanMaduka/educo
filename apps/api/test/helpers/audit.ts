import { randomUUID } from 'node:crypto';

import type { TestDatabase } from '@quad/db/testing';

/**
 * Arranges audit entries for the audit log tests with plain SQL through `quad_platform` (the
 * arrangement step only; the API under test reads them as `quad_app`). `at` is text, so a test
 * can place entries in the same millisecond, a microsecond apart.
 */

export interface AuditRowSeed {
  readonly tenantId: string;
  readonly action: string;
  readonly at: string;
  readonly actorUserId?: string | null;
  readonly actorPlatformUserId?: string | null;
  readonly supportSessionId?: string | null;
  readonly targetType?: string | null;
  readonly targetId?: string | null;
  readonly meta?: Record<string, unknown>;
  readonly ip?: string | null;
}

/** One `audit_log` entry; returns its id. */
export async function insertAuditRow(db: TestDatabase, seed: AuditRowSeed): Promise<string> {
  const id = randomUUID();
  await db.platform.query(
    `insert into audit_log (id, tenant_id, actor_user_id, actor_platform_user_id, support_session_id,
                            action, target_type, target_id, meta, ip, at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::timestamptz)`,
    [
      id,
      seed.tenantId,
      seed.actorUserId ?? null,
      seed.actorPlatformUserId ?? null,
      seed.supportSessionId ?? null,
      seed.action,
      seed.targetType ?? null,
      seed.targetId ?? null,
      JSON.stringify(seed.meta ?? {}),
      seed.ip ?? null,
      seed.at,
    ],
  );
  return id;
}

export interface PlatformAuditRowSeed {
  readonly action: string;
  readonly at: string;
  readonly actorPlatformUserId?: string | null;
  readonly tenantId?: string | null;
  readonly targetType?: string | null;
  readonly targetId?: string | null;
  readonly meta?: Record<string, unknown>;
  readonly ip?: string | null;
}

/** One `platform_audit` entry; returns its id. */
export async function insertPlatformAuditRow(
  db: TestDatabase,
  seed: PlatformAuditRowSeed,
): Promise<string> {
  const id = randomUUID();
  await db.platform.query(
    `insert into platform_audit (id, actor_platform_user_id, action, target_type, target_id,
                                 tenant_id, meta, ip, at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz)`,
    [
      id,
      seed.actorPlatformUserId ?? null,
      seed.action,
      seed.targetType ?? null,
      seed.targetId ?? null,
      seed.tenantId ?? null,
      JSON.stringify(seed.meta ?? {}),
      seed.ip ?? null,
      seed.at,
    ],
  );
  return id;
}

/** `count` copies of one entry, a microsecond apart from `start` (for the export limit). */
export async function insertManyAuditRows(
  db: TestDatabase,
  tenantId: string,
  count: number,
  start: string,
): Promise<void> {
  await db.platform.query(
    `insert into audit_log (tenant_id, action, at)
     select $1, 'auth.sign_in', $3::timestamptz + n * interval '1 microsecond'
     from generate_series(1, $2::int) as n`,
    [tenantId, count, start],
  );
}

/** The CSV body's lines without the byte order mark and the last line end. */
export function csvLines(body: string): string[] {
  return body
    .replace(/^\uFEFF/u, '')
    .replace(/\r\n$/, '')
    .split('\r\n');
}
