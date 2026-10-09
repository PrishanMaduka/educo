import { sql } from 'drizzle-orm';

import type { TenantTx } from './tenant';
import type {
  AccountStatus,
  EmailSuppressionReason,
  MembershipKind,
  SessionKind,
  SessionStage,
  TenantStatus,
  TwoStepRule,
} from '@quad/contracts';
import type pg from 'pg';

/** One school a person may enter (`auth_memberships`). Never an email or phone. */
export interface AuthMembership {
  readonly tenantId: string;
  readonly tenantName: string;
  readonly shortName: string;
  readonly logoFileId: string | null;
  readonly brandColor: string | null;
  readonly kind: MembershipKind;
  /** The membership (`users.id`) in that school. */
  readonly userId: string;
  /** Primary role first, then by name. */
  readonly roleNames: readonly string[];
  /** The school is suspended: sign-in shows `suspendReason` instead of opening it (spec 07). */
  readonly suspended: boolean;
  readonly suspendReason: string | null;
}

/** Exactly one identifier: an email (any case) or an E.164 phone number. */
export type AccountIdentifier = { readonly email: string } | { readonly phone: string };

/** What sign-in needs to know about an account before anyone is verified. */
export interface AccountLookup {
  readonly id: string;
  readonly status: AccountStatus;
  readonly lockedUntil: Date | null;
}

/** An account's session row, not revoked (`session_by_token`). Expiry is the caller's check. */
export interface AccountSessionLookup {
  readonly kind: SessionKind;
  readonly sessionId: string;
  readonly accountId: string;
  readonly activeTenantId: string | null;
  readonly activeUserId: string | null;
  readonly stage: SessionStage;
  readonly expiresAt: Date;
  readonly lastSeenAt: Date;
  readonly keepSignedIn: boolean;
  readonly previewRoleId: string | null;
  readonly previewSampleUserId: string | null;
  /** Set only while that support visit is active and for `activeTenantId`. */
  readonly supportSessionId: string | null;
}

/** A redeemed, active support visit resolved by its cookie hash (ruling R-support-token). */
export interface SupportSessionLookup {
  readonly kind: 'support';
  readonly supportSessionId: string;
  readonly platformUserId: string;
  readonly tenantId: string;
  /** 60 minutes after the visit started (spec 05); a hard limit. */
  readonly expiresAt: Date;
}

export type SessionLookup = AccountSessionLookup | SupportSessionLookup;

/** Whose refresh family a parent refresh token names, and its school (`refresh_family`). */
export interface RefreshFamily {
  readonly accountId: string;
  readonly tenantId: string;
}

/** One staff membership's sign-in rules; `strictestTwoStep` (packages/domain) combines them. */
export interface AuthSignInRule {
  readonly tenantId: string;
  readonly twoStep: TwoStepRule;
  readonly roleKeys: readonly string[];
  readonly passwordMinLength: number;
}

/** The current school's platform-owned settings (D24), read through `current_tenant_profile`. */
export interface TenantProfile {
  readonly name: string;
  readonly shortName: string;
  readonly status: TenantStatus;
  readonly suspendReason: string | null;
  readonly timeZone: string;
  readonly locale: string;
  readonly currency: string;
  readonly brandColor: string | null;
  readonly logoFileId: string | null;
  /** Enabled plan modules, sorted. */
  readonly modules: readonly string[];
  readonly twoStep: TwoStepRule;
  readonly passwordMinLength: number;
  readonly sessionHours: number;
  readonly ipAllowlist: readonly string[];
  /** ISO 3166-1 alpha-2: the school's defaults, its phone country among them, come from it (D35). */
  readonly country: string;
}

/** A single-use signed-link nonce (D16). */
export interface SignedTokenUse {
  readonly nonce: string;
  readonly purpose: string;
  readonly expiresAt: Date;
}

/** A rename of the current school: only while its name is still `expected` (D32, Task 15). */
export interface TenantRename {
  readonly expected: string;
  readonly name: string;
}

/** The platform half of an action taken in a support visit (spec 05, dual audit). */
export interface SupportAuditEntry {
  readonly supportSessionId: string;
  readonly action: string;
  readonly targetType: string | null;
  readonly targetId: string | null;
  readonly meta: Readonly<Record<string, unknown>>;
}

export interface MemberTwoStepStatus {
  readonly userId: string;
  readonly totpEnabled: boolean;
}

/** The support banner's "as {name} from Quad" (spec 05, Support access). */
export interface SupportVisit {
  readonly platformUserName: string;
}

/** `tenant_by_embed_key` (D16). A stub until M4: always null. */
export interface EmbedKeyTenant {
  readonly tenantId: string;
  readonly formId: string;
  readonly active: boolean;
}

/** `tenant_by_gateway_account` (D16, D20). A stub until M7: always null. */
export interface GatewayAccountTenant {
  readonly tenantId: string;
  readonly gatewayAccountId: string;
  readonly mode: string;
}

/**
 * The named security-definer calls (spec 02, D16; D32). They run on the `quad_app` pool: each
 * function decides exactly what it may read or write, so no grant on a platform table and no
 * `withPlatform` is needed.
 * - Tenant-less calls (sign-in, signed links, webhooks, support redemption) take no transaction.
 * - Tenant-scoped calls take the `tx` of the caller's `withTenant` (or `withAccount` with a
 *   school), because the function reads `app.tenant_id` from it. Without a school they refuse
 *   (or, for `currentTenantProfile`, find nothing).
 */
export interface DefinerCalls {
  /** Upserts `email_suppressions` for one address (`record_email_suppression`). */
  recordEmailSuppression(input: {
    readonly address: string;
    readonly reason: EmailSuppressionReason;
    readonly source: string;
  }): Promise<void>;
  /** Active memberships of live schools, suspended ones included and flagged. */
  authMemberships(accountId: string): Promise<AuthMembership[]>;
  accountByIdentifier(identifier: AccountIdentifier): Promise<AccountLookup | null>;
  /** Resolves a cookie's SHA-256: an account session first, then a support visit. */
  sessionByToken(tokenHash: Buffer): Promise<SessionLookup | null>;
  /** The account and school of a live parent refresh family (a mobile session in a school). */
  refreshFamily(sessionId: string): Promise<RefreshFamily | null>;
  /** One row per active staff membership of a live school. */
  authSignInRules(accountId: string): Promise<AuthSignInRule[]>;
  /** True only the first time `nonce` is used. */
  consumeSignedToken(use: SignedTokenUse): Promise<boolean>;
  /** Stores the support cookie's hash once; null when ended, expired or already redeemed. */
  redeemSupportSession(supportSessionId: string, tokenHash: Buffer): Promise<string | null>;
  /** Ends the visit the cookie names, once, and writes `platform_audit`. */
  endSupportSession(tokenHash: Buffer): Promise<void>;
  tenantByEmbedKey(key: string): Promise<EmbedKeyTenant | null>;
  tenantByGatewayAccount(provider: string, accountId: string): Promise<GatewayAccountTenant | null>;
  /** The current school's profile; null without a school. */
  currentTenantProfile(tx: TenantTx): Promise<TenantProfile | null>;
  /**
   * Renames the current school only, and writes `platform_audit`, while its name is still
   * `expected` (the name the caller read). False, changing nothing, when it has changed meanwhile.
   */
  updateCurrentTenantName(tx: TenantTx, rename: TenantRename): Promise<boolean>;
  /** Refused unless the support visit is active and for the current school. */
  recordSupportAudit(tx: TenantTx, entry: SupportAuditEntry): Promise<void>;
  /** The account for `email`, created (active) if there is none. Never a second account. */
  ensureAccountForEmail(tx: TenantTx, email: string): Promise<string>;
  /** Two-step status of the current school's members among `userIds`; others are dropped. */
  memberTwoStepStatus(tx: TenantTx, userIds: readonly string[]): Promise<MemberTwoStepStatus[]>;
  /** Revokes the member's sessions and refresh families in the current school only. */
  revokeMemberSessions(tx: TenantTx, userId: string): Promise<void>;
  /** Ends the member's role preview on their sessions in the current school only (Task 13). */
  clearMemberPreview(tx: TenantTx, userId: string): Promise<void>;
  /** The account's sign-in email of a member of the current school; null otherwise. */
  memberAccountEmail(tx: TenantTx, userId: string): Promise<string | null>;
  /** Whether a current-school member's account has any other membership (false otherwise). */
  memberHasOtherMemberships(tx: TenantTx, userId: string): Promise<boolean>;
  /** Who from Quad is in an active support visit to the current school; null otherwise. */
  currentSupportVisit(tx: TenantTx, supportSessionId: string): Promise<SupportVisit | null>;
}

// Row shapes as `pg` returns them through the `quad_app` pool (timestamps as Date, arrays parsed).

interface MembershipRow {
  tenant_id: string;
  tenant_name: string;
  short_name: string;
  logo_file_id: string | null;
  brand_color: string | null;
  kind: MembershipKind;
  user_id: string;
  role_names: string[];
  suspended: boolean;
  suspend_reason: string | null;
}

interface AccountRow {
  id: string;
  status: AccountStatus;
  locked_until: Date | null;
}

interface SessionRow {
  session_id: string | null;
  account_id: string | null;
  platform_user_id: string | null;
  active_tenant_id: string | null;
  active_user_id: string | null;
  stage: SessionStage;
  kind: SessionKind | 'support';
  expires_at: Date;
  last_seen_at: Date | null;
  keep_signed_in: boolean;
  preview_role_id: string | null;
  preview_sample_user_id: string | null;
  support_session_id: string | null;
}

interface SignInRuleRow {
  tenant_id: string;
  two_step: TwoStepRule;
  role_keys: string[];
  password_min_length: number;
}

// Row shapes through a Drizzle transaction (`execute` needs an index signature, so these are types).

type ProfileRow = {
  name: string;
  short_name: string;
  status: TenantStatus;
  suspend_reason: string | null;
  time_zone: string;
  locale: string;
  currency: string;
  brand_color: string | null;
  logo_file_id: string | null;
  modules: string[];
  two_step: TwoStepRule;
  password_min_length: number;
  session_hours: number;
  ip_allowlist: string[];
  country: string;
};

class UnexpectedDefinerRowError extends Error {
  constructor(definer: string) {
    super(`${definer} returned a row in an unexpected shape.`);
    this.name = 'UnexpectedDefinerRowError';
  }
}

function toSessionLookup(row: SessionRow): SessionLookup {
  if (row.kind === 'support') {
    if (!row.support_session_id || !row.platform_user_id || !row.active_tenant_id) {
      throw new UnexpectedDefinerRowError('session_by_token');
    }
    return {
      kind: 'support',
      supportSessionId: row.support_session_id,
      platformUserId: row.platform_user_id,
      tenantId: row.active_tenant_id,
      expiresAt: row.expires_at,
    };
  }
  if (!row.session_id || !row.account_id || !row.last_seen_at) {
    throw new UnexpectedDefinerRowError('session_by_token');
  }
  return {
    kind: row.kind,
    sessionId: row.session_id,
    accountId: row.account_id,
    activeTenantId: row.active_tenant_id,
    activeUserId: row.active_user_id,
    stage: row.stage,
    expiresAt: row.expires_at,
    lastSeenAt: row.last_seen_at,
    keepSignedIn: row.keep_signed_in,
    previewRoleId: row.preview_role_id,
    previewSampleUserId: row.preview_sample_user_id,
    supportSessionId: row.support_session_id,
  };
}

/** Binds the definer calls to a `quad_app` pool. */
export function createDefinerCalls(pool: pg.Pool): DefinerCalls {
  return {
    recordEmailSuppression: async ({ address, reason, source }) => {
      await pool.query('select record_email_suppression($1, $2, $3)', [address, reason, source]);
    },

    authMemberships: async (accountId) => {
      const { rows } = await pool.query<MembershipRow>('select * from auth_memberships($1)', [
        accountId,
      ]);
      return rows.map((row) => ({
        tenantId: row.tenant_id,
        tenantName: row.tenant_name,
        shortName: row.short_name,
        logoFileId: row.logo_file_id,
        brandColor: row.brand_color,
        kind: row.kind,
        userId: row.user_id,
        roleNames: row.role_names,
        suspended: row.suspended,
        suspendReason: row.suspend_reason,
      }));
    },

    accountByIdentifier: async (identifier) => {
      const [email, phone] =
        'email' in identifier ? [identifier.email, null] : [null, identifier.phone];
      const { rows } = await pool.query<AccountRow>(
        'select id, status, locked_until from account_by_identifier($1, $2)',
        [email, phone],
      );
      const [row] = rows;
      return row ? { id: row.id, status: row.status, lockedUntil: row.locked_until } : null;
    },

    sessionByToken: async (tokenHash) => {
      const { rows } = await pool.query<SessionRow>('select * from session_by_token($1)', [
        tokenHash,
      ]);
      const [row] = rows;
      return row ? toSessionLookup(row) : null;
    },

    refreshFamily: async (sessionId) => {
      const { rows } = await pool.query<{ account_id: string; tenant_id: string }>(
        'select account_id, tenant_id from refresh_family($1)',
        [sessionId],
      );
      const [row] = rows;
      return row ? { accountId: row.account_id, tenantId: row.tenant_id } : null;
    },

    authSignInRules: async (accountId) => {
      const { rows } = await pool.query<SignInRuleRow>('select * from auth_sign_in_rules($1)', [
        accountId,
      ]);
      return rows.map((row) => ({
        tenantId: row.tenant_id,
        twoStep: row.two_step,
        roleKeys: row.role_keys,
        passwordMinLength: row.password_min_length,
      }));
    },

    consumeSignedToken: async ({ nonce, purpose, expiresAt }) => {
      const { rows } = await pool.query<{ first_use: boolean }>(
        'select consume_signed_token($1, $2, $3) as first_use',
        [nonce, purpose, expiresAt],
      );
      return rows[0]?.first_use === true;
    },

    redeemSupportSession: async (supportSessionId, tokenHash) => {
      const { rows } = await pool.query<{ support_session_id: string }>(
        'select support_session_id from redeem_support_session($1, $2)',
        [supportSessionId, tokenHash],
      );
      return rows[0]?.support_session_id ?? null;
    },

    endSupportSession: async (tokenHash) => {
      await pool.query('select end_support_session($1)', [tokenHash]);
    },

    tenantByEmbedKey: async (key) => {
      const { rows } = await pool.query<{ tenant_id: string; form_id: string; active: boolean }>(
        'select tenant_id, form_id, active from tenant_by_embed_key($1)',
        [key],
      );
      const [row] = rows;
      return row ? { tenantId: row.tenant_id, formId: row.form_id, active: row.active } : null;
    },

    tenantByGatewayAccount: async (provider, accountId) => {
      const { rows } = await pool.query<{
        tenant_id: string;
        gateway_account_id: string;
        mode: string;
      }>('select tenant_id, gateway_account_id, mode from tenant_by_gateway_account($1, $2)', [
        provider,
        accountId,
      ]);
      const [row] = rows;
      return row
        ? { tenantId: row.tenant_id, gatewayAccountId: row.gateway_account_id, mode: row.mode }
        : null;
    },

    currentTenantProfile: async (tx) => {
      const { rows } = await tx.execute<ProfileRow>(sql`select * from current_tenant_profile()`);
      const [row] = rows;
      if (!row) {
        return null;
      }
      return {
        name: row.name,
        shortName: row.short_name,
        status: row.status,
        suspendReason: row.suspend_reason,
        timeZone: row.time_zone,
        locale: row.locale,
        currency: row.currency,
        brandColor: row.brand_color,
        logoFileId: row.logo_file_id,
        modules: row.modules,
        twoStep: row.two_step,
        passwordMinLength: row.password_min_length,
        sessionHours: row.session_hours,
        ipAllowlist: row.ip_allowlist,
        country: row.country,
      };
    },

    updateCurrentTenantName: async (tx, rename) => {
      const { rows } = await tx.execute<{ renamed: boolean | null }>(
        sql`select update_current_tenant_name(${rename.expected}, ${rename.name}) as renamed`,
      );
      return rows[0]?.renamed === true;
    },

    recordSupportAudit: async (tx, entry) => {
      await tx.execute(
        sql`select record_support_audit(${entry.supportSessionId}, ${entry.action},
              ${entry.targetType}, ${entry.targetId}, ${JSON.stringify(entry.meta)}::jsonb)`,
      );
    },

    ensureAccountForEmail: async (tx, email) => {
      const { rows } = await tx.execute<{ id: string | null }>(
        sql`select id from ensure_account_for_email(${email})`,
      );
      // `RETURN QUERY SELECT v_id` gives a row even when no id was found, so check the id itself.
      const id = rows[0]?.id;
      if (typeof id !== 'string') {
        throw new UnexpectedDefinerRowError('ensure_account_for_email');
      }
      return id;
    },

    memberTwoStepStatus: async (tx, userIds) => {
      if (userIds.length === 0) {
        return [];
      }
      const { rows } = await tx.execute<{ user_id: string; totp_enabled: boolean }>(
        sql`select user_id, totp_enabled from member_two_step_status(${sql.param([...userIds])}::uuid[])`,
      );
      return rows.map((row) => ({ userId: row.user_id, totpEnabled: row.totp_enabled }));
    },

    revokeMemberSessions: async (tx, userId) => {
      await tx.execute(sql`select revoke_member_sessions(${userId})`);
    },

    clearMemberPreview: async (tx, userId) => {
      await tx.execute(sql`select clear_member_preview(${userId})`);
    },

    memberAccountEmail: async (tx, userId) => {
      const { rows } = await tx.execute<{ email: string | null }>(
        sql`select member_account_email(${userId}) as email`,
      );
      return rows[0]?.email ?? null;
    },

    memberHasOtherMemberships: async (tx, userId) => {
      const { rows } = await tx.execute<{ shared: boolean }>(
        sql`select member_has_other_memberships(${userId}) as shared`,
      );
      return rows[0]?.shared === true;
    },

    currentSupportVisit: async (tx, supportSessionId) => {
      const { rows } = await tx.execute<{ platform_user_name: string }>(
        sql`select platform_user_name from current_support_visit(${supportSessionId})`,
      );
      const [row] = rows;
      return row ? { platformUserName: row.platform_user_name } : null;
    },
  };
}
