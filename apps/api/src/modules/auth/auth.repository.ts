import { Inject, Injectable } from '@nestjs/common';
import {
  accounts,
  and,
  credentials,
  eq,
  gt,
  identities,
  isNull,
  sql,
  trustedDevices,
  users,
} from '@quad/db';

import { TENANT_DB } from '../../tokens';

import type { AccountStatus, SsoProvider } from '@quad/contracts';
import type { AccountTx, QuadTenantDb } from '@quad/db';

/** The account fields sign-in needs once the account is known. */
export interface AccountRow {
  readonly email: string | null;
  readonly status: AccountStatus;
  readonly lockedUntil: Date | null;
}

/** The account's password and authenticator (`credentials`). */
export interface CredentialRow {
  readonly passwordHash: string | null;
  readonly totpSecretEnc: string | null;
  readonly totpEnabled: boolean;
  /** The last authenticator time step accepted; only a later one is accepted next. */
  readonly totpLastStep: number | null;
  readonly recoveryCodesHash: readonly string[];
  readonly passwordChangedAt: Date | null;
}

const NO_CREDENTIALS: CredentialRow = {
  passwordHash: null,
  totpSecretEnc: null,
  totpEnabled: false,
  totpLastStep: null,
  recoveryCodesHash: [],
  passwordChangedAt: null,
};

/** A school's SSO settings (`current_tenant_profile`, D24). */
export interface SchoolSso {
  readonly ssoDomain: string | null;
  readonly google: boolean;
  readonly microsoft: boolean;
}

/**
 * What linking an SSO login did: a new `identities` row, the row the account already had, or a
 * refusal because the login belongs to another account or the account has another login of
 * that provider.
 */
export type IdentityLink = 'linked' | 'reused' | 'conflict';

/** Only a time step later than the last one accepted (RFC 6238 §5.2), so a replay loses a race. */
const laterStep = (step: number) =>
  sql`(${credentials.totpLastStep} is null or ${credentials.totpLastStep} < ${step})`;

/**
 * Sign-in reads and writes on the account tables (`accounts`, `credentials`, `trusted_devices`),
 * each inside `withAccount` so account RLS keeps it to that one account (D32). Methods ending in
 * `In` take the caller's transaction.
 */
@Injectable()
export class AuthRepository {
  constructor(@Inject(TENANT_DB) private readonly db: QuadTenantDb) {}

  account(accountId: string): Promise<AccountRow | null> {
    return this.db.withAccount(accountId, (tx) => this.accountIn(tx, accountId));
  }

  async accountIn(tx: AccountTx, accountId: string): Promise<AccountRow | null> {
    const [row] = await tx
      .select({ email: accounts.email, status: accounts.status, lockedUntil: accounts.lockedUntil })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);
    return row ?? null;
  }

  /** The account's credentials; an account without a row has none of them. */
  async credentials(accountId: string): Promise<CredentialRow> {
    const [row] = await this.db.withAccount(accountId, (tx) =>
      tx
        .select({
          passwordHash: credentials.passwordHash,
          totpSecretEnc: credentials.totpSecretEnc,
          totpEnabled: credentials.totpEnabled,
          totpLastStep: credentials.totpLastStep,
          recoveryCodesHash: credentials.recoveryCodesHash,
          passwordChangedAt: credentials.passwordChangedAt,
        })
        .from(credentials)
        .where(eq(credentials.accountId, accountId))
        .limit(1),
    );
    return row ?? NO_CREDENTIALS;
  }

  /** Persists a lock (spec 05 step 7); returns the address to tell, if the account has one. */
  async lockUntil(accountId: string, lockedUntil: Date): Promise<string | null> {
    const [row] = await this.db.withAccount(accountId, (tx) =>
      tx
        .update(accounts)
        .set({ lockedUntil })
        .where(eq(accounts.id, accountId))
        .returning({ email: accounts.email }),
    );
    return row?.email ?? null;
  }

  /** Records a completed sign-in on the account (the membership's is the caller's). */
  async signedInIn(tx: AccountTx, accountId: string, at: Date): Promise<void> {
    await tx.update(accounts).set({ lastSignInAt: at }).where(eq(accounts.id, accountId));
  }

  /**
   * Stores a new, unconfirmed authenticator secret (sealed by the field cipher), replacing an
   * earlier unconfirmed one. False when a confirmed authenticator exists: it is never replaced.
   */
  async savePendingTotp(accountId: string, totpSecretEnc: string): Promise<boolean> {
    const rows = await this.db.withAccount(accountId, (tx) =>
      tx
        .insert(credentials)
        .values({ accountId, totpSecretEnc, totpEnabled: false })
        .onConflictDoUpdate({
          target: credentials.accountId,
          set: { totpSecretEnc },
          setWhere: eq(credentials.totpEnabled, false),
        })
        .returning({ accountId: credentials.accountId }),
    );
    return rows.length > 0;
  }

  /**
   * Confirms the pending authenticator `totpSecretEnc` with the code of time step `step` (null
   * for the local fixed code) and stores the recovery code hashes. False when it is no longer the
   * pending one (a newer start, or already confirmed) or the step was already used.
   */
  async enableTotp(
    accountId: string,
    totpSecretEnc: string,
    step: number | null,
    recoveryCodesHash: readonly string[],
  ): Promise<boolean> {
    const rows = await this.db.withAccount(accountId, (tx) =>
      tx
        .update(credentials)
        .set({
          totpEnabled: true,
          recoveryCodesHash: [...recoveryCodesHash],
          ...(step === null ? {} : { totpLastStep: step }),
        })
        .where(
          and(
            eq(credentials.accountId, accountId),
            eq(credentials.totpEnabled, false),
            eq(credentials.totpSecretEnc, totpSecretEnc),
            step === null ? undefined : laterStep(step),
          ),
        )
        .returning({ accountId: credentials.accountId }),
    );
    return rows.length > 0;
  }

  /**
   * Records `step` as the last accepted authenticator time step; false when that step (or a later
   * one) was already accepted, so a concurrent replay of the same code loses.
   */
  async acceptTotpStep(accountId: string, step: number): Promise<boolean> {
    const rows = await this.db.withAccount(accountId, (tx) =>
      tx
        .update(credentials)
        .set({ totpLastStep: step })
        .where(and(eq(credentials.accountId, accountId), laterStep(step)))
        .returning({ accountId: credentials.accountId }),
    );
    return rows.length > 0;
  }

  /** Uses up one recovery code; false when it was already used (a concurrent use loses). */
  async useRecoveryCode(accountId: string, codeHash: string): Promise<boolean> {
    const rows = await this.db.withAccount(accountId, (tx) =>
      tx
        .update(credentials)
        .set({
          recoveryCodesHash: sql`array_remove(${credentials.recoveryCodesHash}, ${codeHash})`,
        })
        .where(
          and(
            eq(credentials.accountId, accountId),
            sql`${codeHash} = any(${credentials.recoveryCodesHash})`,
          ),
        )
        .returning({ accountId: credentials.accountId }),
    );
    return rows.length > 0;
  }

  /** True when `tokenHash` is one of the account's live trusted devices at `now`. */
  async isTrustedDevice(accountId: string, tokenHash: Buffer, now: Date): Promise<boolean> {
    const rows = await this.db.withAccount(accountId, (tx) =>
      tx
        .select({ id: trustedDevices.id })
        .from(trustedDevices)
        .where(
          and(
            eq(trustedDevices.accountId, accountId),
            eq(trustedDevices.tokenHash, tokenHash),
            isNull(trustedDevices.revokedAt),
            gt(trustedDevices.expiresAt, now),
          ),
        )
        .limit(1),
    );
    return rows.length > 0;
  }

  async trustDevice(
    accountId: string,
    tokenHash: Buffer,
    at: Date,
    expiresAt: Date,
  ): Promise<void> {
    await this.db.withAccount(accountId, (tx) =>
      tx.insert(trustedDevices).values({ accountId, tokenHash, createdAt: at, expiresAt }),
    );
  }

  /**
   * Sets a new password and clears any lock, in the caller's transaction; false for an account
   * that may not sign in (disabled), which keeps its old password.
   */
  async setPasswordIn(
    tx: AccountTx,
    accountId: string,
    passwordHash: string,
    at: Date,
  ): Promise<boolean> {
    const account = await this.accountIn(tx, accountId);
    if (account === null || account.status === 'disabled') return false;
    await tx
      .insert(credentials)
      .values({ accountId, passwordHash, passwordChangedAt: at })
      .onConflictDoUpdate({
        target: credentials.accountId,
        set: { passwordHash, passwordChangedAt: at },
      });
    await tx.update(accounts).set({ lockedUntil: null }).where(eq(accounts.id, accountId));
    return true;
  }

  /** Revokes every trusted device of the account (password reset, spec 05). */
  async revokeTrustedDevicesIn(tx: AccountTx, accountId: string): Promise<void> {
    await tx
      .update(trustedDevices)
      .set({ revokedAt: sql`now()` })
      .where(and(eq(trustedDevices.accountId, accountId), isNull(trustedDevices.revokedAt)));
  }

  /**
   * The member's name in the transaction's school, and records the sign-in on the membership.
   * RLS limits it to `app.tenant_id`; null when the membership is not there.
   */
  async memberSignedInIn(tx: AccountTx, userId: string, at: Date): Promise<string | null> {
    const [row] = await tx
      .update(users)
      .set({ lastSignInAt: at })
      .where(eq(users.id, userId))
      .returning({ name: users.name });
    return row?.name ?? null;
  }

  /**
   * Links the provider's `subject` to the account on its first SSO sign-in (spec 05 step 2).
   * Account RLS shows only this account's rows, and the unique `(provider, subject)` decides the
   * rest: an insert that finds the subject taken (by another account, or by a concurrent first
   * sign-in of this one) inserts nothing, and the account's own row is read again. One login per
   * provider per account: a second subject is a conflict, never a second link.
   */
  async linkIdentity(
    accountId: string,
    provider: SsoProvider,
    subject: string,
    email: string,
  ): Promise<IdentityLink> {
    return this.db.withAccount(accountId, async (tx) => {
      const own = () =>
        tx
          .select({ subject: identities.subject })
          .from(identities)
          .where(and(eq(identities.accountId, accountId), eq(identities.provider, provider)));
      const existing = await own();
      if (existing.length > 0) {
        return existing.some((row) => row.subject === subject) ? 'reused' : 'conflict';
      }
      const inserted = await tx
        .insert(identities)
        .values({ accountId, provider, subject, email })
        .onConflictDoNothing({ target: [identities.provider, identities.subject] })
        .returning({ id: identities.id });
      if (inserted.length > 0) return 'linked';
      return (await own()).some((row) => row.subject === subject) ? 'reused' : 'conflict';
    });
  }

  /** A school's SSO settings, read in that school; null when it has no profile. */
  async schoolSso(tenantId: string): Promise<SchoolSso | null> {
    const profile = await this.db.withTenant(tenantId, (tx) =>
      this.db.definers.currentTenantProfile(tx),
    );
    if (profile === null) return null;
    return {
      ssoDomain: profile.ssoDomain,
      google: profile.ssoGoogle,
      microsoft: profile.ssoMicrosoft,
    };
  }

  /** Runs `fn` in one transaction scoped to the account (and the school, when given). */
  inAccount<T>(
    accountId: string,
    tenantId: string | null,
    fn: (tx: AccountTx) => Promise<T>,
  ): Promise<T> {
    return tenantId === null
      ? this.db.withAccount(accountId, fn)
      : this.db.withAccount(accountId, { tenantId }, fn);
  }
}
