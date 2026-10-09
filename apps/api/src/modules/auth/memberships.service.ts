import { Inject, Injectable } from '@nestjs/common';

import { brandPalette } from '../../common/branding/brand-palette';
import { UnauthorizedError } from '../../common/errors';
import { TENANT_DB } from '../../tokens';

import type { RequestAuth } from '../../common/session/request-auth';
import type { SignInMembership, SignInMembershipList } from '@quad/contracts';
import type { AuthMembership, QuadTenantDb } from '@quad/db';

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
