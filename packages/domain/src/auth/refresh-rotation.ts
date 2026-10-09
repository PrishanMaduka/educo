import { sessionExpiry } from './session-expiry';

/**
 * What a refresh token presented to `POST /auth/refresh` does (spec 05): `rotate` gives a new
 * pair and moves the family to the next generation; `reuse` revokes the whole family; `refuse`
 * answers 401 and changes nothing.
 */
export type RefreshOutcome = 'rotate' | 'reuse' | 'refuse';

export interface RefreshFacts {
  /** The family's current generation (`sessions.refresh_generation`). */
  readonly currentGeneration: number;
  /** The generation the presented token names. */
  readonly presentedGeneration: number;
  /** The presented secret is the family's current one (it matches `refresh_hash`). */
  readonly secretIsCurrent: boolean;
  /** The token carries the server's MAC for its family and generation: it was really issued. */
  readonly issued: boolean;
  readonly familyCreatedAt: Date;
  readonly now: Date;
}

/**
 * Spec 05, Parent app step 5: a matching generation rotates; an older generation that the
 * family really issued means a copy of a rotated-out token is in use, so the whole family is
 * revoked. A token the server never issued, a future generation, a wrong secret or a family
 * more than 60 days old is refused without revoking anything, so a forged token cannot sign
 * anyone out.
 */
export function refreshOutcome(facts: RefreshFacts): RefreshOutcome {
  if (!facts.issued) return 'refuse';
  const family = sessionExpiry({
    kind: 'refresh_family',
    createdAt: facts.familyCreatedAt,
    now: facts.now,
  });
  if (family.expired) return 'refuse';
  if (facts.presentedGeneration < facts.currentGeneration) return 'reuse';
  return facts.presentedGeneration === facts.currentGeneration && facts.secretIsCurrent
    ? 'rotate'
    : 'refuse';
}
