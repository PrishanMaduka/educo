/** A table privilege `quad_app` can hold. */
export type TablePrivilege = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';

/** An account table: the column that names the owning account, and what `quad_app` may do. */
export interface AccountTable {
  readonly key: 'id' | 'account_id';
  readonly privileges: readonly TablePrivilege[];
}

/** An open table: no RLS, and exactly these `quad_app` privileges. */
export interface OpenTable {
  readonly privileges: readonly TablePrivilege[];
}

/**
 * Account tables (D32): global identity rows with no `tenant_id`. RLS keys on
 * `<key> = app.account_id`, set by `withAccount`, so `quad_app` sees only one account's rows.
 * Add a table here in the same change that creates it, with `accountRlsSql` in its migration.
 */
export const ACCOUNT_TABLES: Readonly<Record<string, AccountTable>> = Object.freeze({
  accounts: { key: 'id', privileges: ['SELECT', 'INSERT', 'UPDATE'] },
  credentials: { key: 'account_id', privileges: ['SELECT', 'INSERT', 'UPDATE'] },
  identities: { key: 'account_id', privileges: ['SELECT', 'INSERT'] },
  sessions: { key: 'account_id', privileges: ['SELECT', 'INSERT', 'UPDATE'] },
  trusted_devices: { key: 'account_id', privileges: ['SELECT', 'INSERT', 'UPDATE'] },
});

/**
 * Open tables (D32): no tenant, no account and no RLS, because the row exists before anyone is
 * known. Each must hold nothing that identifies a person without a server key.
 */
export const OPEN_TABLES: Readonly<Record<string, OpenTable>> = Object.freeze({
  // A code is sent before the account is known; subject_hash and code_hash are HMAC-keyed.
  otp_challenges: { privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] },
});
