import { Inject, Injectable } from '@nestjs/common';
import { sessionExpiry } from '@quad/domain';

import { TOUCH_INTERVAL_MS } from '../../common/session/session.service';
import { CLOCK } from '../../tokens';
import { PLATFORM_DB } from '../tokens';

import { PlatformAuthRepository } from './platform-auth.repository';

import type { ConsoleAuth } from './console-auth';
import type { ConsoleSessionLookup } from '../../common/session/request-auth';
import type { Clock } from '../../tokens';
import type { QuadPlatformDb } from '@quad/db';

/**
 * Console sessions (spec 05 → Platform console; D32): resolves a console cookie's hash to its
 * platform user, for HTTP (`PlatformSessionGuard`) and for sockets (`ConsoleSessionLookup`, which
 * joins the `platform` room). Only a `kind='console'` row counts, never a staff or parent one.
 * A session ends when it is revoked, its user is no longer active, a sign-in step is 15 minutes
 * old, or an active session has been idle for 8 hours. Every request reads Postgres (console
 * traffic is small, so there is no cache to invalidate); `last_seen_at` is refreshed at most every
 * five minutes, as bookkeeping that `platform_audit` does not record.
 */
@Injectable()
export class ConsoleSessions implements ConsoleSessionLookup {
  constructor(
    @Inject(PLATFORM_DB) private readonly db: QuadPlatformDb,
    private readonly repository: PlatformAuthRepository,
    @Inject(CLOCK) private readonly now: Clock,
  ) {}

  /** The console session a cookie hash names, at any stage, or null. */
  async authenticate(tokenHash: Buffer): Promise<ConsoleAuth | null> {
    const row = await this.db.withPlatform((tx) => this.repository.sessionByToken(tx, tokenHash));
    if (row === null || row.status !== 'active') return null;
    const now = new Date(this.now());
    if (now.getTime() >= row.expiresAt.getTime()) return null;
    if (row.stage === 'active') {
      if (sessionExpiry({ kind: 'console', lastSeenAt: row.lastSeenAt, now }).expired) return null;
      if (now.getTime() - row.lastSeenAt.getTime() >= TOUCH_INTERVAL_MS) {
        const { expiresAt } = sessionExpiry({ kind: 'console', lastSeenAt: now, now });
        await this.db.withPlatform((tx) =>
          this.repository.touchSession(tx, row.sessionId, now, expiresAt),
        );
      }
    }
    return {
      kind: 'console',
      sessionId: row.sessionId,
      platformUserId: row.platformUserId,
      name: row.name,
      role: row.role,
      stage: row.stage,
      tokenHash,
    };
  }

  /** A socket handshake: only an active console session joins `platform`. */
  async resolve(tokenHash: Buffer): Promise<{ readonly platformUserId: string } | null> {
    const auth = await this.authenticate(tokenHash);
    return auth?.stage === 'active' ? { platformUserId: auth.platformUserId } : null;
  }
}
