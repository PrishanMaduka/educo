import { Inject, Injectable } from '@nestjs/common';
import { MIN_PASSWORD_LENGTH, signedLinkIssuedAt } from '@quad/domain';

import { PasswordHasher } from '../../common/crypto/passwords';
import { SignedLinks } from '../../common/crypto/signed-links';
import { InvalidLinkError } from '../../common/errors';
import { SessionRepository } from '../../common/session/session.repository';
import { SessionService } from '../../common/session/session.service';
import { AccountAudit } from '../../modules/auth/account-audit.service';
import { AuthRepository } from '../../modules/auth/auth.repository';
import { LockoutService } from '../../modules/auth/lockout.service';
import { assertNewPassword } from '../../modules/auth/new-password';
import { BREACH_CHECK, CLOCK, TENANT_DB } from '../../tokens';

import type { BreachCheck } from '../../common/crypto/breach-check';
import type { Clock } from '../../tokens';
import type { PasswordResetInput } from '@quad/contracts';
import type { QuadTenantDb } from '@quad/db';

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
    private readonly accountAudit: AccountAudit,
    @Inject(CLOCK) private readonly now: Clock,
  ) {}

  async reset(input: PasswordResetInput, ip: string): Promise<void> {
    const now = new Date(this.now());
    const payload = this.links.inspectLink(input.token, 'password_reset', now);
    const accountId = payload.sub;
    await this.refuseIfStale(accountId, signedLinkIssuedAt(payload));
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
    await this.accountAudit.recordInStaffSchools(accountId, ip, 'auth.password_reset');
  }

  /**
   * A link signed before the password last changed is refused (a reset, or Forgot asked twice
   * and the newer link used): only links from after the change still work. Compared in whole
   * seconds, the precision of the link's expiry.
   */
  private async refuseIfStale(accountId: string, issuedAt: number | null): Promise<void> {
    const { passwordChangedAt } = await this.repository.credentials(accountId);
    if (
      issuedAt !== null &&
      passwordChangedAt !== null &&
      issuedAt < Math.floor(passwordChangedAt.getTime() / 1000)
    ) {
      throw new InvalidLinkError();
    }
  }

  /** The policy with the strictest school minimum, then the breached list (400 `fields.password`). */
  private async checkPassword(accountId: string, password: string): Promise<void> {
    const rules = await this.db.definers.authSignInRules(accountId);
    const minLength = Math.max(MIN_PASSWORD_LENGTH, ...rules.map((rule) => rule.passwordMinLength));
    await assertNewPassword(password, minLength, this.breachCheck);
  }
}
