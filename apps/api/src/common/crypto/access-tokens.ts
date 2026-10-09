import { BearerClaims } from '@quad/contracts';
import { ACCESS_TOKEN_MINUTES } from '@quad/domain';
import { SignJWT, calculateJwkThumbprint, errors, exportJWK, jwtVerify } from 'jose';

import type { JwtKeys } from './jwt-keys';
import type { Clock } from '../../tokens';
import type { ParentMembershipKind } from '@quad/contracts';
import type { KeyObject } from 'node:crypto';

/** Who the parent access tokens are for (D32); the issuer is the `PUBLIC_WEB_URL` origin. */
export const ACCESS_TOKEN_AUDIENCE = 'quad:parent';

/** A tenant token's subject (spec 05): the membership in one school, and its refresh family. */
export interface TenantTokenSubject {
  readonly membershipId: string;
  readonly accountId: string;
  readonly tenantId: string;
  readonly kind: ParentMembershipKind;
  /** `rolesHashOf` the membership's roles. */
  readonly rolesHash: string;
  readonly sessionId: string;
}

/**
 * The parent app's access tokens (spec 05 Parent app step 5; D32): JWTs signed with EdDSA
 * (Ed25519, `JWT_KEYS` from the validated config). A `tenant` token lives 15 minutes; a
 * `select_school` token (OQ20) only until its family's choice expires. Verification accepts
 * exactly `alg: EdDSA` and `typ: JWT` with this issuer and audience and an `exp` that has not
 * passed (so `none` and every HS algorithm are refused), then parses the claims with the
 * contract. Anything else is null, never an exception.
 *
 * Every token names its key in `kid` (the RFC 7638 thumbprint of the public key, Task 9 fix
 * round 1), and only a token whose `kid` is the current key's, or `JWT_PUBLIC_KEY_PREVIOUS`'s
 * during a rotation, is checked at all; with no `kid` it is refused.
 */
export class AccessTokens {
  private constructor(
    private readonly keys: JwtKeys,
    private readonly issuer: string,
    private readonly now: Clock,
    private readonly kid: string,
    private readonly verifiers: ReadonlyMap<string, KeyObject>,
  ) {}

  /** Builds the signer with the key ids of the current and the previous public key. */
  static async create(keys: JwtKeys, issuer: string, now: Clock): Promise<AccessTokens> {
    const kid = await keyIdOf(keys.publicKey);
    const verifiers = new Map([[kid, keys.publicKey]]);
    if (keys.previousPublicKey !== null) {
      verifiers.set(await keyIdOf(keys.previousPublicKey), keys.previousPublicKey);
    }
    return new AccessTokens(keys, issuer, now, kid, verifiers);
  }

  /**
   * A school token for 15 minutes, or until `notAfter` (Unix seconds) when that is sooner: a
   * switch keeps the expiry of the token that asked for it, so switching never extends a token.
   */
  signTenant(subject: TenantTokenSubject, notAfter?: number): Promise<string> {
    const issuedAt = this.nowSeconds();
    const expiresAt = Math.min(issuedAt + ACCESS_TOKEN_MINUTES * 60, notAfter ?? Infinity);
    return this.sign(
      {
        scope: 'tenant',
        sub: subject.membershipId,
        acc: subject.accountId,
        tid: subject.tenantId,
        kind: subject.kind,
        rh: subject.rolesHash,
        sid: subject.sessionId,
      },
      issuedAt,
      expiresAt,
    );
  }

  /** The token that only chooses a school, until `expiresAt` (its family's choice expiry). */
  signSelectSchool(accountId: string, sessionId: string, expiresAt: Date): Promise<string> {
    return this.sign(
      { scope: 'select_school', sub: accountId, acc: accountId, sid: sessionId },
      this.nowSeconds(),
      Math.floor(expiresAt.getTime() / 1000),
    );
  }

  /** The token's claims when it is one of ours and still valid; null otherwise. */
  async verify(token: string): Promise<BearerClaims | null> {
    try {
      const { payload } = await jwtVerify(token, (header) => this.verifierFor(header.kid), {
        algorithms: [this.keys.algorithm],
        typ: 'JWT',
        issuer: this.issuer,
        audience: ACCESS_TOKEN_AUDIENCE,
        requiredClaims: ['exp', 'iat', 'sub'],
        currentDate: new Date(this.now()),
      });
      const claims = BearerClaims.safeParse(payload);
      return claims.success ? claims.data : null;
    } catch (error) {
      if (error instanceof errors.JOSEError) return null;
      throw error;
    }
  }

  /** The public key a token's `kid` names; a missing or unknown `kid` is refused. */
  private verifierFor(kid: string | undefined): KeyObject {
    const key = kid === undefined ? undefined : this.verifiers.get(kid);
    if (key === undefined) throw new errors.JWKSNoMatchingKey();
    return key;
  }

  private sign(claims: Record<string, string>, issuedAt: number, expiresAt: number) {
    return new SignJWT(claims)
      .setProtectedHeader({ alg: this.keys.algorithm, typ: 'JWT', kid: this.kid })
      .setIssuer(this.issuer)
      .setAudience(ACCESS_TOKEN_AUDIENCE)
      .setIssuedAt(issuedAt)
      .setExpirationTime(expiresAt)
      .sign(this.keys.privateKey);
  }

  private nowSeconds(): number {
    return Math.floor(this.now() / 1000);
  }
}

/** RFC 7638: the SHA-256 thumbprint of the key's JWK, in base64url. */
async function keyIdOf(publicKey: KeyObject): Promise<string> {
  return calculateJwkThumbprint(await exportJWK(publicKey));
}
