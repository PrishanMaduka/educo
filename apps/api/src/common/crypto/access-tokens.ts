import { BearerClaims } from '@quad/contracts';
import { ACCESS_TOKEN_MINUTES } from '@quad/domain';
import { SignJWT, errors, jwtVerify } from 'jose';

import type { JwtKeys } from './jwt-keys';
import type { Clock } from '../../tokens';
import type { ParentMembershipKind } from '@quad/contracts';

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
 */
export class AccessTokens {
  constructor(
    private readonly keys: JwtKeys,
    private readonly issuer: string,
    private readonly now: Clock,
  ) {}

  signTenant(subject: TenantTokenSubject): Promise<string> {
    const issuedAt = this.nowSeconds();
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
      issuedAt + ACCESS_TOKEN_MINUTES * 60,
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
      const { payload } = await jwtVerify(token, this.keys.publicKey, {
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

  private sign(claims: Record<string, string>, issuedAt: number, expiresAt: number) {
    return new SignJWT(claims)
      .setProtectedHeader({ alg: this.keys.algorithm, typ: 'JWT' })
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
