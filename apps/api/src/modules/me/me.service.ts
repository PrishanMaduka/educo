import { Inject, Injectable } from '@nestjs/common';
import { firstNameOf, greetingPeriod, pageAccess, roleHome } from '@quad/domain';

import { brandPalette } from '../../common/branding/brand-palette';
import { formatMessage } from '../../common/delivery/templates/render';
import { ForbiddenError, UnauthorizedError } from '../../common/errors';
import { schoolOf } from '../../common/session/request-auth';
import { SessionService } from '../../common/session/session.service';
import { CLOCK, TENANT_DB } from '../../tokens';

import { MeRepository } from './me.repository';

import type { RequestAccess } from '../../common/access/permissions.service';
import type { AccountAuth, PersonAuth, RequestAuth } from '../../common/session/request-auth';
import type { Clock } from '../../tokens';
import type {
  Me,
  MeMembership,
  MembershipKind,
  MePermissions,
  MePerson,
  MePreview,
  MeUpdateInput,
  PageQuery,
  SessionSummaryList,
} from '@quad/contracts';
import type { QuadTenantDb, TenantProfile, TenantTx } from '@quad/db';

function supportPerson(name: string, profile: TenantProfile): MePerson {
  return {
    name,
    firstName: firstNameOf(name),
    theme: 'system',
    locale: profile.locale,
    roleNames: [],
  };
}

/** A support visit has no account or membership: it cannot change one or list its devices. */
function personOnly(auth: RequestAuth): AccountAuth {
  if (auth.kind === 'support') {
    throw new ForbiddenError(
      'forbidden',
      'This belongs to the signed-in person. A support visit cannot change it.',
    );
  }
  return auth;
}

/**
 * The signed-in person's own view (spec 06 Me and auth): who they are, their school and its
 * brand, the other schools they can switch to, the preview and support banners, and the
 * greeting, all from the session (never from request input).
 */
@Injectable()
export class MeService {
  constructor(
    @Inject(TENANT_DB) private readonly db: QuadTenantDb,
    private readonly repository: MeRepository,
    private readonly sessions: SessionService,
    @Inject(CLOCK) private readonly now: Clock,
  ) {}

  async get(auth: RequestAuth): Promise<Me> {
    const { tenantId } = schoolOf(auth);
    const memberships = auth.kind === 'support' ? [] : await this.otherMemberships(auth, tenantId);
    return this.db.withTenant(tenantId, async (tx) => {
      const profile = await this.db.definers.currentTenantProfile(tx);
      if (profile === null) {
        throw new UnauthorizedError();
      }
      // In a support visit the person is the Quad staff member, and the banner names them.
      const person =
        auth.kind === 'support'
          ? supportPerson(await this.supportName(tx, auth), profile)
          : await this.memberPerson(tx, auth, profile);
      return {
        person,
        school: {
          id: tenantId,
          name: profile.name,
          shortName: profile.shortName,
          timeZone: profile.timeZone,
          brand: brandPalette(profile.brandColor),
        },
        memberships,
        preview: auth.kind === 'web' ? await this.previewIn(tx, auth) : null,
        support:
          auth.kind === 'support'
            ? { schoolName: profile.name, platformUserName: person.name }
            : null,
        greeting: greetingPeriod(new Date(this.now()), profile.timeZone),
      };
    });
  }

  /**
   * `GET /me/permissions` (spec 05, 06): the keys `access` holds, every staff page with how much
   * of it opens, the home page and the preview banner. Staff permissions are for the staff
   * portal, so a parent's token is refused (403): parents are not role-based.
   */
  async permissions(auth: RequestAuth, access: RequestAccess): Promise<MePermissions> {
    if (auth.kind === 'mobile') {
      throw new ForbiddenError('forbidden', formatMessage('error.staffPortalOnly'));
    }
    const { permissions, planModules } = access;
    const preview =
      auth.kind === 'web' && access.previewRoleId !== null
        ? await this.db.withTenant(access.tenantId, (tx) => this.previewIn(tx, auth))
        : null;
    return {
      keys: [...permissions].sort(),
      pages: [...pageAccess(permissions, planModules)],
      home: roleHome(permissions, access.scope, planModules),
      preview,
    };
  }

  /** `PATCH /me`: the person's name, theme and locale in the current school only. */
  async update(auth: RequestAuth, changes: MeUpdateInput): Promise<Me> {
    const person = personOnly(auth);
    const { tenantId, userId } = schoolOf(person);
    if (userId === null) {
      throw new UnauthorizedError();
    }
    const updated = await this.db.withTenant(tenantId, (tx) =>
      this.repository.updateMember(tx, userId, changes),
    );
    if (!updated) {
      throw new UnauthorizedError();
    }
    return this.get(person);
  }

  listSessions(auth: RequestAuth, query: PageQuery): Promise<SessionSummaryList> {
    return this.sessions.listOwn(personOnly(auth), query);
  }

  revokeSession(auth: RequestAuth, sessionId: string): Promise<{ readonly current: boolean }> {
    return this.sessions.revokeOwn(personOnly(auth), sessionId);
  }

  /**
   * The person's other active memberships, for Switch school: staff ones for the staff cookie,
   * guardian and relative ones for the parent app's token (the kind rule, D32).
   */
  private async otherMemberships(auth: AccountAuth, tenantId: string): Promise<MeMembership[]> {
    const kinds: readonly MembershipKind[] =
      auth.kind === 'web' ? ['staff'] : ['guardian', 'relative'];
    const memberships = await this.db.definers.authMemberships(auth.accountId);
    return memberships
      .filter((membership) => kinds.includes(membership.kind) && membership.tenantId !== tenantId)
      .map((membership) => ({
        tenantId: membership.tenantId,
        name: membership.tenantName,
        shortName: membership.shortName,
        brandColor: membership.brandColor,
        roleNames: [...membership.roleNames],
        suspended: membership.suspended,
      }));
  }

  private async memberPerson(
    tx: TenantTx,
    auth: AccountAuth,
    profile: TenantProfile,
  ): Promise<MePerson> {
    const member = auth.userId === null ? null : await this.repository.member(tx, auth.userId);
    if (member === null || auth.userId === null) {
      throw new UnauthorizedError();
    }
    return {
      name: member.name,
      firstName: firstNameOf(member.name),
      theme: member.theme,
      locale: member.locale ?? profile.locale,
      roleNames: await this.repository.roleNames(tx, auth.userId),
    };
  }

  private async previewIn(tx: TenantTx, auth: PersonAuth): Promise<MePreview | null> {
    if (auth.previewRoleId === null) {
      return null;
    }
    const roleName = await this.repository.roleName(tx, auth.previewRoleId);
    if (roleName === null) {
      return null;
    }
    const sampleId = auth.previewSampleUserId;
    const sample = sampleId === null ? null : await this.repository.member(tx, sampleId);
    return {
      roleId: auth.previewRoleId,
      roleName,
      sampleUser: sampleId !== null && sample !== null ? { id: sampleId, name: sample.name } : null,
    };
  }

  private async supportName(
    tx: TenantTx,
    auth: Extract<RequestAuth, { kind: 'support' }>,
  ): Promise<string> {
    const visit = await this.db.definers.currentSupportVisit(tx, auth.supportSessionId);
    if (visit === null) {
      throw new UnauthorizedError();
    }
    return visit.platformUserName;
  }
}
