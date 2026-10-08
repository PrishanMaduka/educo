# M1 Auth, Tenancy and Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Everyone signs in at one domain. Staff use identifier-first sign-in at `quad-edu.com/sign-in` (password, TOTP, Google and Microsoft SSO, forgot password, lockout, **Choose a school**). Quad staff sign in to the console. Parents sign in to the Flutter app with an OTP, then JWT with refresh rotation and biometric unlock. Every tenant table has FORCE RLS. Every route is guarded by `@Can`/`@Module`. School admins manage **Users & roles**, the **School settings** shell and the **Audit** view, and can **Preview a role**. Quad support enters a school only through a reasoned, logged, 60-minute support session with a banner. Journeys 17, 18, 19, 42, 43 (web and enquiry parts) and 50 are green in `pnpm verify`.

**Architecture:**
- **Database.** Migrations `0003`–`0006` add three classes of table:
  - **tenant tables** (`[T]`, with the M0 `tenantRlsSql`);
  - **account tables** (global identity rows, with RLS keyed on `app.account_id`, proposed D32);
  - **platform tables** (closed to `quad_app`).

  Named security-definer functions are the only cross-tenant or cross-account reads (D16, D24).
- **API.** New modules:
  - `src/modules/{auth,me,users,roles,school,audit}`;
  - `src/public/{signed-links,enquiry}` (tenant-less, spec 05 Rules);
  - `src/platform/{auth,tenants,support,audit}` (the only `withPlatform` callers);
  - `src/common/{session,guards,rate-limit,crypto,delivery}`.
- **Web.**
  - `apps/staff`: a new `(auth)` route group for `/sign-in/**`; the `/app` shell reads the session and permissions.
  - `apps/console`: gains `/sign-in` and a session-aware shell.
- **Mobile.** `apps/parent/lib/features/auth` and `core/{auth,secure_store,lock}`.
- **Rules.** Permission maths, sign-in steps, lockout, OTP limits, session expiry and page access are pure functions in `packages/domain`.

**Tech Stack (new):**
- API:
  - `@node-rs/argon2` (Argon2id);
  - `otplib` (TOTP);
  - `openid-client` (OIDC with PKCE);
  - `jose` (EdDSA JWT and the fake OIDC issuer in tests);
  - `nodemailer` (SMTP to Mailpit; SES adapter stubbed to the same interface);
  - `@fastify/cookie`.
- Web: `qrcode` (the TOTP QR, rendered client-side).
- Flutter: `flutter_secure_storage` and `local_auth`.
- Pin exact versions at install and record them in D32. Each must pass `pnpm audit --prod --audit-level high` and `flutter pub outdated` review.

**Spec:**
- `docs/spec/18-delivery-plan.md`: M1 (Scope, Accept, Prompt) and M1b's "Built early" note.
- `docs/spec/02-architecture.md`:
  - Tenancy, Database roles and RLS (D17), Where the tenant comes from, Tenant-less entry points (D16);
  - Local development, Environment variables;
  - the decision log D12–D31, especially D16, D22, D24, D25, the D27 and D28 M1 follow-ups, D30 and D31.
- `docs/spec/04-data-model.md`: Platform; Identity; Tenant-less lookups.
- `docs/spec/05-auth-tenancy-rbac.md`: all of it.
- `docs/spec/06-api-and-events.md`: Conventions, Me and auth, Public, Platform (auth, tenants, support-session, audit), School settings and people, Realtime.
- `docs/spec/08-staff-portal.md`: Navigation, Users & roles, School settings.
- `docs/spec/07-platform-console.md`: Shell, School page header action, Platform users (TOTP), Audit log.
- `docs/spec/09-parent-app.md`: Start-up, More (Switch school, Sign out), Cache security, Re-lock.
- `docs/spec/16-security-privacy.md`: all of it.
- `docs/spec/17-testing-quality.md`: journeys 17, 18, 19, 42, 43, 50; Test pyramid; Quality gate.
- `docs/spec/19-public-site.md`: Where it lives; Sign-in.
- Prototypes:
  - `design/admin.html`: `authRender`, `schoolAuth`, `V.users`, the `RV` role-preview table, the support bar;
  - `design/platform.html`: `platformAuth`, the `impersonate` action;
  - `design/parent.html`: the `paGo` sign-in states, the lock screen.
- Project rules: `CLAUDE.md` and every `.claude/skills/quad-*` skill.

## Global Constraints

**Secrets, credentials and repository content**
- Commit no secrets: no real keys, passwords, DSNs or personal data.
  - Seed people are the fictional prototype people.
  - Local-only placeholders (as D25 did for `SESSION_SECRET`) are allowed only if the API refuses them outside `local`.
- Never read `.env`, `.env.*.local` or any `*.tfvars` (denied). Use `.env.example` and explicit `-e` flags.
- Never use AWS credentials from the environment.
- Never run `terraform plan`, `apply`, `destroy` or `init` with a backend. Infra edits (the new secrets in Task 4) are validated only with `node scripts/infra-check.mjs` (offline, `mock_provider`).
- Write no AI model name or model id into any repository file. The existing `ASSISTANT_MODEL` spec text stays untouched.
- Commits:
  - Conventional Commits, with the two attribution trailer lines the controller supplies (`Co-Authored-By: …`, `Claude-Session: …`);
  - run `quad-review` on the diff before each commit;
  - do not push unless the controller says so.
- Never edit `design/`.
- Regenerate generated files (`pnpm api:client`, `pnpm tokens:build`, `pnpm i18n:build`); never hand-edit them.
- Migrations are append-only (ruling R12). The next one is `0003_*`.

**Tenancy and security (blocking in review)**
- The tenant comes only from the session or token, or from a D16 entry point after verification. Never from body, path, query, host or the `?school=` hint (the hint only picks among the person's own memberships).
- Every tenant query runs inside `withTenant()`.
- `withPlatform()` is used only in `apps/api/src/platform/**` and `apps/api/src/worker/platform-jobs/**`, and every write there goes to `platform_audit`.
- Tenant-less routes live only in `apps/api/src/public/**` or `apps/api/src/webhooks/**`. Each has a forged and an expired token test, and opens `withTenant()` only after the check.
- New security-definer functions:
  - are owned by `quad_owner`;
  - pin `search_path`;
  - return the minimum columns;
  - grant `EXECUTE` to `quad_app` only;
  - have a cross-tenant test and a D32 entry.
- Every endpoint gets four tests: happy path, 400 `validation`, 403 (`forbidden`, `module_not_in_plan` or `preview_read_only` as applicable), and cross-tenant (404 by id, absent from lists).
  - For tenant-less auth routes, "permission" becomes 401/`invalid_link`.
  - For these routes, "cross-tenant" becomes "the token or membership of school A never reaches school B".
- Nothing logs phone numbers, emails, codes, tokens, passwords or TOTP secrets. Signed-link tokens appear only in paths, and the request log records route templates (D25).
- Safeguarding and medical data are refused in support sessions (spec 05).

**Configuration**
- A new variable goes into the spec 02 table, `.env.example` (same order) and `apps/api/src/config.ts` (or `NOT_READ_BY_THE_API`) in one commit. The parity tests enforce it.
- `CONSOLE_PASSWORD_LOGIN=true` and `DEV_FIXED_OTP` stay refused at boot in production (already in `config.ts`; keep the tests).

**UI**
- Web:
  - Tailwind token utilities and `packages/ui` only;
  - forms in right-side `Drawer`s;
  - story-first pages;
  - every page works at 390 px and in dark mode, with axe clean;
  - copy from `packages/contracts/i18n/en.json`;
  - buttons say what happens; toasts say what happened.
- Flutter: `QuadColors`, ARB strings and four states per screen.
- Spec wins over prototype. Conflicts are listed in Open Questions, and each one is resolved in D32.

**The live pre-launch site (D30, D31)**
- GitHub Pages publishes `apps/staff/site-export/out`, built from `main` with `NEXT_PUBLIC_QUAD_PRELAUNCH=true`. M1 must not change what that export contains or shows.
- How:
  1. **Keep new routes out of the export root.**
     - `/sign-in/**` lives in `apps/staff/src/app/(auth)/` and the portal in `src/app/app/`.
     - `site-export/app/` re-exports only the root layout, `(public)` layout, landing and 404. Add nothing there.
  2. **Keep the root layout unchanged.**
     - The root layout `src/app/layout.tsx` is re-exported by the export. Auth providers, TanStack Query and session code go only in `src/app/(auth)/layout.tsx` and `src/app/app/layout.tsx`.
     - Task 17 adds a test that `src/app/layout.tsx` imports nothing from `@/lib/session`, `@quad/client` or `(auth)`.
  3. **Extend the export check.** `apps/staff/scripts/build-export.mjs` `checkExport()` must also refuse `sign-in`, `sign-in.html` and any `sign-in/` folder. It gets a unit test.
  4. **Assert the export is unchanged.** The `export-*` projects in `e2e/landing.spec.ts` assert that `/sign-in` is a 404 on the served export and that no `a[href^="/sign-in"]` exists (that assertion is already there).
  5. **Leave the landing alone.**
     - Do not touch `src/app/(public)/**`. `SignInEntry` keeps its D30 behaviour: the coming-soon note when `NEXT_PUBLIC_QUAD_PRELAUNCH=true`, otherwise a link to `/app`.
     - In the normal build, `/app` redirects a signed-out visitor to `/sign-in?next=/app`. Journey 17 works from the landing's **Sign in** that way.
     - The landing **sign-in dialog**, `/#signin` and **Open {school}** are M1b (spec 19, M1b scope). M1 does not build them.
  6. **Keep the Pages workflow green.** `pages.yml` must stay green on every M1 commit (`build:export` and `e2e:export`). Run both in Task 26, and compare the export's landing screenshots with `docs/screenshots/landing/` (no visual change).

## Review Focus

1. **Account enumeration.**
   - `POST /auth/identify` returns a byte-identical body and the same status for an unknown email and a known one at the same domain.
   - `POST /auth/password/forgot` and `POST /auth/otp/request` answer 202 either way.
   - Timing is equalised with a dummy Argon2 verify.
   - Task 7 and Task 9 own the tests.
2. **Choosing a school you don't belong to.**
   - `POST /auth/select-school` with a tenant the account has no active membership in, or a membership that is deactivated, or a tenant that is suspended, is refused, and the session stays without a school.
   - `?school=` never selects a tenant on its own.
   - Task 7 owns the test.
3. **Signed links.** These are all refused with `400 invalid_link` and no school name in the body:
   - a tampered payload;
   - a re-signed payload with another key;
   - a wrong purpose;
   - an expired token;
   - a reused single-use nonce.

   Task 4 owns the unit tests, Task 7 the API tests and Task 25 journey 43.
4. **Raw-query isolation.** As `quad_app`, `select * from <each tenant table>` returns only school A's rows with `app.tenant_id = A`, and nothing with no school. For account tables, it returns only the current account's rows. Task 2 owns the test.
5. **Preview and support cannot write or see sensitive data.**
   - While previewing, every non-GET route except `DELETE /me/role-preview` and `POST /auth/sign-out` returns 403 `preview_read_only`.
   - A support session gets 403 on any route marked `@Sensitive('safeguarding' | 'medical')`, whatever the role.
   - Task 12 and Task 16 own the tests.
6. **Refresh token reuse.** Presenting a rotated-out parent refresh token revokes the whole family. The next refresh with the newest token then fails 401. Task 9 owns the test.

---

## Phase 1: Schema and RLS

### Task 1: Account tables, platform access tables and a third table class in the migration test

Follow `quad-tenant-table` and `quad-architecture`.

**Files:**
- Create:
  - `packages/db/src/schema/account/{accounts,credentials,identities,sessions,trusted-devices,otp-challenges}.ts`;
  - `packages/db/src/schema/platform/{platform-users,platform-audit,support-sessions,signed-token-uses,tenant-branding,tenant-modules,tenant-security}.ts`;
  - `packages/db/src/account-tables.ts`;
  - `packages/db/src/account.ts` (`withAccount`);
  - `packages/db/migrations/0003_accounts.sql` and `0004_platform_access.sql` (generated, plus the RLS and grant SQL);
  - `packages/db/test/account-rls.api.test.ts`.
- Modify:
  - `packages/db/src/{rls.ts,platform-tables.ts,db.ts,index.ts,client.ts,schema/index.ts}`;
  - `packages/contracts/src/enums.ts`;
  - `packages/db/test/{migration.test.ts,factories.ts}`.

**Tables (account class: global rows, no `tenant_id`; RLS `account_id = nullif(current_setting('app.account_id', true), '')::uuid`, ENABLE + FORCE; explicit `quad_app` grants):**

| Table | Columns (spec 04 plus the M1 additions in bold) | Index | quad_app |
|---|---|---|---|
| `accounts` | id, email citext unique null, phone_e164 unique null (check: at least one), status `account_status` (`active`,`locked`,`disabled`), **locked_until**, created_at, last_sign_in_at | unique email, unique phone | S, I, U |
| `credentials` | account_id pk, password_hash, totp_secret_enc, totp_enabled, recovery_codes_hash text[], **password_changed_at** | pk | S, I, U |
| `identities` | id, account_id, provider `sso_provider`, subject, email; unique (provider, subject) | (account_id) | S, I |
| `sessions` | the spec 04 columns, plus **token_hash** (unique), **stage** `session_stage` (`two_step`,`two_step_setup`,`choose_school`,`active`), **keep_signed_in**, **refresh_generation** int, **preview_role_id**, **preview_sample_user_id**, **support_session_id** | (account_id, revoked_at), unique token_hash, (active_tenant_id, active_user_id) | S, I, U |
| `trusted_devices` (new) | id, account_id, token_hash unique, created_at, expires_at, revoked_at | (account_id) | S, I, U |
| `otp_challenges` (open table: no account until verified; no RLS; in a separate `OPEN_TABLES` list) | id, subject_hash (HMAC of phone or email), channel `otp_channel`, code_hash, purpose, attempts, expires_at, created_at | (subject_hash, created_at desc) | S, I, U, D |

Notes:
- The policy on `sessions` is `account_id = app.account_id`. Console rows (`account_id` null, `platform_user_id` set) are therefore invisible to `quad_app`; console code reaches them through `withPlatform`.
- `withAccount(accountId, fn)` sets `app.account_id` (transaction-local). It also accepts `{ tenantId }` to set both settings in one transaction.

**Tables (platform class: no `quad_app` privilege; added to `PLATFORM_TABLES`):**
- `platform_users`: spec 04, plus **password_hash** (nullable; used only with `CONSOLE_PASSWORD_LOGIN`) and **totp_enabled**.
- `platform_audit`: spec 04. Append-only: a trigger refuses UPDATE and DELETE, as the `quad-tenant-table` skill says.
- `support_sessions`: spec 04, plus **expires_at**.
- `signed_token_uses`: spec 04.
- `tenant_branding`, `tenant_modules` and `tenant_security`: spec 04.
- Each foreign key (`tenant_id`, `platform_user_id`) is indexed.

**Migration test changes (`rls.ts` `findTenancyViolations`):**
- A table is a tenant table, an account table (`ACCOUNT_TABLES`), an open table (`OPEN_TABLES`) or a platform table (`PLATFORM_TABLES`). Anything unclassified fails.
- Account tables must have `account_id`, FORCE RLS, exactly the account policy, and `quad_app` privileges equal to their declared set.
- D27 follow-up: the platform check also covers column-level grants and sequences, so `quad_app` holds no column privilege on a platform table and no `USAGE`/`SELECT` on platform sequences.
- D27 follow-up: connection reset also runs `pg_advisory_unlock_all()` and `DISCARD TEMP` after `RESET ALL` (`client.ts`), with a test.

Steps:
- [ ] **Step 1: Write failing tests.**
  - `migration.test.ts`:
    - every table is classified;
    - a probe account table without FORCE fails with `<name>: FORCE ROW LEVEL SECURITY missing`;
    - a probe platform table with a column grant to `quad_app` fails;
    - `quad_app` has no privilege on any platform table.
  - `account-rls.api.test.ts`:
    - under `withAccount(A)`, `quad_app` sees only A's `accounts`, `credentials`, `sessions` and `trusted_devices`;
    - with no account set it sees none;
    - inserting a `sessions` row for B under A fails WITH CHECK.
  - `client` test: after a transaction that took an advisory lock and a temp table, the next checkout holds neither.
- [ ] **Step 2: Run them to see them fail.** `pnpm --filter @quad/db test:api`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Add the enums to `@quad/contracts` `enums.ts`: `AccountStatus`, `SsoProvider`, `SessionKind`, `SessionStage`, `OtpChannel`, `PlatformRole`, `TwoStepRule`, `PlanModule`, `MembershipKind`, `MembershipStatus`, `RoleScope`, `SensitiveKey`.
  - Run `pnpm db:generate`, then append an `accountRlsSql(table)` helper's output (ENABLE, FORCE, policy, grants) and the triggers.
- [ ] **Step 4: Run the checks.** `pnpm db:migrate && pnpm --filter @quad/db test && pnpm --filter @quad/db test:api`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(db): account and platform access tables with account-scoped RLS`.

**Acceptance:** M1 Accept bullet "the app role cannot read another tenant's rows even with a raw query" (the account half). The migration test now covers every table.

### Task 2: Tenant identity tables with FORCE RLS and cross-tenant tests

**Files:**
- Create:
  - `packages/db/src/schema/tenant/{users,roles,role-permissions,role-sensitive,user-roles,school-settings,audit-log}.ts`;
  - `packages/db/migrations/0005_identity_tenant.sql`;
  - `packages/db/test/identity-tenant.api.test.ts`.
- Modify: `packages/db/src/schema/index.ts`, `packages/db/test/factories.ts` (factories for every new table), `packages/contracts/src/enums.ts`.

**Tables.** Each has `tenant_id uuid not null references tenants(id)`, a `(tenant_id, …)` index, ENABLE + FORCE RLS, the `tenant_isolation` policy through `tenantRlsSql`, and the cross-tenant test below. Composite FKs `(tenant_id, x_id) → x(tenant_id, id)` follow D23.

| Table | Key columns | Indexes |
|---|---|---|
| `users` [T][S] | spec 04 | unique (tenant_id, account_id); (tenant_id, kind, status); (tenant_id, email) |
| `roles` [T] | spec 04; unique (tenant_id, key) | (tenant_id, system) |
| `role_permissions` [T] | tenant_id, role_id, module `plan_module_or_settings`, actions bit(5); pk (tenant_id, role_id, module) | (tenant_id, role_id) |
| `role_sensitive` [T] | tenant_id, role_id, key `sensitive_key`; pk (tenant_id, role_id, key) | (tenant_id, role_id) |
| `user_roles` [T] | tenant_id, user_id, role_id, primary bool; pk (tenant_id, user_id, role_id); partial unique (tenant_id, user_id) where primary | (tenant_id, role_id) |
| `school_settings` [T] | spec 04, plus **address** (08 General lists it; no column exists) and **sms_sender_status** (`requested`,`approved`; 08 "QUAD until approved") | pk (tenant_id) |
| `audit_log` [T] | spec 04, plus **support_session_id**; append-only trigger | (tenant_id, at desc), (tenant_id, actor_user_id, at desc), (tenant_id, action, at desc) |

Other notes:
- The permission-matrix module enum is the spec 05 list: `admissions`, `crm`, `sis`, `attendance`, `lms`, `fees`, `finance`, `transport`, `settings`. It is separate from `tenant_modules.module` (spec 04: `parent` instead of `attendance` and `settings`). Mapping lives in Task 11.
- `devices`, `staff_profiles`, `guardians` and `guardian_invites` are not created in M1. They arrive with M3 and M6, the milestones that write them.

Steps:
- [ ] **Step 1: Write failing tests** (`identity-tenant.api.test.ts`, two real tenants through `quad_app`). For each table:
  - a row written under A is invisible under B;
  - writing with B's `tenant_id` while in A fails;
  - with no `app.tenant_id`, `select count(*)` is 0;
  - a raw `quad_app` pool query with `set_config('app.tenant_id', A)` returns only A's rows (Review Focus #4).
  - Also: `audit_log` refuses UPDATE and DELETE.
- [ ] **Step 2: Run them to see them fail.** Expected: FAIL.
- [ ] **Step 3: Implement** with `pnpm db:generate` plus `tenantRlsSql` for each table.
- [ ] **Step 4: Run the checks.** `pnpm db:migrate && pnpm --filter @quad/db test:api`. Expected: PASS, with `findTenancyViolations` empty.
- [ ] **Step 5: Commit.** `feat(db): tenant identity, roles, school settings and audit tables with FORCE RLS`.

**Acceptance:** M1 Scope "RLS policies with FORCE ROW LEVEL SECURITY on every tenant table, with the migration test from M0 covering them all". Accept: "the app role cannot read another tenant's rows even with a raw query".

### Task 3: Security-definer lookups (D16) and the definer calls

**Files:**
- Create:
  - `packages/db/migrations/0006_definers.sql`;
  - `packages/db/test/definers.api.test.ts`.
- Modify: `packages/db/src/definers.ts` (extend `DefinerCalls`), `packages/db/src/index.ts`.

**Functions.** All are `SECURITY DEFINER`, owned by `quad_owner`, `SET search_path = public, pg_temp`, `REVOKE ALL FROM PUBLIC`, `GRANT EXECUTE TO quad_app`.

| Function | Returns | Rule |
|---|---|---|
| `auth_memberships(p_account_id uuid)` (spec) | tenant_id, tenant_name, short_name, logo_file_id, brand_color, kind, user_id, role_names text[] | Only active memberships of tenants with status in (`trial`,`onboarding`,`active`,`past_due`). Suspended tenants are returned with `suspended = true` and the reason, so sign-in can show it (spec 07, journey 23 in M2). Never emails or phones |
| `account_by_identifier(p_email citext, p_phone text)` (new) | id, status, locked_until | Exactly one of the two arguments |
| `session_by_token(p_token_hash bytea)` (new) | the session row's ids, stage, kind, expiry, revoked flag, preview and support ids | Not revoked; used once per request (cached in Redis) |
| `sso_methods_for_domain(p_domain citext)` (new) | google bool, microsoft bool | True when any active tenant has that `sso_domain` with the provider on. No tenant id |
| `auth_sign_in_rules(p_account_id uuid)` (new) | two_step_required bool, password_min_length int | The strictest across the account's active staff memberships (spec 05 step 4) |
| `current_tenant_profile()` (new; reads only `app.tenant_id`) | name, short_name, status, suspend_reason, time_zone, locale, currency, brand_color, logo_file_id, modules text[], two_step, sso_google, sso_microsoft, sso_domain, password_min_length, session_hours, ip_allowlist | No row without `app.tenant_id`. This is how school code reads platform-owned settings (D24) |
| `update_current_tenant_name(p_name text)` (new) | void | Updates `tenants.name` for `app.tenant_id` only, and writes `platform_audit` |
| `consume_signed_token(p_nonce text, p_purpose text, p_expires_at timestamptz)` (new) | boolean | `insert … on conflict do nothing`; true only the first time |
| `record_support_audit(p_support_session_id uuid, p_action text, p_target_type text, p_target_id uuid, p_meta jsonb)` (new) | void | Inserts into `platform_audit` only if that support session is active and its tenant equals `app.tenant_id` |
| `tenant_by_embed_key(p_key text)` (spec; **stub**) | tenant_id, form_id, active | Body `where false` until M4 creates `enquiry_forms`; the signature is fixed now |
| `tenant_by_gateway_account(p_provider text, p_account_id text)` (spec; **stub**) | tenant_id, gateway_account_id, mode | Body `where false` until M7 |

Steps:
- [ ] **Step 1: Write failing tests** (`definers.api.test.ts`).
  - `auth_memberships`:
    - returns A and B for a two-school account and omits a deactivated membership;
    - omits a `deleted` tenant;
    - flags a suspended tenant;
    - returns no email or phone column.
  - `current_tenant_profile()`: under `withTenant(A)` returns A only; with no tenant returns 0 rows.
  - `update_current_tenant_name`: cannot change B while in A.
  - `consume_signed_token`: true, then false.
  - `record_support_audit`: refuses a session for another tenant and an ended session.
  - The two stubs return 0 rows for any input.
  - As `quad_app`, `select * from tenant_security` still fails with permission denied.
- [ ] **Step 2: Run them to see them fail.** Expected: FAIL.
- [ ] **Step 3: Implement** the SQL and the typed `DefinerCalls` methods (`authMemberships`, `accountByIdentifier`, `sessionByToken`, `ssoMethodsForDomain`, `authSignInRules`, `consumeSignedToken`, `tenantByEmbedKey`, `tenantByGatewayAccount`). `currentTenantProfile`, `updateCurrentTenantName` and `recordSupportAudit` run inside `withTenant` through a `tx` helper.
- [ ] **Step 4: Run the checks.** `pnpm db:migrate && pnpm --filter @quad/db test:api`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(db): security-definer lookups for sign-in, tenant profile and signed tokens`.

**Acceptance:** M1 Scope "`auth_memberships` … `tenant_by_embed_key` and `tenant_by_gateway_account` stubs with tests".

## Phase 2: Tokens, signed links and the plumbing they need

### Task 4: Signed links, field encryption, password hashing and token keys

Follow `quad-coding-standards` and `quad-domain-logic` (the expiry and purpose rules).

**Files:**
- Create:
  - `packages/contracts/src/auth/signed-link.ts` (purposes, payload schema);
  - `packages/domain/src/auth/{signed-link-status,password-policy}.ts` with tests;
  - `apps/api/src/common/crypto/{signed-links,field-cipher,passwords,breach-check,jwt-keys}.ts`;
  - `apps/api/test/crypto/*.test.ts`.
- Modify:
  - `apps/api/src/config.ts`, `.env.example`, `docs/spec/02-architecture.md` (variables table);
  - `infra/modules/app/secrets.tf` and its test (new secrets; offline only);
  - `apps/api/src/tokens.ts`.

**Domain:**
- `signedLinkStatus(payload, expectedPurpose, now)` returns `ok`, `expired`, `wrong_purpose` or `malformed`.
- `checkPasswordPolicy(password, { minLength })`: at least 10 characters, or the school's higher minimum. It returns reasons as codes.
- `SIGNED_LINK_RULES`: a table of purpose to `{ ttl, singleUse }`:
  - `password_reset`: 30 min, single use;
  - `staff_invite`: 7 days, single use (OQ7);
  - `guardian_invite`: 30 days, single use;
  - `relative_invite`: 30 days, single use;
  - `support_session`: 2 min, single use;
  - `calendar_feed`: no expiry, reusable;
  - `email_link`: 30 days, reusable.

**API:**
- `signLink({ purpose, tid, sub }, now)` builds `base64url(payload).base64url(HMAC-SHA256(payload, LINK_SIGNING_SECRET))` (spec 05) with a 128-bit `nonce`.
  - `tid` is nullable only for `password_reset` started from Forgot password (OQ8).
- `verifyLink(token, purpose, now)` checks, in order:
  1. a constant-time signature comparison;
  2. the payload schema;
  3. `signedLinkStatus`;
  4. `consume_signed_token` for single-use purposes.

  Any failure is a `400 invalid_link` with one message, never naming the school.
- `FieldCipher`: AES-256-GCM, `v1.<iv>.<ciphertext>.<tag>`, with the key derived by HKDF-SHA256 from `FIELD_ENCRYPTION_KEY` (32 characters or more).
  - It sits behind an interface, so a KMS adapter (`KMS_KEY_ID`) can replace it in M12 (D32).
  - It encrypts TOTP secrets now.
- `PasswordHasher`: Argon2id (`m=19456, t=2, p=1`), with `verifyDummy()` to equalise timing.
- `BreachCheck`: the k-anonymity range API (`api.pwnedpasswords.com/range/<5>`, `Add-Padding`) with a 2 s timeout that fails open and logs a metric. Tests and `APP_ENV=local` use the injected offline fake (OQ14).
- `JwtKeys`: EdDSA (Ed25519) from `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY`.

**Config (D27 follow-up: format rules):**
- Now required in every environment: `FIELD_ENCRYPTION_KEY`, `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY`.
- `.env.example` gets local-only placeholder values, which the API refuses outside `local` (the D25 pattern). That includes a published Ed25519 test key pair.
- `SEED_PASSWORD` gets a local-only placeholder, refused outside `local`.
- Infra:
  - `FIELD_ENCRYPTION_KEY` joins `generated_app_secrets` (a 64-character ephemeral `random_password`);
  - `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` get hand-set placeholders (the `SENTRY_DSN` pattern), with a first-deploy checklist step in `infra/README.md` (`openssl genpkey -algorithm ed25519`);
  - `SEED_PASSWORD` is set by hand for staging.
  - Check with `node scripts/infra-check.mjs --only modules/app`.

Steps:
- [ ] **Step 1: Write failing tests.**
  - Domain: table-driven tests for `signedLinkStatus`, including the exact expiry instant (`exp == now` is expired) and every purpose, plus a `fast-check` property that a payload never verifies under a different purpose.
  - Unit tests:
    - a round trip works;
    - flipping one payload byte gives `invalid_link`;
    - a token signed with `SESSION_SECRET` gives `invalid_link`;
    - a reused single-use nonce gives `invalid_link`;
    - `FieldCipher` refuses a changed tag;
    - Argon2 verifies, and refuses a wrong password;
    - the breach fake flags `password123`;
    - the config refuses the placeholder key in `staging` and refuses a key under 32 characters.
  - The infra test asserts the new secrets exist and that the task definition passes them to api and worker.
- [ ] **Step 2: Run them to see them fail.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the checks.** `pnpm --filter @quad/domain test && pnpm --filter @quad/api test && node scripts/infra-check.mjs --only modules/app`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(api): signed links, field encryption, Argon2id passwords and token keys`.

**Acceptance:** Accept "a tampered or reused signed link is refused" (unit level). M1 Scope "signed-link tokens (HMAC-SHA256, purpose, tid, subject, expiry, nonce, single use)".

### Task 5: Rate limits, email and SMS delivery

**Files:**
- Create:
  - `apps/api/src/common/rate-limit/{rate-limit.module.ts,rate-limit.service.ts,rate-limit.decorator.ts}`;
  - `apps/api/src/common/delivery/{email.ts,smtp-email.ts,ses-email.ts,sms.ts,log-sms.ts,delivery.module.ts}`;
  - `apps/api/src/worker/jobs/{send-email.processor.ts,send-sms.processor.ts}`;
  - `apps/api/src/common/delivery/templates/*.ts` (invite, password reset, lockout, two-step reminder, new device, email OTP);
  - `apps/api/test/fakes/{email.ts,sms.ts}`;
  - `apps/api/test/delivery/*.test.ts`.
- Modify: `apps/api/src/{app.module.ts,worker.ts,tokens.ts}`, `packages/contracts/i18n/en.json`.

**Behaviour:**
- `RateLimitService.hit(key, limit, windowSeconds, now)`: a Redis fixed window (a Lua script) that returns `{ allowed, retryAfter }`.
- The `@RateLimit` decorator and a global interceptor apply:
  - 20 per minute per IP on `/auth/*` and `/platform/auth/*` (spec 06);
  - 600 per minute per user everywhere;
  - 429 `rate_limited` with `Retry-After`.
- Email:
  - `smtp` (Mailpit locally) and an `ses` adapter behind one interface. SES sends are wired, but untested beyond a fake until staging (D19).
  - From "{School} via Quad" for school mail, and "Quad" for account mail; Reply-To is the school's office email (D19).
  - Every send is a BullMQ job (idempotent on a job id).
- SMS: the `log` provider prints `+94 77 *** **01` and the code only when `APP_ENV=local` (spec 02: codes in the API log; spec 16: no phone numbers in logs, hence the mask). `live` (Notify.lk or Twilio) is out of M1 (OQ12).
- Jobs run inside a tenant request context built from the job's verified payload (D28 M1/M6 follow-up), so job spans carry `tenant_id`.

Steps:
- [ ] **Step 1: Write failing tests.**
  - Rate limit: the 21st call in a minute is refused, and the window resets on a fixed clock.
  - Templates render with no unfilled ICU arguments.
  - The SMTP adapter delivers to Mailpit (api test, compose Mailpit).
  - The job is idempotent on its id.
  - The log SMS output contains no full number.
- [ ] **Step 2: Run them to see them fail.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the checks.** `pnpm --filter @quad/api test && pnpm --filter @quad/api test:api -- delivery`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(api): Redis rate limits and queued email and SMS delivery`.

## Phase 3: Auth API flows

### Task 6: Sessions, the auth guard, CSRF and authenticated sockets

**Files:**
- Create:
  - `apps/api/src/common/session/{session.service.ts,session.repository.ts,cookies.ts,csrf.ts,request-auth.ts}`;
  - `apps/api/src/common/guards/{auth.guard.ts,public.decorator.ts}`;
  - `apps/api/src/modules/me/{me.module.ts,me.controller.ts,me.service.ts,me.routes.ts}` (`GET /me`, `PATCH /me`, `GET /me/sessions`, `DELETE /me/sessions/:id`);
  - `packages/contracts/src/me/*.ts`;
  - `packages/domain/src/auth/session-expiry.ts` with tests;
  - `apps/api/test/auth/{session,csrf,me}.api.test.ts` and `apps/api/test/realtime-auth.api.test.ts`.
- Modify:
  - `apps/api/src/{app.ts,common/request-context.ts,realtime/realtime.service.ts,observability/tenant-span-processor.ts,webhooks/ses/ses-webhook.controller.ts}`;
  - `packages/contracts/src/observability/telemetry-scrub.ts` (signed-link path rule);
  - `apps/staff/next.config.ts` (proxy `/socket.io` locally).

**Behaviour:**
- **Cookies:**
  - staff: `__Host-quad_sid`; console: `__Host-quad_console_sid`;
  - both HttpOnly, Secure and SameSite=Lax;
  - locally (`APP_ENV=local`, plain http) they are named `quad_sid` and `quad_console_sid`, without `Secure` (D32);
  - the cookie holds 32 random bytes, and the database stores the SHA-256 (`token_hash`).
- **Session lookup:** through `session_by_token`, cached in Redis for 30 s and invalidated on revoke. It feeds `RequestContext` with `accountId`, `tenantId` (only when `stage = active`), `userId`, `kind`, `previewRoleId` and `supportSessionId`. The guard tags the active span with `tenant_id` (D28 follow-up).
- **Expiry:** `sessionExpiry({ kind, keepSignedIn, sessionHours, supportExpiresAt, lastSeenAt, now })`:
  - web: the school's `session_hours` (default 12 h), or 30 days with "Keep me signed in";
  - console: 8 h idle;
  - support: 60 min hard.
- **Global `AuthGuard`:**
  - every route needs an active session or a valid bearer JWT unless marked `@Public()` or `@PreAuth(stage)`;
  - `/health/*`, `/openapi.json`, `/webhooks/ses` (D28 follow-up), `/auth/identify`, `/auth/password` and the other sign-in steps are public or pre-auth;
  - a session or token whose membership or tenant is no longer active returns 401 (spec 16, "switches into a school they no longer belong to").
- **CSRF:** double submit. A readable `quad_csrf` cookie holds HMAC(SESSION_SECRET, token_hash), and every cookie-authenticated non-GET request must send `X-CSRF-Token`. Bearer requests are exempt.
- **`text/plain` bodies:** refused with 415 on every route except `POST /webhooks/ses` (D28 follow-up).
- **Socket.IO:**
  - `allowRequest` accepts an `Origin` equal to `PUBLIC_WEB_URL` or `CONSOLE_URL`, or no Origin (the parent app);
  - it authenticates with the cookie or `auth.token`;
  - it joins `tenant:{id}` and `user:{id}`, or `platform` for console sessions (spec 06 Realtime; D28 follow-up);
  - staff proxies `/socket.io` to `:4000` locally.
- **`GET /me`** returns:
  - the person (name, first name, theme, locale);
  - the school (name, short name, time zone, brand: `{ color, fill, fillDark, ink }`, computed with `@quad/tokens` `fillFor` per D27 and D32);
  - the other memberships, for Switch school;
  - `preview` and `support` banners' data;
  - `greeting` (period and word from `greetingPeriod` in the school's time zone; the D27 M1 follow-up "the API returning the greeting", with `GreetingPeriod` moved to `@quad/contracts` so `packages/ui` drops `@quad/domain`).
- The **telemetry scrubber** gets an explicit pattern for `/sign-in/(reset|invite|support)/<token>` and `/auth/invites/<token>` (D28 follow-up), plus a scrub of pg error `detail` and `where` (D27 follow-up).

**Endpoints (four tests each):**

| Route | Contract | Guard / permission | Tests |
|---|---|---|---|
| `GET /me` | `Me` | session | 200 shape; 401 unauthenticated; preview reflected; B's session never shows A |
| `PATCH /me` | `MeUpdateInput` (name, theme, locale) | session; refused in preview | 200; 400 bad theme; 403 `preview_read_only`; cross-tenant: changes only the current membership |
| `GET /me/sessions` | `paginated(SessionSummary)` | session | own sessions only; another account's never listed |
| `DELETE /me/sessions/:id` | – | session, CSRF | 204; 400 bad id; 403 missing CSRF; 404 for another account's session id |

Steps:
- [ ] **Step 1: Write failing tests.** The table above, plus:
  - an expired idle session is 401;
  - a revoked session is 401 within one request (cache invalidation);
  - the `text/plain` POST is 415 except `/webhooks/ses`;
  - a socket from `https://evil.example` is refused;
  - a socket with no Origin and no token gets no rooms.
- [ ] **Step 2: Run them to see them fail.** Expected: FAIL.
- [ ] **Step 3: Implement.** Register `@fastify/cookie`. Declare the routes in `me.routes.ts`, list them in `src/openapi/document.ts`, and run `pnpm api:client`.
- [ ] **Step 4: Run the checks.** `pnpm --filter @quad/api test && pnpm --filter @quad/api test:api -- auth me realtime && pnpm codegen:check`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(api): server-side sessions, auth guard, CSRF and authenticated sockets`.

### Task 7: Staff sign-in: identify, password, two-step, lockout, Choose a school, forgot and reset

Follow `quad-api-endpoint` and `quad-domain-logic`.

**Files:**
- Create:
  - `apps/api/src/modules/auth/{auth.module.ts,auth.controller.ts,auth.service.ts,sign-in.service.ts,two-step.service.ts,memberships.service.ts,auth.routes.ts}`;
  - `apps/api/src/public/signed-links/{password-reset.controller.ts,password-reset.service.ts}`;
  - `packages/contracts/src/auth/*.ts`;
  - `packages/domain/src/auth/{next-sign-in-step,lockout,two-step-rule,recovery-codes}.ts` with tests;
  - `apps/api/test/auth/{identify,password,totp,lockout,memberships,select-school,forgot-reset}.api.test.ts`.
- Modify: `packages/contracts/src/common/errors.ts` (codes `invalid_credentials`, `account_locked`, `invalid_link`, `two_step_required`, `preview_read_only`, `invalid_code`), `packages/contracts/i18n/en.json`.

**Domain:**
- `nextSignInStep({ totpEnabled, twoStepRequired, trustedDevice, membershipCount, rememberedTenantId })` returns `two_step`, `two_step_setup`, `choose_school`, `no_school` or `done`.
- `lockoutState(failureTimes, now)`: 5 failures within 15 minutes lock the account until `now + 15 min` (spec 05 step 7).
- `strictestTwoStep(memberships)`: `off < admins < staff < all`, matched against the role keys in each school.
- `generateRecoveryCodes(rng)`: 10 codes, with `rng` injected.

**Endpoints (contracts in `packages/contracts/src/auth`; `@Public` or `@PreAuth`; 20/min per IP):**

| Route | Behaviour | Required tests (beyond happy and 400) |
|---|---|---|
| `POST /auth/identify` `{email}` → `{methods}` | `methods` from `sso_methods_for_domain(domain(email))`, plus `password`. Never reads the account | **Identical body and status for unknown and known emails** (Accept); 429 after 20/min per IP and 10/15 min per email |
| `POST /auth/password` `{email, password, keepSignedIn}` → `{next, …}` | Argon2 verify (dummy for unknown); lockout; breach check only on set, not on sign-in. Creates a pre-auth session (stage per `nextSignInStep`), sets the cookie, and audits a failure to every school the account is staff in (OQ11) | Wrong password and unknown email both give the same 401 `invalid_credentials`; the 6th try gives 423-style 403 `account_locked`, and the lockout email is queued; a disabled account is 401 |
| `POST /auth/totp/verify` `{code} \| {recoveryCode}, trustDevice` | `otplib` with ±1 step; `DEV_FIXED_OTP` accepted only when set (local and staging); a recovery code is single use; "Trust this device" writes `trusted_devices` and a 30-day cookie | A wrong code counts toward lockout; a reused recovery code is refused; 401 without a pre-auth session |
| `POST /me/totp` (start) and `POST /me/totp` `{code}` (confirm) → `{otpauthUri}` / `{recoveryCodes}` | Allowed at stage `two_step_setup` or `active`; the secret is encrypted with `FieldCipher` | Refused at stage `choose_school`; refused in preview; a code from another secret is refused |
| `GET /auth/memberships` → `{items:[{tenantId, name, shortName, logoUrl, brand, roleNames}]}` | Only after the password, SSO or OTP step (spec 16) | 401 at stage `two_step`; never lists a deactivated membership or a deleted school |
| `POST /auth/select-school` `{tenantId, remember}` | Must be one of `auth_memberships`. Rotates the session token (new cookie), sets `active_tenant_id`/`active_user_id`, writes the `auth.sign_in` audit in that school; `remember` sets the non-sensitive `quad_last_school` cookie (name, logo URL) | **Refuses a tenant the account is not a member of with 403, and the session keeps no school** (Accept); refuses a suspended school with 403 `school_suspended` and the reason; `?school=` alone never selects |
| `POST /auth/sign-out` | Revokes the session for every school (spec 05) | 204; the cookie is cleared; the old cookie then gets 401 |
| `POST /auth/password/forgot` `{email}` → 202 | Queues a `password_reset` link (`tid` null, OQ8) to `quad-edu.com/sign-in/reset/{token}` when the account exists | 202 either way, with identical bodies; rate-limited |
| `POST /auth/password/reset` `{token, password}` (`src/public/signed-links`) | Verifies the link; checks policy and breach; updates the hash; **revokes all sessions and trusted devices** | Second use gives `invalid_link`; expired, tampered or wrong-purpose give `invalid_link` without a school name (journey 43); a weak password gives 400 with `fields.password` |

Switching school is `POST /auth/select-school` again from an active session. It re-checks the membership and rotates (spec 05).

Steps:
- [ ] **Step 1: Write the domain tests** (table-driven, boundaries at exactly 5 failures and at 15:00 minutes), then the API tests above, plus Review Focus #1 and #2.
- [ ] **Step 2: Run them to see them fail.** Expected: FAIL.
- [ ] **Step 3: Implement.** Then `pnpm api:client`.
- [ ] **Step 4: Run the checks.** `pnpm --filter @quad/domain test && pnpm --filter @quad/api test:api -- auth && pnpm codegen:check`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(auth): identifier-first staff sign-in with two-step, lockout, school choice and password reset`.

**Acceptance:**
- Accept "`/auth/identify` returns the same response for unknown emails".
- Accept "`select-school` refuses a tenant the account is not a member of".
- Accept "a tampered or reused signed link is refused" (API level).

### Task 8: Google and Microsoft SSO (OIDC with PKCE), mocked in tests

**Files:**
- Create:
  - `apps/api/src/modules/auth/sso/{sso.controller.ts,sso.service.ts,oidc-clients.ts}`;
  - `apps/api/test/fakes/oidc-issuer.ts` (a small Fastify server: discovery, JWKS, authorize, token; ID tokens signed with `jose`);
  - `scripts/fake-oidc.mjs` (the same issuer for Playwright);
  - `apps/api/test/auth/sso.api.test.ts`.
- Modify: `apps/api/src/config.ts`, `.env.example` and spec 02 (new variable `OIDC_FAKE_ISSUER_URL`, refused outside `local`; when set, the Google, Microsoft and console Google clients use it; D32).

**Endpoints:**
- `POST /auth/sso/:provider/start` `{email, keepSignedIn}` returns `{url}`:
  - the state, nonce and PKCE verifier go in a short-lived signed cookie;
  - `provider` is `google` or `microsoft`; anything else gives 400.
- `GET /auth/sso/:provider/callback`:
  - verifies the state, nonce, PKCE and ID token;
  - the email domain must equal the `sso_domain` of a school with that provider on, **and** the account must have an active staff membership there;
  - links an `identities` row on first use;
  - then continues with `nextSignInStep` (two-step still applies) and redirects to `/sign-in?step=…`.

**Required tests:**
- the happy path links the identity once;
- 400 for an unknown provider;
- a forged state or a wrong nonce gives 401;
- an email outside the school's `sso_domain` gives 403;
- an SSO domain of school A cannot open school B when the account has no B membership (cross-tenant);
- the second sign-in reuses the identity.

Steps:
- [ ] **Step 1: Write the tests against the fake issuer.**
- [ ] **Step 2: Run them to see them fail.** Expected: FAIL.
- [ ] **Step 3: Implement with `openid-client`.** Then `pnpm api:client`.
- [ ] **Step 4: Run the checks.** `pnpm --filter @quad/api test:api -- sso`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(auth): Google and Microsoft SSO with PKCE and a fake issuer for tests`.

### Task 9: Parent OTP sign-in, JWT access tokens and refresh rotation

**Files:**
- Create:
  - `apps/api/src/modules/auth/otp/{otp.controller.ts,otp.service.ts}` and `apps/api/src/modules/auth/tokens/{token.service.ts,bearer.ts}`;
  - `packages/domain/src/auth/{otp-send-decision,fixed-otp,phone-e164}.ts` with tests;
  - `packages/contracts/src/auth/{otp,tokens}.ts`;
  - `apps/api/test/auth/{otp,refresh}.api.test.ts`.

**Domain:**
- `otpSendDecision(history, now)`: at most 3 per 15 minutes and 10 per day per subject; resend after 30 s; returns `{ allowed, retryAfter }`.
- `fixedOtpFor({ appEnv, devFixedOtp, storeReviewPhone }, subject)`:
  - `DEV_FIXED_OTP` works in local and staging only;
  - `STORE_REVIEW_PHONE` works only for its own number (spec 16).
- `parsePhone(country, input)`: +94 means 9 digits without the leading 0. Only Sri Lankan (+94) numbers are accepted for now (OQ12, product owner); the list is data so more countries can be added later.

**Endpoints:**

| Route | Behaviour | Tests |
|---|---|---|
| `POST /auth/otp/request` `{phone}` or `{email}` → 202 | Creates `otp_challenges` (6 digits, 10 min, code hashed); queues SMS or email; same response whether known or not | Identical 202 for an unknown number; the 4th request in 15 min gives 429 with `Retry-After`; 400 for a bad +94 number |
| `POST /auth/otp/verify` `{phone\|email, code}` → `{status: 'signed_in'\|'choose_school'\|'not_found', firstName?, memberships[], accessToken?, refreshToken?}` | 5 attempts per challenge. Finds the account with `account_by_identifier`; returns guardian and relative memberships from `auth_memberships`. One membership issues a tenant token; several issue a 5-minute `select_school` token (OQ20); none gives `not_found` | A wrong code 5 times kills the challenge; an expired code gives 400 `invalid_code`; a staff-only account gives `not_found`; B's memberships never appear for A's number |
| `POST /auth/select-school` (bearer, `select_school` scope) | Same rule as staff; returns a tenant token pair | 403 for a non-member tenant |
| `POST /auth/refresh` `{refreshToken}` → new pair | Format `{sessionId}.{generation}.{secret}`. A matching generation rotates. **An older generation revokes the family** (spec 05) | Review Focus #6; an expired family gives 401; a refresh token from tenant A cannot select B |
| `POST /auth/sign-out` (bearer) | Revokes this device's family | 204, then refresh gives 401 |

The access JWT (EdDSA, 15 min) carries `sub` (membership id), `acc`, `tid`, `kind` (`guardian` or `relative`), `rh` (the roles hash) and `sid`. Relative tokens reach nothing yet (M9b adds the moments routes; a test asserts `GET /me` works and every other route is 403).

Steps:
- [ ] **Step 1: Write the tests.**
- [ ] **Step 2: Run them to see them fail.** Expected: FAIL.
- [ ] **Step 3: Implement.** Then `pnpm api:client` (the Dart client changes too).
- [ ] **Step 4: Run the checks.** `pnpm --filter @quad/domain test && pnpm --filter @quad/api test:api -- otp refresh && pnpm codegen:check`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(auth): parent OTP sign-in with EdDSA access tokens and rotating refresh families`.

### Task 10: Console sign-in under `/platform/auth/*`

**Files:**
- Create:
  - `apps/api/src/platform/auth/{platform-auth.module.ts,platform-auth.controller.ts,platform-auth.service.ts,platform-session.guard.ts,platform-roles.decorator.ts,platform-auth.routes.ts}`;
  - `apps/api/src/platform/me/platform-me.controller.ts`;
  - `packages/contracts/src/platform/auth.ts`;
  - `apps/api/test/platform/auth.api.test.ts`.

**Endpoints** (accepted only with the console cookie; D28 ruling R-console-realtime):
- `POST /platform/auth/password` `{email, password}`:
  - exists only when `CONSOLE_PASSWORD_LOGIN=true`; otherwise 404;
  - looks up active `platform_users`;
  - leads to the TOTP step.
- `POST /platform/auth/sso/google/start` and `GET /platform/auth/sso/google/callback`:
  - require `hd` = `CONSOLE_GOOGLE_HD` and an email ending in `@quad-edu.com` that exists in `platform_users` with status active;
  - refuse anything else with 403 and a `platform_audit` failure.
- `POST /platform/auth/totp/verify`, and `POST /platform/auth/totp/setup` (TOTP is mandatory, spec 07; first sign-in sets it up).
- `POST /platform/auth/sign-out`.
- `GET /platform/me` (name, role, the `passwordLogin` flag for the sign-in page).
- `GET /platform/auth/methods`: `{password: boolean, google: true}`, so the console only offers the password form when the flag is on (journey 42).

Every sign-in and failure is written to `platform_audit` (spec 05). The session is `kind='console'` with 8 h idle. `@PlatformRole(...)` guards platform routes (spec 05 roles).

**Tests:**
- password + TOTP works when the flag is true;
- `/platform/auth/password` is 404 when false;
- Google with `hd` `gmail.com` or an `@other.com` email gives 403;
- a staff `quad_sid` cookie never authenticates a `/platform` route, and a console cookie never authenticates `/auth`, `/me` or `/users`;
- a `readonly` platform user is 403 on an owner-only probe route.
- The boot refusal of `CONSOLE_PASSWORD_LOGIN=true` with `APP_ENV=production` stays covered in `config.test.ts` (Accept).

Steps: test first, implement, `pnpm api:client`, then `pnpm --filter @quad/api test:api -- platform`. Commit `feat(console): console sign-in with Workspace SSO, password flag and TOTP`.

**Acceptance:** Accept "`CONSOLE_PASSWORD_LOGIN=true` is refused at boot when `APP_ENV=production`". Journey 42 API side.

## Phase 4: RBAC and guards

### Task 11: The permission catalogue and access rules

Follow `quad-domain-logic`. 100% branch coverage (D23).

**Files:**
- Create:
  - `packages/contracts/src/permissions.ts` (replaces the stub);
  - `packages/contracts/src/access/staff-pages.ts`;
  - `packages/domain/src/access/{matrix,effective-permissions,system-roles,page-access,role-home,grant-checks}.ts` with tests.
- Modify: `packages/domain/src/index.ts`.

**Contracts:**
- `PermissionKey`:
  - every `<module>.<action>` for the 9 matrix modules × 5 actions;
  - `sensitive.{safeguarding,medical,finance_reports,export_data}`;
  - `users.manage` (OQ3).

  Later milestones add their own keys, for example `circle.connection.read`.
- `STAFF_PAGES`: data only, the spec 08 navigation, each page with `{ id, group, href, requires: PagePredicate, planModule? }` per OQ4.

**Domain:**
- `normaliseRow(row, change)`: unchecking View clears the row; checking any action checks View (spec 05).
- `systemRoleMatrix(key)`: the defaults for `admin`, `principal`, `finance`, `admissions`, `teacher`, `counsellor` and `frontdesk`, from the spec 05 table, filled in from the prototype's `rolePerms` where the spec is silent (OQ5). The result is frozen.
- `effectivePermissions({ roles, planModules, preview?, support?, adminSensitive })` returns `Set<PermissionKey>`:
  - module rows outside the plan are dropped (`settings` is always in);
  - a preview uses the previewed role, intersected with the admin's own sensitive keys (spec 06);
  - support gets the `admin` matrix minus `sensitive.safeguarding` and `sensitive.medical` (spec 05).
- `pageAccess(perms, planModules)`: each page is `hidden`, `view_only` or `full`. `view_only` means the role has `view` but no create, edit, delete or approve on the page's module.
- `roleHome(perms)`: My teaching when `lms.create` and scope `own_classes`; else Dashboard if visible; else Attendance; else the first visible page (spec 08).
- `canGrant(granterSensitive, requested)`: a school admin cannot give a sensitive key they do not hold (spec 08).

**Tests:**
- table-driven for every system role;
- journey 50's expectation as a unit test: `finance` sees exactly Dashboard, Communications, Students (`view_only`), Fees & invoicing and Accounting, and Timetable is `hidden`;
- property tests: `normaliseRow` is idempotent, and no output row has an action without View;
- a preview never adds a sensitive key the admin lacks.

Commit `feat(domain): permission matrix, effective permissions and staff page access`.

### Task 12: `@Can`, `@Module`, `@Sensitive`, suspended schools, `/me/permissions` and Preview a role

**Files:**
- Create:
  - `apps/api/src/common/guards/{can.guard.ts,can.decorator.ts,module.guard.ts,module.decorator.ts,sensitive.decorator.ts,preview-read-only.guard.ts,tenant-status.guard.ts}`;
  - `apps/api/src/modules/me/role-preview.{controller,service}.ts`;
  - `apps/api/src/common/access/permissions.service.ts` (loads roles and `current_tenant_profile()`, cached per request and in Redis for 30 s, keyed by the roles hash);
  - `apps/api/test/guards/{probe.module.ts,guards.api.test.ts}` (test-only probe routes: `@Can('fees.view')`, `@Module('transport')`, `@Sensitive('safeguarding')`, a POST);
  - `apps/api/test/me/{permissions,role-preview}.api.test.ts`;
  - `apps/api/test/routes-guarded.test.ts`.

**Rules:**
- Every non-public route must carry `@Can` or `@PlatformRole`. A test walks the Nest router and the OpenAPI route list and fails on any route without one (the route-walk test).
- `@Module(m)` returns 403 `module_not_in_plan` when the plan lacks the module.
- A tenant with status `suspended` returns 403 `school_suspended` with the suspend reason on every staff and parent route (spec 05).
- `@Sensitive(k)` requires `sensitive.k` and **always refuses support sessions** for safeguarding and medical. Each allowed view writes an audit event.
- While a preview is on, every non-GET returns 403 `preview_read_only`, except `DELETE /me/role-preview` and `/auth/sign-out`.

**Endpoints (four tests each):**

| Route | Permission | Notes |
|---|---|---|
| `GET /me/permissions` → `{keys, pages, home, preview?}` | session | Reflects an active preview (spec 06); `pages` from `pageAccess` |
| `POST /me/role-preview` `{roleId, sampleUserId?}` | `users.manage` | The role and sample user must belong to the session's school (cross-tenant 404); a teacher preview needs a sample user; audit `role_preview.started` |
| `DELETE /me/role-preview` | session with a preview | Audit `role_preview.ended` |

Steps:
- [ ] **Step 1: Write the tests.** Probe tests for 403 `forbidden`, `module_not_in_plan`, `school_suspended`, the support + safeguarding refusal (Accept) and `preview_read_only`; the route-walk test; the endpoint tests.
- [ ] **Step 2: Run them to see them fail.** Expected: FAIL.
- [ ] **Step 3: Implement.** The probe module is imported only by tests, never by `AppModule`, so the OpenAPI document is unchanged.
- [ ] **Step 4: Run the checks.** `pnpm --filter @quad/api test:api -- guards me`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(api): permission, module, sensitive and preview guards with /me/permissions`.

**Acceptance:**
- Accept "Cross-tenant and wrong-role tests fail with 403/404".
- Accept "safeguarding routes refuse support sessions" (probe level; real safeguarding routes in M8 reuse `@Sensitive`).

### Task 13: Users & roles API (staff accounts, invites, roles)

**Files:**
- Create:
  - `apps/api/src/modules/users/{users.module.ts,users.controller.ts,users.service.ts,users.repository.ts,invites.service.ts,users.routes.ts}`;
  - `apps/api/src/modules/roles/{roles.controller.ts,roles.service.ts,roles.repository.ts,roles.routes.ts}`;
  - `apps/api/src/public/signed-links/invites.controller.ts`;
  - `packages/contracts/src/{users,roles}/*.ts`;
  - `apps/api/test/{users,roles,invites}/*.api.test.ts`.

**Endpoints.** Each has four tests: happy; 400; 403 for a `teacher` session (wrong role) and `preview_read_only`; cross-tenant (B's user or role id gives 404, lists omit A). All are audited per spec 05.

| Route | Permission | Behaviour and extra tests |
|---|---|---|
| `GET /users?status=&roleId=&q=&cursor=` → staff list with role, status, two-step status, last sign-in | `users.manage` | Staff kind only; the story summary ("14 staff, 3 without two-step") |
| `POST /users/invite` `{emails[1..50], roleId}` | `users.manage` | For each email: find or create the account (`account_by_identifier`); an existing membership gives `fields.emails[i]: already_member`; otherwise creates `users` (status `invited`) and `user_roles`, and queues the `staff_invite` link `quad-edu.com/sign-in/invite/{token}`. An existing account gets a membership, never a second account (spec 05) |
| `PATCH /users/:id` `{roleId?, status?: 'active'\|'deactivated'}` | `users.manage` | You cannot change your own role or deactivate yourself (422); deactivation revokes that school's sessions and refresh families (spec 05, journey 19); the last active admin cannot be demoted (422 `last_admin`) |
| `POST /users/:id/remind-two-step` | `users.manage` | Queues the reminder email; 409 when two-step is already on |
| `POST /users/:id/reset-password` | `users.manage` | Queues a `password_reset` link with `tid` = this school |
| `POST /users/:id/sign-out-everywhere` | `users.manage` | Revokes the account's sessions in **this school** (OQ10) |
| `POST /users/:id/resend-invite` (new; prototype "Resend invite") | `users.manage` | A new token; only for `invited` |
| `GET /auth/invites/:token` → `{school, name, emailMasked, needsPassword}` | public (signed `staff_invite`) | `invalid_link` cases (journey 43) |
| `POST /auth/invites/:token/accept` `{password?}` | public (signed) or session | New account: sets the password (policy and breach check), then the session goes to `two_step_setup` if the school requires it (OQ9). Existing account: needs a signed-in session for that account (spec 05); activates the membership |
| `GET /roles` → roles with member count, pages count and home | `users.manage` or `settings.view` | Feeds the Preview card |
| `POST /roles` `{name, description, color, scope, baseRoleKey}` | `users.manage` | Copies the base role's matrix |
| `PATCH /roles/:id` / `DELETE /roles/:id` | `users.manage` | System roles give 422 `system_role_locked`; deleting an assigned role gives 409 `in_use` |
| `PUT /roles/:id/permissions` `{matrix, sensitive[]}` | `users.manage` | Normalised with `normaliseRow`; a module outside the plan gives 422 `module_not_in_plan`; a sensitive key the admin lacks gives 403 (spec 08) |

Steps: test first, implement, `pnpm api:client`, then `pnpm --filter @quad/api test:api -- users roles invites`. Commit `feat(users): staff accounts, invites and roles for Users & roles`.

### Task 14: School settings API (General, Sign-in read-only)

**Files:**
- Create:
  - `apps/api/src/modules/school/{school.module.ts,school.controller.ts,school.service.ts,school.repository.ts,school.routes.ts}`;
  - `packages/contracts/src/school/*.ts`;
  - `packages/domain/src/settings/settings-summary.ts` with tests;
  - `apps/api/test/school/*.api.test.ts`.

**Endpoints (four tests each):**
- `GET /school` [`settings.view`] → `{ name, shortName, officeEmail, officePhone, address, timeZone (read-only), smsSenderId, smsSenderStatus, branding: {color, logoUrl} (read-only), signIn: {sso, twoStep, passwordMinLength, sessionHours, ipAllowlist} (read-only: "Managed by Quad"), summary }`.
- `PATCH /school` [`settings.edit`] `{name?, officeEmail?, officePhone?, address?, smsSenderId?}`:
  - the name goes through `update_current_tenant_name`;
  - time zone, logo, colour and sign-in rules are not accepted (08 wins over 06; OQ19);
  - takes `If-Match`, and a stale `etag` gives 409;
  - each change writes the `settings.updated` audit with before and after.
- `GET /school/branding` [session]: read-only.
- `GET /settings` [`settings.view`]: the `school_settings` row, read-only in M1. `PATCH /settings` arrives with each tab's feature (OQ19).
- `settingsSummary(settings, profile)` returns codes for the summary sentence, for example "Ask Quad is on. Quiet hours are 18:00–07:00 and weekends." Online payments is omitted until M7.

Commit `feat(school): school settings General and read-only sign-in rules`.

## Phase 5: Audit and support

### Task 15: Audit log, Settings → Audit API and platform audit

**Files:**
- Create:
  - `apps/api/src/common/audit/{audit.service.ts,audit-actions.ts}`;
  - `apps/api/src/modules/audit/{audit.controller.ts,audit.repository.ts,audit.routes.ts}`;
  - `apps/api/src/platform/audit/{platform-audit.service.ts,platform-audit.controller.ts}`;
  - `apps/api/src/common/export/csv.ts`;
  - `packages/contracts/src/audit/*.ts`;
  - tests.

**Behaviour:**
- `AuditService.record(ctx, action, target, meta)` writes `audit_log` in the same transaction as the change.
  - In a support session it sets `actor_platform_user_id` and `support_session_id`, and also calls `record_support_audit` (spec 05: dual audit).
- `PlatformAuditService` (platform folder only) records every `withPlatform` write.
- Action keys (contracts):
  - `auth.*`: `sign_in`, `sign_in_failed`, `sign_out`, `password_reset`;
  - `user.*`: `invited`, `role_changed`, `deactivated`, `reactivated`, `two_step_reminded`, `password_reset_sent`, `signed_out_everywhere`;
  - `role.*`: `created`, `updated`, `deleted`, `permissions_changed`;
  - `role_preview.*`: `started`, `ended`;
  - `settings.updated`;
  - `support_session.*`: `started`, `ended`;
  - `audit.exported`.

**Endpoints (four tests each):**
- `GET /audit?actor=&action=&from=&to=&cursor=` [`settings.view`]:
  - `Accept: text/csv` needs `sensitive.export_data`, and the export itself is audited;
  - the response is a readable `summary` per row plus `meta`, with `viaSupport` set for support rows (08: "Support sessions from Quad are marked").
- `GET /platform/audit?actor=&tenantId=&action=&from=&to=` [`@PlatformRole` any], with CSV (spec 07).

**Extra tests:**
- B's audit rows never appear for A;
- CSV without `export_data` gives 403;
- an UPDATE on `audit_log` fails (trigger).

Commit `feat(audit): school and platform audit logs with filtered views and CSV export`.

### Task 16: Support sessions ("Open as school admin")

**Files:**
- Create:
  - `apps/api/src/platform/support/{support.controller.ts,support.service.ts}`;
  - `apps/api/src/platform/tenants/{tenants.controller.ts,tenants.service.ts}` (minimal `GET /platform/tenants` for the console list: id, name, short name, status, colour; M2 extends it);
  - `apps/api/src/public/signed-links/support-session.controller.ts`;
  - tests.

**Flow:**
1. `POST /platform/tenants/:id/support-session` `{reason (10–500 chars, required)}`:
   - needs the `support`, `admin` or `owner` platform role;
   - creates `support_sessions` (`expires_at` = now + 60 min) with `withPlatform`, plus a staff `sessions` row (`kind web`, `platform_user_id`, `active_tenant_id`, `support_session_id`, `stage active`);
   - writes `platform_audit`;
   - returns `{ url: PUBLIC_WEB_URL + '/sign-in/support/' + token }` (purpose `support_session`, 2 min, single use; spec 05).
2. `POST /auth/support-session` `{token}` (new route, `src/public/signed-links`): verifies and consumes the token, sets the staff cookie for that session, and audits `support_session.started` in the school.
3. In the school, `/me` returns `support: {schoolName, platformUserName}` for the banner; permissions follow `effectivePermissions({ support })`.
4. `POST /auth/support-session/end` ("Exit to platform"): ends both rows, audits, and returns `{ redirect: CONSOLE_URL }`. The session hard-expires at 60 minutes.

**Tests:**
- a missing or short reason gives 400;
- a `billing` or `readonly` role gives 403;
- an unknown tenant gives 404;
- the link works once (a second use gives `invalid_link`);
- an expired link (fake clock + 2 min) is refused;
- every write in support produces one `audit_log` and one `platform_audit` row;
- the support + `@Sensitive('medical')` probe gives 403;
- after 60 minutes, 401;
- a support session for A cannot read B (404).

Commit `feat(support): reasoned, time-limited support sessions with dual audit`.

**Acceptance:** Accept "The support banner shows in support view; safeguarding routes refuse support sessions" (API side).

## Phase 6: Staff screens

All tasks in this phase follow `quad-web-screen`, with the prototype open side by side. Every screen has Playwright screenshots at 1440×900 and 390×844 in light and dark, saved to `docs/screenshots/m1/` in Task 26, and an axe check.

### Task 17: `/sign-in` and the signed-link pages

**Prototype:** `design/admin.html` `authRender` / `schoolAuth` (art panel and card), restructured identifier-first (spec wins, OQ15). Copy comes from the prototype where the spec is silent: "Sign in to Quad", "One sign-in for every school on Quad…", "Two-step sign-in", "Trust this device for 30 days", "Use a recovery code", "Reset your password", "Check your inbox", "Choose a school", "Remember my choice on this device".

**Files:**
- Create:
  - `apps/staff/src/app/(auth)/layout.tsx` (app tokens, `QueryClientProvider`, Quad-branded art panel);
  - `apps/staff/src/app/(auth)/sign-in/page.tsx` and `_components/{IdentifyStep,PasswordStep,SsoButtons,TwoStepStep,TwoStepSetup,RecoveryCodes,ChooseSchool,NoSchool,ForgotStep,CheckInbox,AuthCard,OtpBoxes}.tsx`;
  - `(auth)/sign-in/reset/[token]/page.tsx`, `(auth)/sign-in/invite/[token]/page.tsx`, `(auth)/sign-in/support/[token]/page.tsx`;
  - `apps/staff/src/lib/{api.ts,session.ts}`;
  - `apps/staff/scripts/build-export.test.ts`;
  - `apps/staff/e2e/sign-in.spec.ts`.
- Modify:
  - `apps/staff/src/middleware.ts` (`/app/**` without the cookie redirects 307 to `/sign-in?next=`; the token pages get `Referrer-Policy: no-referrer` and `X-Robots-Tag: noindex`);
  - `apps/staff/scripts/build-export.mjs` (refuse `sign-in`);
  - `packages/contracts/i18n/en.json`;
  - `packages/ui` (move `OtpBoxes` there if the console uses it: rule of two).

**Behaviour:**
- Identify, then SSO buttons and/or a password field, then two-step (or setup with QR and 10 recovery codes), then Choose a school (logo or monogram, name, "your role"; none gives the spec 05 message), then "Opening {school}…", then `next` or `/app`.
- Errors come from `{code, fields}`, with no account hints.
- The lockout copy names the 15 minutes.
- `quad_last_school` shows "Welcome back to {school}" without preselecting anything (spec 05).
- The OTP boxes auto-advance, accept paste and set `autocomplete="one-time-code"`.

**Tests:**
- component tests for the step machine and `OtpBoxes` paste;
- Playwright:
  - identify, then password, then `000000`, lands in `/app`;
  - a wrong password shows the error;
  - forgot shows "Check your inbox";
  - a tampered reset link shows "This link isn't valid any more" with no school name;
  - 390 px with no horizontal scroll;
  - axe clean;
- `checkExport` refuses an out folder containing `sign-in`;
- `src/app/layout.tsx` imports nothing from `(auth)`, `@/lib/session` or `@quad/client` (the pre-launch guard).

Commit `feat(staff): identifier-first sign-in page and signed-link pages`.

### Task 18: The portal shell: session, branding, permission-filtered navigation, switch school, banners

**Prototype:** `design/admin.html`: the rail, top bar, `.me` profile menu with `swSchool`, `#supportBar`, `#rvBar`, `#rvPick`, `rvDenied`.

**Files:**
- Modify:
  - `apps/staff/src/app/app/layout.tsx` (server: `GET /me` and `/me/permissions` through `API_INTERNAL_URL`, OQ16; a 401 redirects to `/sign-in?next=`);
  - `apps/staff/src/components/shell/StaffShell.tsx` (navigation from `STAFF_PAGES` and `pages`; brand CSS variables `--brand`, `--brand-fill`, `--brand-ink` set as inline CSS variables from the API's computed palette; no raw hex in classes);
  - `apps/staff/src/app/app/page.tsx` (the greeting from `/me`);
  - `packages/ui/src/shell/{AppShell,Topbar,Sidebar}.tsx` (a `banner` slot, a profile menu with Switch school and Sign out, and a desktop `actions` slot for **View as**).
- Delete: `apps/staff/src/lib/placeholders.ts`.
- Create:
  - `apps/staff/src/app/app/[...page]/page.tsx` (placeholder pages for unbuilt navigation items: "{Page} arrives soon", or the no-access page per `pages`);
  - `apps/staff/src/components/shell/{SupportBanner,PreviewBanner,ViewAsPicker,SwitchSchoolMenu,NoAccess,ViewOnlyTag}.tsx`;
  - `apps/staff/e2e/shell-auth.spec.ts`.

**Behaviour:**
- Items are hidden by `pageAccess` and plan modules.
- Switch school calls `POST /auth/select-school` and reloads `/app` (spec 05).
- Sign out goes to `/sign-in`.
- The support banner shows the spec 05 copy, is fixed, uses `role="status"`, and has **Exit to platform**.
- The preview banner reads "Previewing as {role} · {sample person}" with **Back to my view** (spec 08).
- The no-access page reads "{Page} isn't part of the {role} role" with a link to the role's home.
- **View only** tags hide action buttons.

**D27 follow-ups:** RTL unit tests for `Kpi`, `Pill`, `Tabs`, `Checkbox`, `Field` and `Textarea`, and a WebKit Playwright project for drawer focus (Secure cookies on WebKit localhost are why local cookies have no `Secure`, D32).

Commit `feat(staff): signed-in shell with school branding, role-aware navigation and banners`.

### Task 19: Settings → Users & roles

**Prototype:** `design/admin.html` `V.users`: the People and Roles & permissions tabs, `rvCard()`, the invite drawer, row actions.

**Files:**
- Create:
  - `apps/staff/src/app/app/settings/users/page.tsx` and `_components/{PeopleTable,RoleSelect,RowActions,PreviewRoleCard,RolesList,PermissionMatrix,SensitiveSwitches,SaveBar}.tsx`;
  - `_drawers/{InviteStaffDrawer,ConfirmDeactivateDrawer}.tsx`;
  - `apps/staff/src/app/app/settings/users/roles/new/page.tsx` (the New role page);
  - `packages/ui/src/components/PermissionMatrix.tsx` (shared with the console in M2);
  - `apps/staff/e2e/users-roles.spec.ts`.

**Screens:**
- The page head: "Users & roles", and the story sentence from the API ("14 staff · 3 haven't turned on two-step sign-in").
- **People:** search, role chips, a table (person, role select, two-step pill with **Remind**, last active, status pill, action). On phones the table becomes cards.
- **Invite staff** drawer: one or many emails and a role. The toast reads "Invite sent to 2 people".
- Row actions:
  - Reset password: "Reset link sent to {email}";
  - Sign out everywhere;
  - Deactivate, with confirmation;
  - Resend invite.
- No "Sign in as" (spec 08).
- **Roles & permissions:**
  - the role list and the module × action matrix, with system roles locked;
  - custom roles editable with a sticky save bar;
  - modules outside the plan show "Not in plan";
  - **New role** (name, description, colour, start from, scope, matrix, sensitive switches; keys the admin lacks are disabled).
- **Preview a role** card: each role with its pages count and where it starts, and **Preview**.

Commit `feat(staff): Users & roles with invites, row actions, role matrix and role preview`.

### Task 20: School settings (General, Sign-in) and the Audit tab

**Prototype:** `design/admin.html` settings styling. Spec 08's School settings table is the authority (no dedicated prototype view; OQ19).

**Files:**
- Create:
  - `apps/staff/src/app/app/settings/school/page.tsx` (tabs: General, Sign-in, Audit; other tabs absent until their milestones);
  - `_components/{GeneralForm,SignInRules,AuditTable,AuditFilters,AuditDetailDrawer}.tsx`;
  - `apps/staff/e2e/school-settings.spec.ts`.

**Screens:**
- The summary line from the API.
- **General:**
  - name, office email, office phone, address and SMS sender ID are editable;
  - time zone, logo and colour are read-only with "Set by Quad";
  - Save gives the toast "School details saved".
- **Sign-in:** a read-only list with "Managed by Quad. Ask support to change them."
- **Audit:**
  - filters for person, action type and date range (`DropdownFilter`);
  - a table with readable summaries and a "Quad support" pill on support rows;
  - a detail drawer;
  - Export CSV, shown only with `sensitive.export_data`.

Commit `feat(staff): School settings General, sign-in rules and the audit view`.

## Phase 7: Console screens

### Task 21: Console sign-in, signed-in shell, Open as school admin, Audit log

**Prototype:** `design/platform.html` `platformAuth`, `V.tenants` (the "Open as school admin" button), `V.audit`. Spec wins: a reason is always required (D22).

**Files:**
- Create:
  - `apps/console/src/app/sign-in/page.tsx` (Google Workspace button; the email and password form only when `GET /platform/auth/methods` says so; then TOTP or setup);
  - `apps/console/src/middleware.ts` (a redirect to `/sign-in` without the console cookie; robots stays);
  - `apps/console/src/app/(console)/schools/page.tsx` (a minimal list from `GET /platform/tenants`);
  - `_drawers/OpenAsSchoolAdminDrawer.tsx` (a required reason with a hint, a button "Open {school} as school admin", which opens the returned URL);
  - `apps/console/src/app/(console)/audit/page.tsx` (filters, table, CSV);
  - `apps/console/e2e/{sign-in,support,audit}.spec.ts`.
- Modify: `apps/console/src/components/shell/ConsoleShell.tsx` (the real user and role, Sign out). Delete `apps/console/src/lib/placeholders.ts`.

Commit `feat(console): console sign-in, support entry with a reason, and the platform audit log`.

## Phase 8: Parent app (Flutter)

### Task 22: Auth core: secure storage, token interceptor, auth state and router guard

Follow `quad-flutter-screen`.

**Files:**
- Create:
  - `apps/parent/lib/core/{secure_store.dart,auth/auth_controller.dart,auth/token_interceptor.dart,auth/auth_state.dart,lock/lock_controller.dart}`;
  - tests in `apps/parent/test/core/auth/*`.
- Modify:
  - `apps/parent/pubspec.yaml` (`flutter_secure_storage`, `local_auth`);
  - `lib/core/api.dart` (the interceptor);
  - `lib/router.dart` (a redirect to `/welcome` when signed out and to `/lock` when locked);
  - Android `MainActivity` (`FlutterFragmentActivity` for `local_auth`) and `Info.plist` (`NSFaceIDUsageDescription`).

**Behaviour:**
- The refresh token lives in `flutter_secure_storage`; the access token only in memory.
- The single-flight refresh on 401 signs out and wipes on reuse or revocation (spec 09 Cache security).
- The lock state is set at launch with biometrics on, and after more than 5 minutes in `paused` (spec 09 Re-lock), using an injected clock.

**Tests:**
- the refresh is single-flight across 3 parallel 401s;
- reuse signs out and clears storage;
- the lock appears at 5:01 and not at 4:59;
- the router redirects.

Commit `feat(parent): token storage, refresh interceptor and lock state`.

### Task 23: Sign-in screens, biometric unlock, Switch school and Sign out

**Prototype:** `design/parent.html`: the `paGo` states (welcome, phone, code, verify, face) and the lock screen. Spec wins: the welcome and sign-in screens are Quad-branded (D13), and the school branding applies after sign-in.

**Files:**
- Create:
  - `apps/parent/lib/features/auth/screens/{welcome,phone,code,found_you,school_picker,face_id_offer,lock}_screen.dart`;
  - `widgets/{country_picker,code_boxes,school_tile}.dart`;
  - `providers/*`;
  - tests and goldens (`test/features/auth/**`, `test/goldens/auth_*`).
- Modify:
  - `lib/features/more/screens/more_screen.dart` (**Switch school** only with more than one membership; **Sign out**);
  - `lib/theme/theme.dart` (the school brand from `GET /me` through `QuadColors.copyWith`);
  - `packages/contracts/i18n/en.json` (the ARB comes from `pnpm i18n:build`).

**Screens:**
- **Welcome:** "Welcome to Quad", the subtitle, **Sign in**, and **I have an invite code**, which shows "Invite codes arrive soon" until M6.
- **Phone:** +94 by default; "Use email instead"; **Send code**.
- **Code:** 6 boxes, autofill, "It works for 10 minutes", resend after 30 s.
- **Found you:** "You're signed in. Welcome, {first name}." with "{school}". The children line comes later (OQ13). "We couldn't find you. Ask your school to add this number."
- **School picker** when there are several memberships.
- **Unlock with Face ID?** (Turn on / Not now). "Allow notifications?" is M6.
- **Lock:** "Welcome back", the school logo, Face ID or fingerprint, "Use passcode".

**Tests:**
- widget tests for the loading, empty, error and data states of each screen, with a mocked `quad_api` and a fake `LocalAuthentication`;
- goldens for welcome, phone, code, found you and lock at 390×844, light and dark, text scale 1.0 and 2.0;
- `integration_test/sign_in_test.dart` against the local API (runs in the nightly `e2e:mobile`, not here).

Run `fvm flutter analyze` (or `flutter` per D26), `dart format --set-exit-if-changed .` and `flutter test`. Commit `feat(parent): OTP sign-in, school picker, biometric lock, switch school and sign out`.

**Acceptance:** Accept "Sign in works in all three apps" (the parent part, with widget and integration tests; the device run is in CI nightly).

## Phase 9: Seeds

### Task 24: Seed the M1 accounts and access data

**Files:**
- Modify:
  - `packages/db/src/{seed-data.ts,seed.ts}`;
  - `packages/db/test/seed.test.ts`;
  - `packages/db/test/factories.ts`.
- Create: `packages/db/src/env-loader.ts` (the D27 follow-up: one gated `.env` loader shared by the API and the db scripts; `apps/api/src/boot.ts` uses it too).

**Seed (deterministic, written as `quad_owner`; D24):**
- **Platform:**
  - `owner@quad.local` (owner; password from `SEED_PASSWORD`; TOTP on; local code `000000`);
  - `support@quad.local` (support role, for the support journey).
- **Colombo International School:**
  - branding `#DD4A42`;
  - all modules;
  - security: `two_step: staff`, `sso_google: true`, `sso_domain: colombo-intl.local` (exercises SSO with the fake issuer);
  - `school_settings` defaults;
  - the seven system roles.
- **Kandy Hill Academy:**
  - branding `#2BB0A0`;
  - modules without `transport`;
  - `two_step: admins`;
  - system roles.
- **People** (accounts, credentials and memberships):
  - `prishan.maduka@colombo-intl.local` (CIS admin);
  - `nadeesha.jayasinghe@colombo-intl.local` (CIS teacher);
  - `ruwan.mendis@quad.local` (CIS teacher, KHA teacher; role names as the prototype: "Teacher · Mathematics" and "Head of Mathematics" are job titles that arrive in M3, so M1 shows the role names);
  - `dilini.fernando@colombo-intl.local` (CIS finance officer, the preview sample);
  - Dilhani Perera, phone `+94770000001`, a guardian membership at CIS.
- `SEED_TENANTS` gains fixed ids for the people, exported as `SEED_PEOPLE`.

**Tests:**
- re-seeding is idempotent;
- `auth_memberships(ruwan)` returns both schools;
- each seeded password verifies against `SEED_PASSWORD`;
- the seed refuses to run without `SEED_PASSWORD`, and refuses the placeholder outside `local`.

Commit `feat(db): seed platform users, school access settings, roles and the sample people`.

## Phase 10: Journeys

### Task 25: The end-to-end stack and journeys 17, 18, 19, 42, 43, 50

**Files:**
- Create:
  - `scripts/e2e-stack.mjs`:
    - creates a fresh database `quad_e2e_<pid>` as admin;
    - migrates and seeds it;
    - starts `apps/api/dist/main.js` and `dist/worker.js` on `:4000` with that `DATABASE_URL`, Mailpit SMTP, `OIDC_FAKE_ISSUER_URL`, `APP_ENV=local` and `DEV_FIXED_OTP=000000`;
    - starts `scripts/fake-oidc.mjs`;
    - waits for `/health/ready`;
    - drops the database on exit;
    - has its own test;
  - `packages/config/playwright/{stack.ts,mailpit.ts}` (the Mailpit API helper);
  - `apps/staff/e2e/journeys/{j17-sign-in-one-school,j18-two-schools,j19-invite,j43-signed-links,j50-preview-role}.spec.ts`;
  - `apps/console/e2e/journeys/j42-console-sign-in.spec.ts`.
- Modify:
  - `packages/config/playwright/preset.ts` (`webServer` becomes `[stack, next start]` when a spec needs the API);
  - `scripts/check-services.mjs` (Mailpit SMTP when `SMTP_URL` is set);
  - `.github/workflows/ci.yml` `e2e-smoke` (postgres, redis and mailpit service containers, the same as `api-integration`);
  - `scripts/test/workflows.test.ts`.

**Journeys** (spec 17, wording as there; Chromium at 1440 and 390, light and dark; axe on each page):
- **17:** from `/` (non-prelaunch build), **Sign in** goes to `/app`, then `/sign-in`. Prishan's email, password and `000000` land in `/app` with CIS's name and the brand variable `--brand` = `#DD4A42`.
- **18:** Ruwan sees **Choose a school** with both schools and his role in each, picks KHA, and sees KHA's branding. The profile menu's **Switch school** opens CIS, and the session cookie value changes (rotation).
- **19:**
  - the admin invites `new.teacher+<run>@colombo-intl.local` as Teacher, and the email arrives in Mailpit;
  - the link sets a password and two-step (QR secret read from the page, code `000000`);
  - the teacher signs in with the Teacher menu;
  - the admin changes the role to Front desk, and after reload the teacher's menu changes;
  - deactivating the teacher makes their next request redirect to `/sign-in`.
- **42:**
  - with `CONSOLE_PASSWORD_LOGIN=true`, `owner@quad.local` signs in with password and `000000`;
  - a second stack started with the flag off shows only **Continue with Google Workspace**, and the fake Google + TOTP works;
  - a fake account `someone@gmail.com` is refused.
- **43 (M1 part):**
  - a reset link from Mailpit works once and is refused the second time;
  - forged, expired (fake clock through a stack restart with `QUAD_E2E_NOW` local-only, or a token signed with a past `exp` by the test helper), wrong-purpose and tampered tokens are refused, and the page shows no school name;
  - `POST /api/v1/public/enquiry/unknown-key` gives 404 (a stub route added here in `src/public/enquiry`, rate-limited, which calls `tenant_by_embed_key`; M4 completes it);
  - the webhook steps are marked `test.fixme` with `M7`. That is not `.skip`: the list in spec 17 says "webhooks from M7".
- **50:**
  - Prishan previews Finance officer;
  - the menu shows exactly Dashboard, Communications, Students, Fees & invoicing and Accounting;
  - Students shows **View only**;
  - `/app/timetable` shows the no-access page;
  - a write (`PATCH /api/v1/me` from the page context) gives 403 `preview_read_only`;
  - **Back to my view** restores the menu;
  - Settings → Audit lists `role_preview.started` and `role_preview.ended`.
- **Support banner (Accept):** in a console journey step, the support user opens CIS with a reason; the staff portal shows the banner; **Exit to platform** returns to the console.

Commit `test(e2e): sign-in, invite, console, signed-link and role-preview journeys with a real API stack`.

## Phase 11: Verify and screenshots

### Task 26: Gate, screenshots and review

Steps:
- [ ] **Step 1: Run the gates.** `pnpm verify && pnpm build`, then `NEXT_PUBLIC_QUAD_PRELAUNCH=true pnpm --filter @quad/staff build:export && pnpm --filter @quad/staff e2e:export`. Expected: all PASS.
- [ ] **Step 2: Take the screenshots** at 1440×900 and 390×844, light and dark, into `docs/screenshots/m1/`:
  - `/sign-in` (each step);
  - Choose a school;
  - `/app` with CIS and with KHA branding;
  - the support banner and the preview banner;
  - the no-access page;
  - Users & roles (People, Roles, invite drawer, New role);
  - School settings (General, Sign-in, Audit);
  - the console sign-in, Schools with the reason drawer, and the Audit log.

  Compare each with the prototype at the same size and fix visible differences.
- [ ] **Step 3: Check the parent app.** The Flutter goldens are reviewed, plus a simulator screenshot when one is available (otherwise noted as a gap).
- [ ] **Step 4: Compare the export.** The export's landing at 1440 and 390, light and dark, matches `docs/screenshots/landing/` (no M1 change).
- [ ] **Step 5: Review.** Run `quad-review`, `/code-review` and `/security-review` on the whole M1 diff, and fix the findings.
- [ ] **Step 6: Commit.** `docs(screenshots): M1 sign-in, portal, settings and console screens`.

## Phase 12: Docs

### Task 27: Decision log, spec edits, README and progress

**Modify:**
- `docs/spec/02-architecture.md`:
  - D32 (one row in the D28 style: a summary sentence and a `<ul>` per area);
  - the D16 table row for the support session redemption;
  - the variables table (`OIDC_FAKE_ISSUER_URL`, `API_INTERNAL_URL`).
- `docs/spec/04-data-model.md`:
  - account tables and RLS;
  - the new columns (`accounts.locked_until`, `credentials.password_changed_at`, `sessions.*`, `platform_users.password_hash` and `totp_enabled`, `support_sessions.expires_at`, `school_settings.address` and `sms_sender_status`, `audit_log.support_session_id`);
  - `trusted_devices`;
  - the new definer functions.
- `docs/spec/05-auth-tenancy-rbac.md`: `users.manage`; the page-access rule; staff invite TTL; `password_reset` with `tid` null.
- `docs/spec/06-api-and-events.md`:
  - `POST /auth/support-session`, `POST /auth/support-session/end`, `POST /users/:id/resend-invite`;
  - the `/platform/auth/*` and `/platform/me` lines;
  - `GET /platform/tenants` minimal;
  - the new error codes.
- `docs/spec/08-staff-portal.md`: the School settings tab list for M1 (Sign-in shown as a read-only tab).
- `docs/spec/17-testing-quality.md`: journey 17 starts from `/sign-in` until M1b's dialog.
- `docs/spec/18-delivery-plan.md`: tick M1. Leave M1b unticked.
- `README.md`: the seeded sign-ins section, now real.
- `infra/README.md`: the first-deploy steps for the JWT keys, `SEED_PASSWORD` and `FIELD_ENCRYPTION_KEY`.

Commit `docs: M1 decisions, spec updates and progress`.

---

## Open questions (owner: all recommendations accepted on 2026-10-08, except OQ12 = Sri Lankan numbers only) and spec gaps (each with a recommended answer)

1. **How `quad_app` reaches global identity rows.**
   - Spec 04 marks `accounts`, `credentials`, `identities`, `sessions` and `otp_challenges` global. D24 closes every non-tenant table to `quad_app`.
   - **Recommend:** a third table class, "account tables", with RLS on `app.account_id` (`withAccount`). Lookups by email, phone or session token go through two new definers (`account_by_identifier`, `session_by_token`), and `otp_challenges` is an explicit open table.
   - The alternative, plain grants, is simpler but lets any SQL injection read every password hash.
2. **School code reading platform-owned settings.**
   - Branding, modules, `tenant_security`, status and the editable school name are in platform tables.
   - **Recommend:** `current_tenant_profile()` and `update_current_tenant_name()`, both scoped to `app.tenant_id` (D24 anticipated "a named function").
3. **`users.manage` is used by specs 06 and 08 but is not in the matrix.**
   - **Recommend:** it is held by any role with `settings.edit`. Principal (settings view only) does not get it, which matches the prototype's principal `no:['users']`.
4. **Page access for navigation.**
   - Spec 05's matrix has 9 modules, but the navigation has pages with no module (Communications, Timetable, Pastoral, Early warning).
   - **Recommend** this map in `STAFF_PAGES`:

     | Page | Visible when |
     |---|---|
     | Dashboard | `view` on any of admissions, crm, fees, finance or settings |
     | Communications | every staff role |
     | My teaching | `lms.create` |
     | Timetable, Courses & gradebook, Teachers & classes, Staff cover, Exams, Reports | `lms.view` |
     | Students | `sis.view` |
     | Early warning | `sis.create` |
     | Pastoral care | `sis.create` or `lms.create` |
     | Attendance | `attendance.view` |
     | Admissions | `admissions.view` |
     | CRM & leads, Family connection, Evenings & forms | `crm.view` |
     | Fees & invoicing | `fees.view` |
     | Accounting | `finance.view` |
     | Routes, Pickup | `transport.view` |
     | Academic year, School settings | `settings.view` |
     | Users & roles | `users.manage` |

     This reproduces journey 50 exactly. It drops the prototype's front-desk Events, which is acceptable.
5. **System role defaults.**
   - Spec 05 says counsellor has "pastoral and medical", but also that sensitive keys are off by default.
   - **Recommend:** the counsellor system role gets `sensitive.medical` on and `safeguarding` off. Other matrices follow the prototype's `rolePerms`, with the spec 05 table winning where they differ. For example, teacher gets `sis.view`, `attendance` and `lms` view, create and edit.
6. **Role scopes `campus` and `own_classes`.** No campuses or class assignments exist until M3 and M5. **Recommend:** store the scope in M1 and enforce only `school`; scope filters ship with M3/M5.
7. **Staff invite lifetime** is unspecified. **Recommend:** 7 days, single use. Resend issues a new token.
8. **The tenant id in a password reset started from Forgot password** (account-level, no school). **Recommend:** `tid` is nullable for `password_reset` only. An admin-initiated reset carries the school id for audit.
9. **Invite acceptance for a new account.** Spec 06 says "after sign-in", but a new invitee has no password. **Recommend:** a new account sets its password (and two-step when required) on the invite page; an existing account must sign in first, then accept.
10. **Scope of "Sign out everywhere" by a school admin.** **Recommend:** it revokes the account's sessions in that school only. A password reset revokes everything (spec 05).
11. **Where sign-in failures are audited** (before a school is chosen). **Recommend:**
    - `auth.sign_in_failed` goes into the `audit_log` of every school where the account is active staff;
    - unknown emails are not audited (rate-limit metrics only);
    - console failures go to `platform_audit`.
12. **Parent OTP abuse controls.** Spec 16 asks for a captcha after 3 attempts, a country allowlist, and SMS spend caps. **Recommend:**
    - M1: rate limits plus a global country allowlist of LK only (product owner, 2026-10-08; MV, AE and IN can be added later);
    - M6, when live SMS ships: the captcha (Turnstile on the email path and an app-attestation check on mobile) and spend caps.
13. **"Found you" without students.** Students arrive in M4. **Recommend:** M1 shows "Welcome, {first name}. You're connected to {school}.", and the children line appears when the API returns children (M6).
14. **Breached-password check offline and on failure.** **Recommend:** a range-API adapter with a 2 s timeout that fails open (logged); `APP_ENV=local` and the tests use an offline fake list; no new variable.
15. **Route group and tokens for `/sign-in`.** Spec 19 puts `/sign-in` in `(public)` (palette B), but spec 05 makes the `admin.html` screen its reference. **Recommend:** a separate `(auth)` group with app tokens, also outside the static export; M1b's landing dialog uses the public palette.
16. **The API URL for server components.** **Recommend:** a new runtime variable `API_INTERNAL_URL` for staff and console (local `http://localhost:4000`; staging the public origin through CloudFront until M12 adds service discovery).
17. **Full-page role builder and user profile pages in the staff portal.** **Recommend:**
    - M1 ships the role matrix, custom role editing and a minimal New role page (the API is in M1);
    - the per-user profile page waits for M2, with the console user page it shares;
    - if M1 runs long, the New role page is the first thing to move to M2.
18. **Console scope in M1.** Spec 07's school page is M2. **Recommend:** M1 adds a minimal Schools list (from `GET /platform/tenants`) only to host **Open as school admin**, plus the Audit log page.
19. **Spec conflicts on School settings** (spec wins, 08 over 06):
    - time zone is read-only;
    - "Settings → Audit" in M1's scope is the Audit tab of School settings (08);
    - "Sign-in section" is a read-only tab;
    - `PATCH /settings` arrives with each tab's feature, and M1 ships `GET` only.
20. **Bearer select-school for parents.** Unspecified. **Recommend:** OTP verify with several memberships returns a 5-minute `select_school` token; `POST /auth/select-school` with it returns the tenant token pair.
21. **Seed two-step rules.** **Recommend:** CIS `staff` (journey 19 then sets up two-step); KHA `admins`. Ruwan therefore always uses TOTP (strictest wins).

Spec and prototype conflicts noted (spec wins):
- The prototype asks for email and password on one form, with SSO buttons always shown. Spec 05 is identifier-first.
- The prototype's "Open as school admin" and "Sign in as" take no reason. D22 and spec 05 always need one.
- The prototype's parent welcome is school-branded. D13 makes it Quad-branded.
- Journey 17 says "opens Sign in on the landing page". In M1 that is the non-prelaunch link to `/app`, then `/sign-in`, and the dialog arrives in M1b.

## Proposed decision-log row

**D32 (2026-10-08). Auth, tenancy and permissions (M1).** One row in the D28 style, with these items:
- **Tables and lookups:**
  - account tables with RLS on `app.account_id` and `withAccount` (OQ1);
  - `otp_challenges` as the only open table;
  - the third and fourth table classes in `findTenancyViolations`;
  - new definers `account_by_identifier`, `session_by_token`, `sso_methods_for_domain`, `auth_sign_in_rules`, `current_tenant_profile`, `update_current_tenant_name`, `consume_signed_token` and `record_support_audit`;
  - the two D16 stubs;
  - new columns and `trusted_devices`.
- **Signed links:** the payload format and `SIGNED_LINK_RULES` TTLs; `tid` null for account-level `password_reset`; web paths `/sign-in/{reset,invite,support}/{token}` with `no-referrer` and `noindex`; `POST /auth/support-session` as the support redemption entry point (D16 row).
- **Sessions:**
  - opaque 32-byte cookie, SHA-256 in the database, Redis cache for 30 s;
  - `__Host-` names, but `quad_sid` and `quad_console_sid` without `Secure` when `APP_ENV=local`;
  - double-submit CSRF;
  - `stage` on the session row for the sign-in steps;
  - parent JWT EdDSA, 15 min;
  - refresh `{sid}.{generation}.{secret}` with family revocation on reuse.
- **Crypto:**
  - Argon2id through `@node-rs/argon2` (`m=19456, t=2, p=1`);
  - `FieldCipher` AES-256-GCM with HKDF from `FIELD_ENCRYPTION_KEY`, KMS in M12;
  - JWT and field keys required from M1, with local-only placeholders;
  - the breach-check failure mode.
- **Access:**
  - `users.manage` from `settings.edit`;
  - the `STAFF_PAGES` map;
  - system role defaults (counsellor with `medical`);
  - scope enforcement deferred to M3/M5;
  - the API computes the school brand palette with `@quad/tokens` `fillFor` (a new allowed `apps/api` → `@quad/tokens` import, colour maths only).
- **Configuration:** `OIDC_FAKE_ISSUER_URL` (local only) and `API_INTERNAL_URL`.
- **Testing:** the e2e stack (fresh database per run, API, worker, fake issuer, Mailpit) and the CI `e2e-smoke` services.
- **Pre-launch:** `/sign-in` and `/app` stay out of the static export; `checkExport` enforces it.

## Risks and size

**Size**
- 27 tasks, the largest milestone so far. It touches every layer, 4 migrations and about 45 endpoints.
- Candidates to move to M2 if it runs long, in this order: the staff New role page, the console Audit log page, `GET /me/sessions`.

**Cannot run offline here**
- **Real Google, Microsoft and Workspace OIDC.** Every test uses the fake issuer (spec 18: "mocked in tests"). Real client registration and redirect URIs need the owner's Google Cloud and Entra setup. Recorded in `infra/README.md`.
- **SMS.** Notify.lk and Twilio are not exercised; M1 uses the log sink. Live delivery, spend caps and the captcha are M6.
- **Push.** Not in M1 ("Allow notifications?" is M6).
- **Email.** Mailpit only; SES needs staging and production access.
- **The breached-password API.** It is network-dependent, so it fails open and tests use a fake.

**Mobile**
- No simulators or SDKs here, so `integration_test` and Maestro run only in CI nightly.
- `local_auth` is verified with a fake in widget tests. A real Face ID or fingerprint check needs a device run before M1 is ticked (spec 17: the PR shows a green nightly or a local `e2e:mobile` run).

**WebKit and localhost cookies**
- Secure cookies on `http://localhost` behave differently in WebKit, hence the local cookie names.
- Staff (:3000) and console (:3001) share cookies across ports locally. Distinct names avoid clashes; production hosts are separate.

**Infrastructure**
- WebSockets through Next.js rewrites in dev (the D28 follow-up) may need a small proxy if `next start` does not upgrade. Task 6 tests it.
- **Staging config.** M1 makes `FIELD_ENCRYPTION_KEY` and the JWT keys required. The Terraform changes are validated offline only, and the first staging deploy needs the hand-set JWT keys and `SEED_PASSWORD` (`infra/README.md` checklist). No AWS command runs in M1.

**Tests and dependencies**
- **E2E stack flakiness.** Journeys now need Postgres, Redis, Mailpit and the API in `pnpm verify` and CI `e2e-smoke`. Unique emails per run and a fresh database per run keep them independent.
- **New dependencies.** Argon2 is native (prebuilt), plus `openid-client`, `jose`, `otplib`, `nodemailer`, `qrcode` and the Flutter plugins. They may trip `pnpm audit` or need platform builds in the Docker images (`docker/api.Dockerfile` on Alpine needs the musl Argon2 binary; Task 4 checks `scripts/docker-build.mjs api`).
- **Pre-launch regression.** Any change to `src/app/layout.tsx`, `(public)/**` or shared `@quad/ui` pieces the landing imports reaches `quad-edu.com` on the next merge to `main`. Task 17's guard test and Task 26's export comparison cover it.
