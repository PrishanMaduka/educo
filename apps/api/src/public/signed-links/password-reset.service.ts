import { Inject, Injectable } from '@nestjs/common';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, checkPasswordPolicy } from '@quad/domain';

import { AuditService } from '../../common/audit/audit.service';
import { PasswordHasher } from '../../common/crypto/passwords';
import { SignedLinks } from '../../common/crypto/signed-links';
import { formatMessage } from '../../common/delivery/templates/render';
import { InvalidLinkError, ValidationError } from '../../common/errors';
import { SessionRepository } from '../../common/session/session.repository';
import { SessionService } from '../../common/session/session.service';
import { AuthRepository } from '../../modules/auth/auth.repository';
import { LockoutService } from '../../modules/auth/lockout.service';
import { MembershipsService } from '../../modules/auth/memberships.service';
import { BREACH_CHECK, CLOCK, TENANT_DB } from '../../tokens';

import type { BreachCheck } from '../../common/crypto/breach-check';
import type { Clock } from '../../tokens';
import type { PasswordResetInput } from '@quad/contracts';
import type { QuadTenantDb } from '@quad/db';
import type { PasswordPolicyReason } from '@quad/domain';

function policyMessage(reason: PasswordPolicyReason, minLength: number): string {
  switch (reason) {
    case 'too_short':
      return formatMessage('error.password.tooShort', { min: minLength });
    case 'too_long':
      return formatMessage('error.password.tooLong', { max: MAX_PASSWORD_LENGTH });
  }
}

/**
 * `POST /auth/password/reset` (spec 05 step 6), a tenant-less entry point (D16): the signed link
 * is checked first without using it up, then the password policy (the strictest minimum of the
 * account's schools) and the breached-password list, and only then is the link used up
 * (`verifyLink` records its nonce), so a weak password never burns the link (Task 4 finding).
 * The new password revokes every session and trusted device (spec 05) and clears any lock;
 * `auth.password_reset` is audited in each school where the account is staff, after the check.
 */
@Injectable()
export class PasswordResetService {
  constructor(
    @Inject(TENANT_DB) private readonly db: QuadTenantDb,
    private readonly links: SignedLinks,
    private readonly hasher: PasswordHasher,
    @Inject(BREACH_CHECK) private readonly breachCheck: BreachCheck,
    private readonly repository: AuthRepository,
    private readonly sessionRows: SessionRepository,
    private readonly sessions: SessionService,
    private readonly lockout: LockoutService,
    private readonly memberships: MembershipsService,
    private readonly audit: AuditService,
    @Inject(CLOCK) private readonly now: Clock,
  ) {}

  async reset(input: PasswordResetInput, ip: string): Promise<void> {
    const now = new Date(this.now());
    const { sub: accountId } = this.links.inspectLink(input.token, 'password_reset', now);
    await this.checkPassword(accountId, input.password);
    await this.links.verifyLink(input.token, 'password_reset', now);

    const passwordHash = await this.hasher.hash(input.password);
    const revoked = await this.repository.inAccount(accountId, null, async (tx) => {
      if (!(await this.repository.setPasswordIn(tx, accountId, passwordHash, now))) return null;
      await this.repository.revokeTrustedDevicesIn(tx, accountId);
      return this.sessionRows.revokeAllIn(tx, accountId);
    });
    // A disabled account keeps its password; the answer is the same as for any bad link.
    if (revoked === null) throw new InvalidLinkError();

    for (const tokenHash of revoked) await this.sessions.invalidateToken(tokenHash);
    await this.sessions.invalidateAccount(accountId);
    await this.lockout.clear(accountId);
    await this.auditReset(accountId, ip);
  }

  /** The policy with the strictest school minimum, then the breached list (400 `fields.password`). */
  private async checkPassword(accountId: string, password: string): Promise<void> {
    const rules = await this.db.definers.authSignInRules(accountId);
    const minLength = Math.max(MIN_PASSWORD_LENGTH, ...rules.map((rule) => rule.passwordMinLength));
    const [reason] = checkPasswordPolicy(password, { minLength });
    if (reason !== undefined) {
      throw new ValidationError({ password: policyMessage(reason, minLength) });
    }
    if (await this.breachCheck.isBreached(password)) {
      throw new ValidationError({ password: formatMessage('error.password.breached') });
    }
  }

  private async auditReset(accountId: string, ip: string): Promise<void> {
    const memberships = await this.memberships.staffMemberships(accountId);
    for (const membership of memberships) {
      await this.db.withTenant(membership.tenantId, (tx) =>
        this.audit.record(
          {
            tx,
            tenantId: membership.tenantId,
            userId: membership.userId,
            supportSessionId: null,
            platformUserId: null,
            ip,
          },
          'auth.password_reset',
          { type: 'account', id: accountId },
        ),
      );
    }
  }
}
