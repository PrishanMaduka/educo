import { Injectable } from '@nestjs/common';
import { supportSessions } from '@quad/db';

import { InvariantError } from '../../common/errors';

import type { PlatformTx } from '@quad/db';

/** A new support visit: who, where, why and until when. */
export interface NewSupportVisit {
  readonly platformUserId: string;
  readonly tenantId: string;
  readonly reason: string;
  readonly startedAt: Date;
  readonly expiresAt: Date;
}

/** Writes `support_sessions` for the console (`withPlatform` only). */
@Injectable()
export class SupportRepository {
  /** Inserts the visit, not yet redeemed (no cookie hash), and returns its id. */
  async insert(tx: PlatformTx, visit: NewSupportVisit): Promise<string> {
    const [row] = await tx
      .insert(supportSessions)
      .values({
        platformUserId: visit.platformUserId,
        tenantId: visit.tenantId,
        reason: visit.reason,
        startedAt: visit.startedAt,
        expiresAt: visit.expiresAt,
      })
      .returning({ id: supportSessions.id });
    if (row === undefined) throw new InvariantError('The support visit row was not written.');
    return row.id;
  }
}
