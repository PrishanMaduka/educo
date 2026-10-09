import { Inject, Injectable } from '@nestjs/common';

import { brandPalette } from '../../common/branding/brand-palette';
import { UnauthorizedError } from '../../common/errors';
import { TENANT_DB } from '../../tokens';

import type { RequestAuth } from '../../common/session/request-auth';
import type {
  ParentMembership,
  ParentMembershipKind,
  SignInMembership,
  SignInMembershipList,
} from '@quad/contracts';
import type { AuthMembership, QuadTenantDb } from '@quad/db';

/** A guardian or relative membership: what bearer tokens are for (the kind rule, D32). */
export type ParentAuthMembership = AuthMembership & { readonly kind: ParentMembershipKind };

export const isParentKind = (kind: string): kind is ParentMembershipKind =>
  kind === 'guardian' || kind === 'relative';

/**
 * The schools a person may open with the staff cookie (spec 05 step 5): their active staff
 * memberships of live schools, from `auth_memberships` (suspended ones included and flagged).
 * The cookie flows list and accept `kind = 'staff'` only (ruling F12); guardian and relative
 * memberships belong to the parent app's token.
 */
@Injectable()
export class MembershipsService {
  constructor(@Inject(TENANT_DB) private readonly db: QuadTenantDb) {}

  /** The account's staff memberships, by school name. */
  async staffMemberships(accountId: string): Promise<AuthMembership[]> {
    const memberships = await this.db.definers.authMemberships(accountId);
    return memberships.filter((membership) => membership.kind === 'staff');
  }

  /**
   * The account's guardian and relative memberships, by school name: the only ones the parent
   * app's tokens list and accept (the kind rule, D32). Staff memberships are never among them.
   */
  async parentMemberships(accountId: string): Promise<ParentAuthMembership[]> {
    const memberships = await this.db.definers.authMemberships(accountId);
    return memberships.filter((membership): membership is ParentAuthMembership =>
      isParentKind(membership.kind),
    );
  }

  /** `GET /auth/memberships`: the signed-in account's own schools, never another's. */
  async listFor(auth: RequestAuth): Promise<SignInMembershipList> {
    if (auth.kind !== 'web') throw new UnauthorizedError();
    const memberships = await this.staffMemberships(auth.accountId);
    return { items: memberships.map(toSignInMembership) };
  }
}

export function toSignInMembership(membership: AuthMembership): SignInMembership {
  return {
    tenantId: membership.tenantId,
    name: membership.tenantName,
    shortName: membership.shortName,
    // School logos become files in M4; until then there is no URL to give.
    logoUrl: null,
    brand: brandPalette(membership.brandColor),
    roleNames: [...membership.roleNames],
    suspended: membership.suspended,
    suspendReason: membership.suspendReason,
  };
}

export function toParentMembership(membership: ParentAuthMembership): ParentMembership {
  const school = toSignInMembership(membership);
  return {
    tenantId: school.tenantId,
    name: school.name,
    shortName: school.shortName,
    logoUrl: school.logoUrl,
    brand: school.brand,
    kind: membership.kind,
    suspended: school.suspended,
    suspendReason: school.suspendReason,
  };
}
