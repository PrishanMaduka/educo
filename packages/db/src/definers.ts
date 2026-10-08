import type { EmailSuppressionReason } from '@quad/contracts';
import type pg from 'pg';

/**
 * The named security-definer calls (spec 02, D16). They run on the `quad_app` pool without a
 * tenant: each function decides exactly what it may read or write, so no grant on a platform
 * table and no `withPlatform` is needed. M1 adds `authMemberships` here.
 */
export interface DefinerCalls {
  /** Upserts `email_suppressions` for one address (`record_email_suppression`). */
  recordEmailSuppression(input: {
    readonly address: string;
    readonly reason: EmailSuppressionReason;
    readonly source: string;
  }): Promise<void>;
}

/** Binds the definer calls to a `quad_app` pool. */
export function createDefinerCalls(pool: pg.Pool): DefinerCalls {
  return {
    recordEmailSuppression: async ({ address, reason, source }) => {
      await pool.query('select record_email_suppression($1, $2, $3)', [address, reason, source]);
    },
  };
}
