import { Inject, Injectable } from '@nestjs/common';

import { PermissionsService } from '../../common/access/permissions.service';
import { AuditService, auditActorOf } from '../../common/audit/audit.service';
import { formatMessage } from '../../common/delivery/templates/render';
import { ForbiddenError, NotFoundError, ValidationError } from '../../common/errors';
import { schoolOf } from '../../common/session/request-auth';
import { SessionRepository } from '../../common/session/session.repository';
import { SessionService } from '../../common/session/session.service';
import { TENANT_DB } from '../../tokens';

import { MeRepository } from './me.repository';
import { MeService } from './me.service';

import type { PersonAuth, RequestAuth } from '../../common/session/request-auth';
import type { MePermissions, RolePreviewInput } from '@quad/contracts';
import type { QuadTenantDb } from '@quad/db';

/** A staff browser session in a school: the only kind that carries a preview. */
type PreviewingAuth = PersonAuth & { readonly tenantId: string };

/**
 * Only a staff member's own browser session can preview: a support visit has no session row to
 * hold one, and the parent app's tokens are not role-based.
 */
function staffSession(auth: RequestAuth): PreviewingAuth {
  if (auth.kind !== 'web' || auth.tenantId === null) {
    throw new ForbiddenError('forbidden', formatMessage('error.staffPortalOnly'));
  }
  return { ...auth, tenantId: auth.tenantId };
}

/**
 * Preview a role (spec 05, spec 06, spec 08): the admin stays themselves; the session gets
 * `preview_role_id` (and a sample person for a role scoped to its own classes), the guards then
 * evaluate the previewed role, capped by the admin's own sensitive keys (`effectivePermissions`),
 * and every write but ending the preview is refused. Start and end are audited.
 */
@Injectable()
export class RolePreviewService {
  constructor(
    @Inject(TENANT_DB) private readonly db: QuadTenantDb,
    private readonly me: MeService,
    private readonly repository: MeRepository,
    private readonly sessions: SessionRepository,
    private readonly sessionCache: SessionService,
    private readonly permissions: PermissionsService,
    private readonly audit: AuditService,
  ) {}

  /**
   * `POST /me/role-preview`: the role and the sample person must be the session's school's (404
   * otherwise, RLS hides another school's); a role for own classes needs a sample (400).
   */
  async start(auth: RequestAuth, input: RolePreviewInput, ip: string): Promise<MePermissions> {
    const person = staffSession(auth);
    const actor = auditActorOf(schoolOf(person), ip);
    const sampleUserId = input.sampleUserId ?? null;
    await this.db.withAccount(person.accountId, { tenantId: person.tenantId }, async (tx) => {
      const role = await this.repository.previewRole(tx, input.roleId);
      if (role === null) throw new NotFoundError();
      if (role.scope === 'own_classes' && sampleUserId === null) {
        throw new ValidationError({ sampleUserId: formatMessage('error.previewNeedsSample') });
      }
      if (sampleUserId !== null && !(await this.repository.isActiveStaff(tx, sampleUserId))) {
        throw new NotFoundError();
      }
      const set = await this.sessions.setPreviewIn(
        tx,
        person.accountId,
        person.sessionId,
        person.tenantId,
        { roleId: role.id, sampleUserId },
      );
      if (set === undefined) throw new NotFoundError();
      await this.audit.record(
        { tx, ...actor },
        'role_preview.started',
        { type: 'role', id: role.id },
        { sampleUserId },
      );
    });
    // The cached session still says "no preview" for up to 30 s otherwise.
    await this.sessionCache.invalidateToken(person.tokenHash);
    const previewing = {
      ...person,
      previewRoleId: input.roleId,
      previewSampleUserId: sampleUserId,
    };
    return this.me.permissions(previewing, await this.permissions.of(previewing));
  }

  /** `DELETE /me/role-preview` (Back to my view): 404 when no preview is on. */
  async end(auth: RequestAuth, ip: string): Promise<void> {
    const person = staffSession(auth);
    const actor = auditActorOf(schoolOf(person), ip);
    await this.db.withAccount(person.accountId, { tenantId: person.tenantId }, async (tx) => {
      const cleared = await this.sessions.setPreviewIn(
        tx,
        person.accountId,
        person.sessionId,
        person.tenantId,
        null,
      );
      if (cleared === undefined) {
        throw new NotFoundError(formatMessage('error.notPreviewing'));
      }
      await this.audit.record({ tx, ...actor }, 'role_preview.ended', {
        type: 'role',
        id: cleared.previousRoleId,
      });
    });
    await this.sessionCache.invalidateToken(person.tokenHash);
  }
}
