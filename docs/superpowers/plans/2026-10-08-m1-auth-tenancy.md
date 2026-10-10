# M1 Auth, Tenancy and Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status (2026-10-10): complete.** All 28 tasks are done and M1 is ticked in spec 18. Task 8 (SSO) was built and then removed by D37; the decisions as built are D32 and D46 to D54 in spec 02.

**Goal:** Everyone signs in at one domain. Staff use identifier-first sign-in at `quad-edu.com/sign-in` (work email and password, TOTP, forgot password, lockout, **Choose a school**; no Google or Microsoft sign-in, D37). Quad staff sign in to the console with email, password and TOTP. Parents sign in to the Flutter app with an OTP, then JWT with refresh rotation and biometric unlock. Every tenant table has FORCE RLS. Every route is guarded by `@Can`/`@Module`. School admins manage **Users & roles**, the **School settings** shell and the **Audit** view, and can **Preview a role**. Quad support enters a school only through a reasoned, logged, 60-minute support session with a banner. Journeys 17, 18, 19, 42, 43 (web and enquiry parts) and 50 are green in `pnpm verify`.

**Architecture:**
- **Database.** Migrations `0003`–`0006` add three classes of table:
  - **tenant tables** (`[T]`, with the M0 `tenantRlsSql`);
  - **account tables** (global identity rows, with RLS keyed on `app.account_id`, proposed D32);
  - **platform tables** (closed to `quad_app`).

  Named security-definer functions are the only cross-tenant or cross-account reads (D16, D24).
- **API.** New modules:
  - `src/modules/{auth,me,users,roles,school,audit}` (services; self-scoped `/me*` controllers);
  - `src/public/{auth,signed-links,enquiry}` (tenant-less controllers, spec 05 Rules);
  - `src/platform/{auth,me,tenants,support,audit}` (the only `withPlatform` callers);
  - `src/common/{session,guards,rate-limit,crypto,delivery,audit}`.
- **Web.**
  - `apps/staff`: a new `(auth)` route group for `/sign-in/**`; the `/app` shell reads the session and permissions.
  - `apps/console`: gains `/sign-in` and a session-aware shell.
- **Mobile.** `apps/parent/lib/features/auth` and `core/{auth,secure_store,lock}`.
- **Rules.** Permission maths, sign-in steps, lockout, OTP limits, session expiry and page access are pure functions in `packages/domain`.

**Tech Stack (new):**
- API:
  - `@node-rs/argon2` (Argon2id);
  - `otplib` (TOTP);
  - `openid-client` (Task 8 only; removed with the SSO code in `5c9b64a`, D37);
  - `jose` (EdDSA JWT);
  - `nodemailer` (SMTP to Mailpit; SES adapter stubbed to the same interface);
  - `@fastify/cookie`.
- Web: `qrcode` (the TOTP QR, rendered client-side); `@quad/client` and `@tanstack/react-query` in `apps/staff` and `apps/console`.
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

**Pre-flight rulings applied (2026-10-08)** (register: `.superpowers/sdd/2026-10-08-m1-auth-tenancy/preflight.md`; every ruling is built into the task text below):
- Schema, RLS and definers: F01, F03, F04, F10, F17, F21, F22, F40, F46, F47, F49, F50, F51, F59.
- Guards, sessions and auth routes: F02, F05, F06, F09, F11, F12, F13, F14, F16, F32, F34, F35, F36, F37, F38, F39, F42, F43, F44, F45, F57, F61, F62, F63, F65.
- Configuration, crypto and logging: F08, F18, F19, F33, F54, F55.
- Task order, seeds and the e2e stack: F07 (tasks renumbered), F20, F23, F24, F64.
- Web and Flutter screens: F25, F26, F27, F30, F31, F41, F48, F53, F56, F60.
- Decision log and spec edits: F15, F28, F29, F52, F58.

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
- Tenant-less routes live only in `apps/api/src/public/**` or `apps/api/src/webhooks/**`. Each has a forged and an expired token test, and opens `withTenant()` only after the check. The sign-in controllers are tenant-less (D16), so they live in `apps/api/src/public/auth/`; their services may stay in `apps/api/src/modules/auth/`.
- New security-definer functions:
  - are owned by `quad_owner`;
  - pin `search_path`;
  - return the minimum columns;
  - grant `EXECUTE` to `quad_app` only;
  - have a cross-tenant test and a D32 entry.
- `quad_owner` is `NOBYPASSRLS` and FORCE RLS filters it. Definers read FORCE-RLS tables only through the `definer_read` policy of Task 3, which exists on exactly `accounts`, `sessions`, `users`, `user_roles` and `roles` (an amendment of D24 recorded in D32).
- Every route carries exactly one access marker: `@Public()`, `@PreAuth(stage)`, `@Authenticated()` (self-scoped: `/me*`, `/auth/sign-out`, `/auth/select-school`, `/school/branding`), `@Can(...)` or `@PlatformRole(...)`. Task 12's route walk fails on anything else.
- Audits go through `AuditService` and `PlatformAuditService` (both created in Task 6), in the same transaction as the change.
- Every endpoint gets four tests: happy path, 400 `validation`, 403 (`forbidden`, `module_not_in_plan` or `preview_read_only` as applicable), and cross-tenant (404 by id, absent from lists).
  - For tenant-less auth routes, "permission" becomes 401/`invalid_link`.
  - For these routes, "cross-tenant" becomes "the token or membership of school A never reaches school B".
- Nothing logs phone numbers, emails, codes, tokens, passwords or TOTP secrets, except local OTP codes, which the `log` SMS provider prints when `APP_ENV=local` (spec 02). Signed-link tokens appear only in paths, and the request log records route templates (D25).
- Safeguarding and medical data are refused in support sessions (spec 05).

**Configuration**
- A new variable goes into the spec 02 table, `.env.example` (same order) and `apps/api/src/config.ts` (or `NOT_READ_BY_THE_API`) in one commit, in the task that first uses it. The parity tests enforce it.
- `DEV_FIXED_OTP` stays refused at boot in production (already in `config.ts`; keep the test). `CONSOLE_PASSWORD_LOGIN` and its refusal went with the D37 SSO removal (`e28641c`), because password sign-in is the only console sign-in.

**Decision log (D32)**
- Task 1 adds the D32 row skeleton to `docs/spec/02-architecture.md` (D28 style: a summary sentence and a `<ul>` per area: Tables and lookups, Signed links, Sessions, Crypto, Access, Configuration, Testing, Pre-launch).
- Each task appends the bullets in its own **D32** line, in its own commit, plus the exact versions of any dependency it installs.
- Task 28 only finalises. The full list is in "Proposed decision-log row" below.

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
     - Task 19 adds a test that `src/app/layout.tsx` imports nothing from `@/lib/session`, `@quad/client` or `(auth)`.
  3. **Extend the export check.** `apps/staff/scripts/build-export.mjs` `checkExport()` must also refuse `sign-in`, `sign-in.html` and any `sign-in/` folder. It gets a unit test in `apps/staff/test/build-export.test.ts`.
  4. **Assert the export is unchanged.** Task 19 changes `e2e/landing.spec.ts` so that, in the `export-*` projects only, `/sign-in` is a 404 on the served export and no `a[href^="/sign-in"]` exists. Neither assertion exists today (the file asserts the exact `a[href="/sign-in"]`).
  5. **Leave the landing alone.**
     - Do not touch `src/app/(public)/**`. `SignInEntry` keeps its D30 behaviour: the coming-soon note when `NEXT_PUBLIC_QUAD_PRELAUNCH=true`, otherwise a link to `/app`.
     - In the normal build, `/app` redirects a signed-out visitor to `/sign-in?next=/app`. Journey 17 works from the landing's **Sign in** that way.
     - The landing **sign-in dialog**, `/#signin` and **Open {school}** are M1b (spec 19, M1b scope). M1 does not build them.
  6. **Keep the Pages workflow green.** `pages.yml` must stay green on every M1 commit (`build:export` and `e2e:export`). Run both in Task 27, and compare the export's landing screenshots with `docs/screenshots/landing/` (no visual change).

## Review Focus

1. **Account enumeration.**
   - `POST /auth/password` gives a wrong password and an unknown email the same 401 body (`POST /auth/identify` carried this check until the D37 removal, `5c9b64a`, took the route out).
   - `POST /auth/password/forgot` and `POST /auth/otp/request` answer 202 either way.
   - Timing is equalised with a dummy Argon2 verify.
   - Task 7 and Task 9 own the tests.
2. **Choosing a school you don't belong to.**
   - `POST /auth/select-school` with a tenant the account has no active membership in, or a membership that is deactivated, or a tenant that is suspended, or a membership of the wrong kind (a guardian membership on the staff cookie, a staff membership on a parent token), is refused, and the session stays without a school.
   - `?school=` never selects a tenant on its own.
   - Task 7 owns the cookie test and Task 9 the bearer test.
3. **Signed links.** These are all refused with `400 invalid_link` and no school name in the body:
   - a tampered payload;
   - a re-signed payload with another key;
   - a wrong purpose;
   - an expired token;
   - a reused single-use nonce.

   Task 4 owns the unit tests (nonce reuse with a fake `consumeSignedToken`), Task 7 the API tests (including the real nonce reuse) and Task 26 journey 43.
4. **Raw-query isolation.** As `quad_app`, `select * from <each tenant table>` returns only school A's rows with `app.tenant_id = A`, and nothing with no school. For account tables, it returns only the current account's rows. Task 1 owns the account-table test, Task 2 the tenant-table test, and Task 3 the test that the `definer_read` policy gives `quad_app` nothing.
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
  - `packages/db/src/account-tables.ts` (`ACCOUNT_TABLES` with each table's key column, and `OPEN_TABLES`);
  - `packages/db/src/account.ts` (`withAccount`);
  - `packages/db/migrations/0003_platform_access.sql`, then `0004_accounts.sql` (generated in two `pnpm db:generate` runs, platform schema first, so `sessions` can reference `platform_users` and `support_sessions`; plus the RLS and grant SQL);
  - `packages/db/test/account-rls.api.test.ts`;
  - `packages/db/test/client-reset.api.test.ts`.
- Modify:
  - `packages/db/src/{rls.ts,platform-tables.ts,db.ts,index.ts,client.ts,schema/index.ts}`;
  - `packages/contracts/src/enums.ts`;
  - `packages/db/test/{migration.test.ts,factories.ts}`;
  - `docs/spec/02-architecture.md` (the D32 row skeleton).

**Tables (account class: global rows, no `tenant_id`; RLS `<key> = nullif(current_setting('app.account_id', true), '')::uuid`, where the key column is `id` on `accounts` and `account_id` on the others; ENABLE + FORCE; explicit `quad_app` grants):**

| Table | Columns (spec 04 plus the M1 additions in bold) | Index | quad_app |
|---|---|---|---|
| `accounts` (key `id`) | id, email citext unique null, phone_e164 unique null (check: at least one), status `account_status` (`active`,`locked`,`disabled`), **locked_until**, created_at, last_sign_in_at | unique email, unique phone | S, I, U |
| `credentials` | account_id pk, password_hash, totp_secret_enc, totp_enabled, recovery_codes_hash text[], **password_changed_at** | pk | S, I, U |
| `identities` | id, account_id, provider `sso_provider`, subject, email; unique (provider, subject) | (account_id) | S, I |
| `sessions` | the spec 04 columns, plus **token_hash** (unique), **stage** `session_stage` (`two_step`,`two_step_setup`,`choose_school`,`active`), **keep_signed_in**, **refresh_generation** int, **preview_role_id**, **preview_sample_user_id**, **support_session_id**. FKs to `platform_users` and `support_sessions` here; the `users` and `roles` composite FKs come in Task 2's 0005 | (account_id, revoked_at), unique token_hash, (active_tenant_id, active_user_id) | S, I, U |
| `trusted_devices` (new) | id, account_id, token_hash unique, created_at, expires_at, revoked_at | (account_id) | S, I, U |
| `otp_challenges` (open table: no account until verified; no RLS; listed in `OPEN_TABLES`) | id, subject_hash, channel `otp_channel`, code_hash, purpose, attempts, expires_at, created_at | (subject_hash, created_at desc) | S, I, U, D |

Notes:
- The policy on `sessions` is `account_id = app.account_id`. Console rows (`account_id` null, `platform_user_id` set) are therefore invisible to `quad_app`; console code reaches them through `withPlatform`.
- `withAccount(accountId, fn)` sets `app.account_id` (transaction-local). It also accepts `{ tenantId }` to set both settings in one transaction.
- `otp_challenges` hashes are keyed, because the table is open: `code_hash` is HMAC-SHA256 over `(challenge_id, code)` with a key derived by HKDF-SHA256 from `SESSION_SECRET`; `subject_hash` is HMAC-SHA256 of the normalised phone or email with the same key. Task 9 writes them.

**Tables (platform class: no `quad_app` privilege; added to `PLATFORM_TABLES`):**
- `platform_users`: spec 04, plus **password_hash** (nullable; used only with `CONSOLE_PASSWORD_LOGIN`) and **totp_enabled**.
- `platform_audit`: spec 04. Append-only: a trigger refuses UPDATE and DELETE, as the `quad-tenant-table` skill says.
- `support_sessions`: spec 04, plus **expires_at**.
- `signed_token_uses`: spec 04.
- `tenant_branding`, `tenant_modules` and `tenant_security`: spec 04.
- Each foreign key (`tenant_id`, `platform_user_id`) is indexed.

**Migration test changes (`rls.ts` `findTenancyViolations`):**
- A table is a tenant table, an account table (`ACCOUNT_TABLES`), an open table (`OPEN_TABLES`) or a platform table (`PLATFORM_TABLES`). Anything unclassified fails.
- Account tables must have their declared key column (`id` on `accounts`, `account_id` elsewhere), FORCE RLS, exactly the account policy on that column, and `quad_app` privileges equal to their declared set.
- D27 follow-up: the platform check also covers column-level grants and sequences, so `quad_app` holds no column privilege on a platform table and no `USAGE`/`SELECT` on platform sequences.
- D27 follow-up: connection reset also runs `pg_advisory_unlock_all()` and `DISCARD TEMP` after `RESET ALL` (`client.ts`), with a test.

**D32** (Task 1 creates the row with the area headings above, then appends under Tables and lookups): account tables with RLS on `app.account_id` and `withAccount` (OQ1); `otp_challenges` as the only open table, with HMAC-keyed `code_hash` and `subject_hash`; the account and open table classes in `findTenancyViolations`; migration order `0003_platform_access`, `0004_accounts`; the new columns and `trusted_devices`.

Steps:
- [x] **Step 1: Write failing tests.**
  - `migration.test.ts`:
    - every table is classified;
    - a probe account table without FORCE fails with `<name>: FORCE ROW LEVEL SECURITY missing`;
    - a probe platform table with a column grant to `quad_app` fails;
    - `quad_app` has no privilege on any platform table.
  - `account-rls.api.test.ts` (Review Focus #4, account part):
    - under `withAccount(A)`, `quad_app` sees only A's `accounts`, `credentials`, `sessions` and `trusted_devices`;
    - with no account set it sees none;
    - inserting a `sessions` row for B under A fails WITH CHECK.
  - `client-reset.api.test.ts`: after a transaction that took an advisory lock and a temp table, the next checkout holds neither.
- [x] **Step 2: Run them to see them fail.** `pnpm --filter @quad/db test:api`. Expected: FAIL.
- [x] **Step 3: Implement.**
  - Add the enums to `@quad/contracts` `enums.ts`: `AccountStatus`, `SsoProvider`, `SessionKind`, `SessionStage`, `OtpChannel`, `PlatformRole`, `TwoStepRule`, `PlanModule`, `MembershipKind`, `MembershipStatus`, `RoleScope`, `SensitiveKey`.
  - Run `pnpm db:generate` for the platform schema (`0003_platform_access`), then again for the account schema (`0004_accounts`). Append an `accountRlsSql(table, keyColumn)` helper's output (ENABLE, FORCE, policy, grants) and the triggers.
  - Add the D32 row skeleton and this task's bullets.
- [x] **Step 4: Run the checks.** `pnpm db:migrate && pnpm --filter @quad/db test && pnpm --filter @quad/db test:api`. Expected: PASS.
- [x] **Step 5: Commit.** `feat(db): account and platform access tables with account-scoped RLS`.

**Acceptance:** M1 Accept bullet "the app role cannot read another tenant's rows even with a raw query" (the account half). The migration test now covers every table.

### Task 2: Tenant identity tables with FORCE RLS and cross-tenant tests

**Files:**
- Create:
  - `packages/db/src/schema/tenant/{users,roles,role-permissions,role-sensitive,user-roles,school-settings,audit-log}.ts`;
  - `packages/db/migrations/0005_identity_tenant.sql`;
  - `packages/db/test/identity-tenant.api.test.ts`.
- Modify:
  - `packages/db/src/schema/index.ts`;
  - `packages/db/src/schema/account/sessions.ts` (the composite FKs below);
  - `packages/db/test/factories.ts` (factories for every new table);
  - `packages/contracts/src/enums.ts`.

**Tables.** Each has `tenant_id uuid not null references tenants(id)`, a `(tenant_id, …)` index, ENABLE + FORCE RLS, the `tenant_isolation` policy through `tenantRlsSql`, and the cross-tenant test below. Composite FKs `(tenant_id, x_id) → x(tenant_id, id)` follow D23.

| Table | Key columns | Indexes |
|---|---|---|
| `users` [T][S] | spec 04 | unique (tenant_id, account_id); (tenant_id, kind, status); (tenant_id, email) |
| `roles` [T] | spec 04; unique (tenant_id, key) | (tenant_id, system) |
| `role_permissions` [T] | tenant_id, role_id, module `permission_module`, actions bit(5); pk (tenant_id, role_id, module) | (tenant_id, role_id) |
| `role_sensitive` [T] | tenant_id, role_id, key `sensitive_key`; pk (tenant_id, role_id, key) | (tenant_id, role_id) |
| `user_roles` [T] | tenant_id, user_id, role_id, primary bool; pk (tenant_id, user_id, role_id); partial unique (tenant_id, user_id) where primary | (tenant_id, role_id) |
| `school_settings` [T] | spec 04, plus **address** (08 General lists it; no column exists) and **sms_sender_status** (`requested`,`approved`; 08 "QUAD until approved") | pk (tenant_id) |
| `audit_log` [T] | spec 04, plus **support_session_id**; append-only trigger | (tenant_id, at desc), (tenant_id, actor_user_id, at desc), (tenant_id, action, at desc) |

Other notes:
- The permission-matrix module enum is `permission_module`, with the spec 05 list: `admissions`, `crm`, `sis`, `attendance`, `lms`, `fees`, `finance`, `transport`, `settings`. It is separate from `tenant_modules.module` (spec 04: `parent` instead of `attendance` and `settings`). Mapping lives in Task 11.
- 0005 also adds the `sessions` composite FKs that 0004 could not: `(active_tenant_id, active_user_id) → users(tenant_id, id)`, `(active_tenant_id, preview_sample_user_id) → users(tenant_id, id)` and `(active_tenant_id, preview_role_id) → roles(tenant_id, id)`.
- `devices`, `staff_profiles`, `guardians` and `guardian_invites` are not created in M1. They arrive with M3 and M6, the milestones that write them.

Steps:
- [x] **Step 1: Write failing tests** (`identity-tenant.api.test.ts`, two real tenants through `quad_app`). For each table:
  - a row written under A is invisible under B;
  - writing with B's `tenant_id` while in A fails;
  - with no `app.tenant_id`, `select count(*)` is 0;
  - a raw `quad_app` pool query with `set_config('app.tenant_id', A)` returns only A's rows (Review Focus #4, tenant part).
  - Also: `audit_log` refuses UPDATE and DELETE (this is the only test of that trigger; Task 15 does not repeat it).
  - Also: a `sessions` row whose `active_user_id` belongs to another tenant fails the composite FK.
- [x] **Step 2: Run them to see them fail.** Expected: FAIL.
- [x] **Step 3: Implement** with `pnpm db:generate` plus `tenantRlsSql` for each table.
- [x] **Step 4: Run the checks.** `pnpm db:migrate && pnpm --filter @quad/db test:api`. Expected: PASS, with `findTenancyViolations` empty.
- [x] **Step 5: Commit.** `feat(db): tenant identity, roles, school settings and audit tables with FORCE RLS`.

**Acceptance:** M1 Scope "RLS policies with FORCE ROW LEVEL SECURITY on every tenant table, with the migration test from M0 covering them all". Accept: "the app role cannot read another tenant's rows even with a raw query".

### Task 3: Security-definer lookups (D16) and the definer calls

**Files:**
- Create:
  - `packages/db/migrations/0006_definers.sql` (hand-written, created with `pnpm db:generate --custom --name definers` so `meta/_journal.json` lists it);
  - `packages/db/test/definers.api.test.ts`.
- Modify:
  - `packages/db/src/definers.ts` (extend `DefinerCalls`), `packages/db/src/index.ts`;
  - `packages/db/src/rls.ts` (the `definer_read` allow-list) and `packages/db/test/migration.test.ts`;
  - `docs/spec/02-architecture.md` (D32 bullets).

**Definer read access (amends D24).** `quad_owner` is `NOBYPASSRLS` and FORCE RLS filters it, so without this every definer below returns 0 rows.
- 0006 adds `CREATE POLICY definer_read ON <t> FOR SELECT TO quad_owner USING (true)` on exactly `accounts`, `sessions`, `users`, `user_roles` and `roles`. No other table, command, role or policy.
- `findTenancyViolations` allows exactly that policy (name `definer_read`, `SELECT`, role `quad_owner`, `USING (true)`) on exactly those five tables, from a named constant in `rls.ts`. Any other extra permissive policy still fails, as before.

**Definer writes and `credentials`.** `definer_read` is SELECT-only and does not cover `credentials`.
- A definer that writes an account-class row or reads `credentials` passes the normal account policy: it sets `app.account_id` to that row's account with `set_config(…, true)` and restores the caller's value before it returns. (Ruling R-definer-account: accepted. The switch lives in one helper, `with_account_scope`, which restores the caller's value on every path, including errors, through an exception block; a test asserts `current_setting('app.account_id')` is unchanged after a successful and after a failing call, and that the target account must belong to `app.tenant_id`.)
- Tenant-class reads and writes inside the tenant-scoped definers run under the caller's `app.tenant_id`.
- **Support sessions never create a null-account `sessions` row (controller ruling R-support-token).** The support cookie's SHA-256 hash is stored on `support_sessions.token_hash` (new nullable `bytea` column, unique). `redeem_support_session(p_support_session_id uuid, p_token_hash bytea)` sets that column once (refused if already set, ended or expired) and returns the support session id; `end_support_session(p_token_hash bytea)` ends the support session and writes one `platform_audit` row. `session_by_token` resolves a hash against `sessions` first and then against active `support_sessions`, returning `{kind: 'support', tenant_id, support_session_id, expires_at}` for the latter. No new policy is added.

**Functions.** All are `SECURITY DEFINER`, owned by `quad_owner`, `SET search_path = public, pg_temp`, `REVOKE ALL FROM PUBLIC`, `GRANT EXECUTE TO quad_app`.

| Function | Returns | Rule |
|---|---|---|
| `auth_memberships(p_account_id uuid)` (spec) | tenant_id, tenant_name, short_name, logo_file_id, brand_color, kind, user_id, role_names text[], suspended bool, suspend_reason | Only active memberships of tenants with status in (`trial`,`onboarding`,`active`,`past_due`,`suspended`). Suspended tenants are returned with `suspended = true` and the reason, so sign-in can show it (spec 07, journey 23 in M2). Never emails or phones. Wider than spec 02 and 04 on purpose: listed in D32, and Task 28 edits spec 02 and 04 |
| `account_by_identifier(p_email citext, p_phone text)` (new) | id, status, locked_until | Exactly one of the two arguments |
| `session_by_token(p_token_hash bytea)` (new) | session id, account id, platform user id, active tenant id, active user id, stage, kind, expiry fields, preview ids, support session id | Not revoked (no revoked flag in the result). A row with `support_session_id` is returned only while that `support_sessions` row is active (not ended, before `expires_at`) and its tenant equals `active_tenant_id`. Used once per request (cached in Redis) |
| `sso_methods_for_domain(p_domain citext)` (new) | google bool, microsoft bool | True when any active tenant has that `sso_domain` with the provider on. No tenant id |
| `auth_sign_in_rules(p_account_id uuid)` (new) | one row per active staff membership: tenant_id, two_step, role_keys text[], password_min_length | No aggregation in SQL: `strictestTwoStep` (Task 7, `packages/domain`) decides |
| `current_tenant_profile()` (new; reads only `app.tenant_id`) | name, short_name, status, suspend_reason, time_zone, locale, currency, brand_color, logo_file_id, modules text[], two_step, sso_google, sso_microsoft, sso_domain, password_min_length, session_hours, ip_allowlist | No row without `app.tenant_id`. This is how school code reads platform-owned settings (D24) |
| `update_current_tenant_name(p_name text)` (new) | void | Updates `tenants.name` for `app.tenant_id` only, and writes `platform_audit` |
| `consume_signed_token(p_nonce text, p_purpose text, p_expires_at timestamptz)` (new) | boolean | `insert … on conflict do nothing`; true only the first time |
| `record_support_audit(p_support_session_id uuid, p_action text, p_target_type text, p_target_id uuid, p_meta jsonb)` (new) | void | Inserts into `platform_audit` only if that support session is active and its tenant equals `app.tenant_id` |
| `ensure_account_for_email(p_email citext)` (new; tenant-scoped) | id | Refuses without `app.tenant_id`. Returns the existing account's id, or inserts one (status `active`). Never a second account for one email (Task 13 invites) |
| `member_two_step_status(p_user_ids uuid[])` (new; tenant-scoped) | user_id, totp_enabled | Only users of `app.tenant_id`; other ids are dropped. Reads `credentials` per account as above (Task 13 list, summary and Remind) |
| `revoke_member_sessions(p_user_id uuid)` (new; tenant-scoped) | void | The user must belong to `app.tenant_id`. Revokes only that member's account's sessions with `active_tenant_id = app.tenant_id`, plus that account's mobile refresh families for that tenant (Task 13 deactivate and sign out everywhere) |
| `redeem_support_session(p_support_session_id uuid, p_token_hash bytea)` (new; tenant-less, D16) | support_session_id | R-support-token: only when the support session is active and its `support_sessions.token_hash` is still unset; sets it. Otherwise no row (Task 16) |
| `end_support_session(p_token_hash bytea)` (new; tenant-less, D16) | void | Ends both rows (`support_sessions.ended_at`, `sessions.revoked_at`) and writes `platform_audit` (Task 16) |
| `tenant_by_embed_key(p_key text)` (spec; **stub**) | tenant_id, form_id, active | Body `where false` until M4 creates `enquiry_forms`; the signature is fixed now |
| `tenant_by_gateway_account(p_provider text, p_account_id text)` (spec; **stub**) | tenant_id, gateway_account_id, mode | Body `where false` until M7 |

**D32** (append under Tables and lookups):
- the new definers `account_by_identifier`, `session_by_token`, `sso_methods_for_domain`, `auth_sign_in_rules`, `current_tenant_profile`, `update_current_tenant_name`, `consume_signed_token`, `record_support_audit`, `ensure_account_for_email`, `member_two_step_status`, `revoke_member_sessions`, `redeem_support_session` and `end_support_session`, and the two D16 stubs;
- `definer_read` (`FOR SELECT TO quad_owner USING (true)` on exactly `accounts`, `sessions`, `users`, `user_roles` and `roles`) as an amendment of D24's "no other permissive policy", because `quad_owner` is `NOBYPASSRLS`;
- `auth_memberships` returns suspended schools and the columns `short_name`, `user_id`, `suspended` and `suspend_reason`.

Steps:
- [x] **Step 1: Write failing tests** (`definers.api.test.ts`, plus `migration.test.ts`).
  - `auth_memberships`:
    - returns A and B for a two-school account and omits a deactivated membership;
    - omits a `deleted` tenant;
    - flags a suspended tenant with its reason;
    - returns no email or phone column.
  - `auth_sign_in_rules`: one row per active staff membership with its `role_keys`; none for a guardian membership.
  - `session_by_token`: omits a revoked row; omits a support row whose support session has ended or expired, or whose tenant differs.
  - `current_tenant_profile()`: under `withTenant(A)` returns A only; with no tenant returns 0 rows.
  - `update_current_tenant_name`: cannot change B while in A.
  - `consume_signed_token`: true, then false.
  - `record_support_audit`: refuses a session for another tenant and an ended session.
  - `ensure_account_for_email`: refuses with no tenant; returns the same id twice for one email (one account).
  - `member_two_step_status`: under A, B's user ids are dropped.
  - `revoke_member_sessions`: under A, it leaves the member's B sessions and B refresh families untouched, and does nothing for a B user id.
  - `redeem_support_session` and `end_support_session` (R-support-token): redemption works once; refused for an ended or expired support session; ending writes one `platform_audit` row.
  - The two stubs return 0 rows for any input.
  - As `quad_app`, `select * from tenant_security` still fails with permission denied.
  - `definer_read` gives `quad_app` nothing: as `quad_app` with no setting, `accounts`, `sessions`, `users`, `user_roles` and `roles` return 0 rows; under A they return only A's rows.
  - `migration.test.ts`: a probe `definer_read` policy on a sixth table fails, and one `TO quad_app` or `FOR ALL` on a listed table fails.
- [x] **Step 2: Run them to see them fail.** Expected: FAIL.
- [x] **Step 3: Implement** the SQL and the typed `DefinerCalls` methods:
  - tenant-less: `authMemberships`, `accountByIdentifier`, `sessionByToken`, `ssoMethodsForDomain`, `authSignInRules`, `consumeSignedToken`, `redeemSupportSession`, `endSupportSession`, `tenantByEmbedKey`, `tenantByGatewayAccount`;
  - inside `withTenant` through a `tx` helper: `currentTenantProfile`, `updateCurrentTenantName`, `recordSupportAudit`, `ensureAccountForEmail`, `memberTwoStepStatus`, `revokeMemberSessions`.
  - Append the D32 bullets.
- [x] **Step 4: Run the checks.** `pnpm db:migrate && pnpm --filter @quad/db test && pnpm --filter @quad/db test:api`. Expected: PASS.
- [x] **Step 5: Commit.** `feat(db): security-definer lookups for sign-in, tenant profile and signed tokens`.

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
  - `apps/api/src/config.ts`, `.env.example`, `docs/spec/02-architecture.md` (the variables table: `FIELD_ENCRYPTION_KEY` is required in every environment until M12's KMS adapter, and `KMS_KEY_ID` arrives in M12; plus D32 bullets);
  - `infra/modules/app/secrets.tf` and its test (new secrets; offline only);
  - `infra/modules/app/tasks.tf` (the comment at line 36, to match);
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
  4. `consume_signed_token` for single-use purposes (injected, so unit tests use a fake).

  Any failure is a `400 invalid_link` with one message, never naming the school.
- `FieldCipher` (lives in `packages/db/src/crypto/field-cipher.ts`, exported from `@quad/db`, so the API and the seed share one implementation; ruling R-fieldcipher): AES-256-GCM, `v1.<iv>.<ciphertext>.<tag>`, with the key derived by HKDF-SHA256 from `FIELD_ENCRYPTION_KEY` (32 characters or more).
  - It sits behind an interface, so a KMS adapter (`KMS_KEY_ID`) can replace it in M12 (D32).
  - It encrypts TOTP secrets now.
- `PasswordHasher`: Argon2id (`m=19456, t=2, p=1`), with `verifyDummy()` to equalise timing.
- `BreachCheck`: the k-anonymity range API (`api.pwnedpasswords.com/range/<5>`, `Add-Padding`) with a 2 s timeout that fails open and logs a metric. Tests and `APP_ENV=local` use the injected offline fake (OQ14).
- `JwtKeys`: EdDSA (Ed25519) from `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY`.

**Config (D27 follow-up: format rules):**
- Now required in every environment: `FIELD_ENCRYPTION_KEY`, `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY`. Spec 02 currently says "`FIELD_ENCRYPTION_KEY` (local) or `KMS_KEY_ID` (AWS)"; edit that cell and the `tasks.tf` comment in this commit.
- `.env.example` gets local-only placeholder values, which the API refuses outside `local` (the D25 pattern). That includes a published Ed25519 test key pair.
- `SEED_PASSWORD` gets a local-only placeholder, refused outside `local`.
- Infra:
  - `FIELD_ENCRYPTION_KEY` joins `generated_app_secrets` (a 64-character ephemeral `random_password`);
  - `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` get hand-set placeholders (the `SENTRY_DSN` pattern), with a first-deploy checklist step in `infra/README.md` (`openssl genpkey -algorithm ed25519`);
  - `SEED_PASSWORD` is set by hand for staging.
  - Check with `node scripts/infra-check.mjs --only modules/app`.

**D32** (append): Signed links: the payload format, the `SIGNED_LINK_RULES` TTLs, `tid` null for account-level `password_reset`. Crypto: Argon2id through `@node-rs/argon2` (`m=19456, t=2, p=1`); `FieldCipher` AES-256-GCM with HKDF from `FIELD_ENCRYPTION_KEY`, required in every environment until M12's KMS adapter (`KMS_KEY_ID`) replaces it; JWT and field keys required from M1, with local-only placeholders; the breach check fails open. Pinned versions of the packages installed here.

Steps:
- [x] **Step 1: Write failing tests.**
  - Domain: table-driven tests for `signedLinkStatus`, including the exact expiry instant (`exp == now` is expired) and every purpose, plus a `fast-check` property that a payload never verifies under a different purpose.
  - Unit tests:
    - a round trip works;
    - flipping one payload byte gives `invalid_link`;
    - a token signed with `SESSION_SECRET` gives `invalid_link`;
    - a reused single-use nonce gives `invalid_link`, using an injected fake `consumeSignedToken` (the real database case is in Task 7's `forgot-reset.api.test.ts`);
    - `FieldCipher` refuses a changed tag;
    - Argon2 verifies, and refuses a wrong password;
    - the breach fake flags `password123`;
    - the config refuses the placeholder key in `staging` and refuses a key under 32 characters.
  - The infra test asserts the new secrets exist and that the task definition passes them to api and worker.
- [x] **Step 2: Run them to see them fail.** Expected: FAIL.
- [x] **Step 3: Implement.** Include the spec 02 cell, the `tasks.tf` comment and the D32 bullets.
- [x] **Step 4: Run the checks.** `pnpm --filter @quad/domain test && pnpm --filter @quad/api test && node scripts/infra-check.mjs --only modules/app`. Expected: PASS.
- [x] **Step 5: Commit.** `feat(api): signed links, field encryption, Argon2id passwords and token keys`.

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
- The `@RateLimit({ limit, windowSeconds, key? })` decorator and a global interceptor apply:
  - 20 per minute per IP on `/auth/*` and `/platform/auth/*` (spec 06);
  - 600 per minute per user everywhere;
  - 429 `rate_limited` with `Retry-After`.
- `key: (req) => string` is an optional key function for limits on another subject (Task 7 uses it per email). A key built from an email or phone is an HMAC of it (key derived from `SESSION_SECRET`), never the raw value.
- Email:
  - `smtp` (Mailpit locally) and an `ses` adapter behind one interface. SES sends are wired, but untested beyond a fake until staging (D19).
  - From "{School} via Quad" for school mail, and "Quad" for account mail; Reply-To is the school's office email (D19).
  - Every send is a BullMQ job (idempotent on a job id).
- SMS: the `log` provider prints `+94 77 *** **01` and the code only when `APP_ENV=local` (spec 02: codes in the API log; spec 16: no phone numbers in logs, hence the mask; the one logging exception in Global Constraints). `live` (Notify.lk or Twilio) is out of M1 (OQ12).
- Jobs run inside a tenant request context built from the job's verified payload (D28 M1/M6 follow-up), so job spans carry `tenant_id`.

**D32** (append under Configuration): pinned `nodemailer` version.

Steps:
- [x] **Step 1: Write failing tests.**
  - Rate limit: the 21st call in a minute is refused, and the window resets on a fixed clock.
  - A key function limits per subject, and the Redis key holds no raw email (no `@`).
  - Templates render with no unfilled ICU arguments.
  - The SMTP adapter delivers to Mailpit (api test, compose Mailpit).
  - The job is idempotent on its id.
  - The log SMS output contains no full number.
- [x] **Step 2: Run them to see them fail.** Expected: FAIL.
- [x] **Step 3: Implement.**
- [x] **Step 4: Run the checks.** `pnpm --filter @quad/api test && pnpm --filter @quad/api test:api -- delivery`. Expected: PASS.
- [x] **Step 5: Commit.** `feat(api): Redis rate limits and queued email and SMS delivery`.

## Phase 3: Auth API flows

### Task 6: Sessions, the auth guard, CSRF, audit writing and authenticated sockets

**Files:**
- Create:
  - `apps/api/src/common/session/{session.service.ts,session.repository.ts,cookies.ts,csrf.ts,request-auth.ts}`;
  - `apps/api/src/common/guards/{auth.guard.ts,public.decorator.ts,pre-auth.decorator.ts,authenticated.decorator.ts,platform-controller.decorator.ts}`;
  - `apps/api/src/common/audit/{audit.service.ts,audit-actions.ts}` (write side; Task 15 adds the read side);
  - `apps/api/src/platform/audit/platform-audit.service.ts` (write side only);
  - `apps/api/src/modules/me/{me.module.ts,me.controller.ts,me.service.ts,me.routes.ts}` (`GET /me`, `PATCH /me`, `GET /me/sessions`, `DELETE /me/sessions/:id`);
  - `packages/contracts/src/me/*.ts` (including `GreetingPeriod`);
  - `packages/contracts/src/audit/actions.ts` (the action keys);
  - `packages/domain/src/auth/session-expiry.ts` with tests;
  - `apps/api/test/auth/{session,csrf,me}.api.test.ts`, `apps/api/test/audit/{audit-service,platform-audit-service}.api.test.ts` and `apps/api/test/realtime-auth.api.test.ts`.
- Modify:
  - `apps/api/src/{app.ts,common/request-context.ts,realtime/realtime.service.ts,observability/tenant-span-processor.ts,webhooks/ses/ses-webhook.controller.ts}`;
  - `apps/api/src/{health/health.controller.ts,openapi/openapi.controller.ts}` (`@Public()`);
  - `packages/contracts/src/observability/telemetry-scrub.ts` (signed-link path rule);
  - `packages/ui/src/components/GreetingScene.tsx` and `GreetingScene.test.tsx` (import `GreetingPeriod` from `@quad/contracts`);
  - `packages/ui/package.json` (drop `@quad/domain`);
  - `packages/domain/src/greeting/greeting-period.ts` (import the type from `@quad/contracts`);
  - `apps/staff/next.config.ts` (proxy `/socket.io` locally);
  - `docs/spec/02-architecture.md` (D32 bullets).

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
  - support: 60 min hard;
  - parent refresh family: 60 days (spec 05), used by Task 9.
- **Access markers** (the route walk in Task 12 accepts exactly these plus `@Can` and `@PlatformRole`):
  - `@Public()`: no session. `/health/*` (`health.controller.ts`), `/openapi.json` (`openapi.controller.ts`) and `/webhooks/ses` (D28 follow-up) carry it, as do the tenant-less sign-in routes that need no session;
  - `@PreAuth(...stages)`: a pre-auth session at one of the listed stages (the sign-in steps);
  - `@Authenticated()`: an active session or bearer token, no permission check, for self-scoped routes. In M1 exactly: `/me*` (this task, Task 7 `/me/totp`, Task 12 `/me/permissions` and `/me/role-preview` DELETE), `/auth/sign-out` and `/auth/select-school` (Task 7), `/school/branding` (Task 14);
  - `@PlatformController()`: set on every controller class in `apps/api/src/platform/**` (Task 10). `AuthGuard` skips these classes; `PlatformSessionGuard` owns them.
- **Global `AuthGuard`:**
  - every route needs an active session (or, from Task 9, a valid bearer JWT) unless it is `@Public()`, `@PreAuth(...)` at a matching stage, or a `@PlatformController()`;
  - 401 only for a revoked or expired session, a deactivated membership or a deleted tenant (spec 16, "switches into a school they no longer belong to");
  - a suspended tenant is not a 401: `TenantStatusGuard` (Task 12) returns 403 `school_suspended` with the reason (spec 05), except on `POST /auth/sign-out`;
  - a support session has no membership: it is valid while `session_by_token` returns it (its `support_sessions` row active and for the same tenant).
- **CSRF:** double submit. A readable cookie holds HMAC(SESSION_SECRET, token_hash): `__Host-quad_csrf` (Secure, not HttpOnly) outside local, `quad_csrf` locally. Every cookie-authenticated non-GET request must send it back as `X-CSRF-Token`. Bearer requests are exempt.
- **`text/plain` bodies:** refused with 415 on every route except `POST /webhooks/ses` (D28 follow-up).
- **Socket.IO:**
  - `allowRequest` accepts an `Origin` equal to `PUBLIC_WEB_URL` or `CONSOLE_URL`, or no Origin (the parent app);
  - it authenticates with the cookie or `auth.token`;
  - it joins `tenant:{id}` and `user:{id}`, or `platform` for console sessions (spec 06 Realtime; D28 follow-up);
  - staff proxies `/socket.io` to `:4000` locally.
- **Audit writing** (used from Task 7 on):
  - `AuditService.record(ctx, action, target, meta)` writes `audit_log` in the same transaction as the change. In a support session it sets `actor_platform_user_id` and `support_session_id`, and also calls `record_support_audit` (spec 05: dual audit).
  - `PlatformAuditService` (platform folder only) records every `withPlatform` write.
  - Action keys (contracts):
    - `auth.*`: `sign_in`, `sign_in_failed`, `sign_out`, `password_reset`;
    - `user.*`: `invited`, `role_changed`, `deactivated`, `reactivated`, `two_step_reminded`, `password_reset_sent`, `signed_out_everywhere`;
    - `role.*`: `created`, `updated`, `deleted`, `permissions_changed`;
    - `role_preview.*`: `started`, `ended`;
    - `settings.updated`;
    - `support_session.*`: `started`, `ended`;
    - `audit.exported`.
- **`GET /me`** returns:
  - the person (name, first name, theme, locale);
  - the school (name, short name, time zone, brand: `{ color, fill, fillDark, ink }` from `@quad/tokens` `deriveBrand`: `color` = the brand, `fill` = `deriveBrand(hex, 'light').brandFill`, `fillDark` = `deriveBrand(hex, 'dark').brandFill`, `ink` = the light `brandInk`; dark mode keeps the `brand-ink` token);
  - the other memberships, for Switch school;
  - `preview` and `support` banners' data;
  - `greeting` (period and word from `greetingPeriod` in the school's time zone; the D27 M1 follow-up "the API returning the greeting", with `GreetingPeriod` moved to `@quad/contracts` so `packages/ui` drops `@quad/domain`).
- The **telemetry scrubber** gets an explicit pattern for `/sign-in/(reset|invite|support)/<token>` and `/auth/invites/<token>` (D28 follow-up), plus a scrub of pg error `detail` and `where` (D27 follow-up).

**Endpoints** (four tests each; the preview cases move to Task 12, so `GET /me` and `PATCH /me` have three here):

| Route | Contract | Guard / permission | Tests |
|---|---|---|---|
| `GET /me` | `Me` | `@Authenticated` | 200 shape; 401 unauthenticated; B's session never shows A |
| `PATCH /me` | `MeUpdateInput` (name, theme, locale) | `@Authenticated`, CSRF | 200; 400 bad theme; cross-tenant: changes only the current membership |
| `GET /me/sessions` | `paginated(SessionSummary)` | `@Authenticated` | own sessions only; another account's never listed |
| `DELETE /me/sessions/:id` | – | `@Authenticated`, CSRF | 204; 400 bad id; 403 missing CSRF; 404 for another account's session id |

**D32** (append): Sessions: opaque 32-byte cookie, SHA-256 in the database, Redis cache for 30 s; `__Host-` names, but `quad_sid` and `quad_console_sid` without `Secure` when `APP_ENV=local`; double-submit CSRF in `__Host-quad_csrf` (`quad_csrf` locally); `stage` on the session row for the sign-in steps. Access: the `@Authenticated()` marker and its routes (`/me*`, `/auth/sign-out`, `/auth/select-school`, `/school/branding`); `@PlatformController()`; the API computes the school brand palette with `@quad/tokens` `deriveBrand` (a new allowed `apps/api` → `@quad/tokens` import, colour maths only); `GreetingPeriod` in `@quad/contracts`. Pinned `@fastify/cookie` version.

Steps:
- [x] **Step 1: Write failing tests.** The table above, plus:
  - an expired idle session is 401;
  - a revoked session is 401 within one request (cache invalidation);
  - a deactivated membership and a deleted tenant are 401;
  - a support session with no membership works while its support session is active, and is 401 once it has ended;
  - `/health/live` and `/openapi.json` answer without a session;
  - a probe controller marked `@PlatformController()` is not handled by `AuthGuard`;
  - the CSRF cookie is `quad_csrf` with `APP_ENV=local` and `__Host-quad_csrf` otherwise;
  - the `text/plain` POST is 415 except `/webhooks/ses`;
  - a socket from `https://evil.example` is refused;
  - a socket with no Origin and no token gets no rooms;
  - `AuditService`: a rolled-back change leaves no audit row; a support context writes one `audit_log` and one `platform_audit` row;
  - `PlatformAuditService` writes one `platform_audit` row per write.
- [x] **Step 2: Run them to see them fail.** Expected: FAIL.
- [x] **Step 3: Implement.** Register `@fastify/cookie`. Declare the routes in `me.routes.ts`, list them in `src/openapi/document.ts`, and run `pnpm api:client`. Append the D32 bullets.
- [x] **Step 4: Run the checks.** `pnpm --filter @quad/api test && pnpm --filter @quad/ui test && pnpm --filter @quad/api test:api -- auth me realtime audit && pnpm codegen:check`. Expected: PASS.
- [x] **Step 5: Commit.** `feat(api): server-side sessions, auth guard, CSRF, audit writing and authenticated sockets`.

### Task 7: Staff sign-in: identify, password, two-step, lockout, Choose a school, forgot and reset

Follow `quad-api-endpoint` and `quad-domain-logic`.

**Files:**
- Create:
  - `apps/api/src/public/auth/{auth.controller.ts,auth.routes.ts}` (identify, password, totp/verify, memberships, select-school, sign-out, password/forgot; tenant-less, so in `src/public`);
  - `apps/api/src/modules/auth/{auth.module.ts,auth.service.ts,sign-in.service.ts,two-step.service.ts,memberships.service.ts,lockout.service.ts}`;
  - `apps/api/src/modules/me/totp.controller.ts` (`POST /me/totp`, using `two-step.service.ts`);
  - `apps/api/src/public/signed-links/{password-reset.controller.ts,password-reset.service.ts}`;
  - `packages/contracts/src/auth/*.ts`;
  - `packages/domain/src/auth/{next-sign-in-step,lockout,two-step-rule,recovery-codes}.ts` with tests;
  - `apps/api/test/auth/{identify,password,totp,lockout,memberships,select-school,forgot-reset,new-device}.api.test.ts`.
- Modify: `packages/contracts/src/common/errors.ts` (codes `invalid_credentials`, `account_locked`, `invalid_link`, `two_step_required`, `preview_read_only`, `invalid_code`), `packages/contracts/i18n/en.json`, `docs/spec/02-architecture.md` (D32 bullet).

**Domain:**
- `nextSignInStep({ totpEnabled, twoStepRequired, trustedDevice, membershipCount })` returns `two_step`, `two_step_setup`, `choose_school`, `no_school` or `done`. One staff membership gives `done`; several give `choose_school`; none gives `no_school`. The server never pre-selects a school (spec 05).
- `lockoutState(failureTimes, now)`: 5 failures within 15 minutes lock the account until `now + 15 min` (spec 05 step 7).
- `strictestTwoStep(rows)`: takes the `auth_sign_in_rules` rows; `off < admins < staff < all`, matched against each row's `role_keys`. This is the only place the rule is computed.
- `generateRecoveryCodes(rng)`: 10 codes, with `rng` injected.

**Lockout storage:** failure timestamps live in Redis, in a sorted set `lockout:{accountId}` with a 15-minute TTL, and feed `lockoutState`. `accounts.locked_until` persists the lock.

**Kind rule:** the cookie flows list and accept only `kind = 'staff'` memberships. A non-staff membership is refused with 403.

**Endpoints (contracts in `packages/contracts/src/auth`; 20/min per IP):**

| Route | Marker | Behaviour | Required tests (beyond happy and 400) |
|---|---|---|---|
| `POST /auth/identify` `{email}` → `{methods}` | `@Public` | `methods` from `sso_methods_for_domain(domain(email))`, plus `password`. Never reads the account. Per-email limit through the `@RateLimit` key function (HMAC of the email) | **Identical body and status for unknown and known emails** (Accept); 429 after 20/min per IP and 10/15 min per email |
| `POST /auth/password` `{email, password, keepSignedIn}` → `{next, …}` | `@Public` | Argon2 verify (dummy for unknown); lockout; breach check only on set, not on sign-in. Creates a pre-auth session (stage per `nextSignInStep`) and sets the cookie. A failure is audited (`auth.sign_in_failed`) in every school where the account is active staff (OQ11), opening one `withTenant` per school | Wrong password and unknown email both give the same 401 `invalid_credentials`; the 6th try gives 403 `account_locked`, and the lockout email is queued; a disabled account is 401 |
| `POST /auth/totp/verify` `{code} \| {recoveryCode}, trustDevice` | `@PreAuth('two_step')` | `otplib` with ±1 step; `DEV_FIXED_OTP` accepted only when set (local and staging); a recovery code is single use; "Trust this device" writes `trusted_devices` and a 30-day cookie | A wrong code counts toward lockout; a reused recovery code is refused; 401 without a pre-auth session |
| `POST /me/totp` (start) and `POST /me/totp` `{code}` (confirm) → `{otpauthUri}` / `{recoveryCodes}` (`modules/me/totp.controller.ts`) | `@PreAuth('two_step_setup', 'active')` | The secret is encrypted with `FieldCipher` | Refused at stage `choose_school`; a code from another secret is refused (the preview refusal is in Task 12) |
| `GET /auth/memberships` → `{items:[{tenantId, name, shortName, logoUrl, brand, roleNames}]}` | `@PreAuth('choose_school', 'active')` | Only after the password, SSO or OTP step (spec 16); staff memberships only | 401 at stage `two_step`; never lists a deactivated membership, a deleted school or a guardian membership |
| `POST /auth/select-school` `{tenantId, remember}` | `@Authenticated` (also accepts stage `choose_school`) | Must be one of the account's staff `auth_memberships`. Rotates the session token (new cookie), sets `active_tenant_id`/`active_user_id`, writes the `auth.sign_in` audit in that school; `remember` sets the non-sensitive `quad_last_school` cookie (name, logo URL). When the session becomes active and the request has no valid trusted-device cookie, queues the new-device email (spec 16) | **Refuses a tenant the account is not a member of with 403, and the session keeps no school** (Accept); refuses a suspended school with 403 `school_suspended` and the reason; refuses a guardian-only membership with 403; `?school=` alone never selects |
| `POST /auth/sign-out` | `@Authenticated` (also any pre-auth stage) | Revokes the session for every school (spec 05). Allowed for a suspended school | 204; the cookie is cleared; the old cookie then gets 401 |
| `POST /auth/password/forgot` `{email}` → 202 | `@Public` | Queues a `password_reset` link (`tid` null, OQ8) to `quad-edu.com/sign-in/reset/{token}` when the account exists | 202 either way, with identical bodies; rate-limited |
| `POST /auth/password/reset` `{token, password}` (`src/public/signed-links`) | `@Public` (signed) | Verifies the link; checks policy and breach; updates the hash; **revokes all sessions and trusted devices** | Second use gives `invalid_link` (the real nonce-reuse case, against the database); expired, tampered or wrong-purpose give `invalid_link` without a school name (journey 43); a weak password gives 400 with `fields.password` |

Switching school is `POST /auth/select-school` again from an active session. It re-checks the membership and rotates (spec 05).

New-device email tests (`new-device.api.test.ts`): queued once after a sign-in without the trusted-device cookie; not queued with a valid one.

**D32** (append under Sessions): lockout failures in the Redis sorted set `lockout:{accountId}` (15-minute TTL), with `accounts.locked_until` persisting the lock. Pinned `otplib` version.

Steps:
- [x] **Step 1: Write the domain tests** (table-driven, boundaries at exactly 5 failures and at 15:00 minutes), then the API tests above, plus Review Focus #1 and #2 (cookie side).
- [x] **Step 2: Run them to see them fail.** Expected: FAIL.
- [x] **Step 3: Implement.** Then `pnpm api:client`. Append the D32 bullet.
- [x] **Step 4: Run the checks.** `pnpm --filter @quad/domain test && pnpm --filter @quad/api test:api -- auth && pnpm codegen:check`. Expected: PASS.
- [x] **Step 5: Commit.** `feat(auth): identifier-first staff sign-in with two-step, lockout, school choice and password reset`.

**Acceptance:**
- Accept "`/auth/identify` returns the same response for unknown emails".
- Accept "`select-school` refuses a tenant the account is not a member of".
- Accept "a tampered or reused signed link is refused" (API level).

### Task 8: Google and Microsoft SSO (OIDC with PKCE), mocked in tests

> **Removed by owner decision D37.** The owner chose work email sign-in only (2026-10-09). The task below was built and is kept as history. After Task 9 its code and database objects were removed as D37 lists them, with `POST /auth/identify` and the SSO variables: `5c9b64a`, `e28641c` and `6612504` (migration `0012_drop_sso`; `0009` and `0010` stay). Later tasks no longer depend on it.

**Files:**
- Create:
  - `apps/api/src/public/auth/sso.controller.ts` (tenant-less);
  - `apps/api/src/modules/auth/sso/{sso.service.ts,oidc-clients.ts}`;
  - `apps/api/test/fakes/oidc-issuer.ts` (a small Fastify server: discovery, JWKS, authorize, token; ID tokens signed with `jose`);
  - `scripts/fake-oidc.mjs` (the same issuer for Playwright);
  - `apps/api/test/auth/sso.api.test.ts`.
- Modify: `apps/api/src/config.ts`, `.env.example` and the spec 02 variables table (new variable `OIDC_FAKE_ISSUER_URL`, refused outside `local`; when set, the Google, Microsoft and console Google clients use it), and the D32 bullet in spec 02.

**Endpoints** (`@Public`):
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

**D32** (append under Configuration): `OIDC_FAKE_ISSUER_URL` (local only). Pinned `openid-client` and `jose` versions.

Steps:
- [x] **Step 1: Write the tests against the fake issuer.**
- [x] **Step 2: Run them to see them fail.** Expected: FAIL.
- [x] **Step 3: Implement with `openid-client`.** Then `pnpm api:client`. Append the D32 bullet.
- [x] **Step 4: Run the checks.** `pnpm --filter @quad/api test && pnpm --filter @quad/api test:api -- sso`. Expected: PASS.
- [x] **Step 5: Commit.** `feat(auth): Google and Microsoft SSO with PKCE and a fake issuer for tests`.

### Task 9: Parent OTP sign-in, JWT access tokens and refresh rotation

**Files:**
- Create:
  - `apps/api/src/public/auth/otp.controller.ts` (`/auth/otp/request`, `/auth/otp/verify`, `/auth/refresh`; tenant-less);
  - `apps/api/src/modules/auth/otp/otp.service.ts` and `apps/api/src/modules/auth/tokens/{token.service.ts,bearer.ts}`;
  - `packages/domain/src/auth/{otp-send-decision,fixed-otp,phone-e164}.ts` with tests;
  - `packages/contracts/src/auth/{otp,tokens}.ts`;
  - `apps/api/test/auth/{otp,refresh,bearer}.api.test.ts`.
- Modify:
  - `apps/api/src/common/guards/auth.guard.ts` and `apps/api/src/common/session/request-auth.ts` (the bearer path);
  - `apps/api/src/public/auth/auth.controller.ts` (Task 7's owner of `POST /auth/select-school` and `POST /auth/sign-out`: the bearer variants);
  - `packages/domain/src/auth/session-expiry.ts` (if Task 6 did not already cover the 60-day family);
  - `docs/spec/02-architecture.md` (D32 bullets).

**Domain:**
- `otpSendDecision(history, now)`: at most 3 per 15 minutes and 10 per day per subject; resend after 30 s; returns `{ allowed, retryAfter }`.
- `fixedOtpFor({ appEnv, devFixedOtp, storeReviewPhone }, subject)`:
  - `DEV_FIXED_OTP` works in local and staging only;
  - `STORE_REVIEW_PHONE` works only for its own number (spec 16).
- `parsePhone(country, input)`: +94 means 9 digits without the leading 0. Only Sri Lankan (+94) numbers are accepted for now (OQ12, product owner); the list is data so more countries can be added later.
- `sessionExpiry` for a refresh family: 60 days from the family's creation (spec 05).

**OTP hashing:** `otp_challenges.code_hash` is HMAC-SHA256 over `(challenge_id, code)` with a key derived by HKDF-SHA256 from `SESSION_SECRET`; `subject_hash` is HMAC-SHA256 of the normalised phone or email with the same key (the table is open, so an unkeyed hash of a 6-digit code would be reversible).

**Kind rule:** bearer flows list and accept only `guardian` and `relative` memberships. A staff membership is refused with 403.

**Endpoints:**

| Route | Marker | Behaviour | Tests |
|---|---|---|---|
| `POST /auth/otp/request` `{phone}` or `{email}` → 202 | `@Public` | Creates `otp_challenges` (6 digits, 10 min, keyed hashes as above); queues SMS or email; same response whether known or not | Identical 202 for an unknown number; the 4th request in 15 min gives 429 with `Retry-After`; 400 for a bad +94 number |
| `POST /auth/otp/verify` `{phone\|email, code}` → `{status: 'signed_in'\|'choose_school'\|'not_found', firstName?, memberships[], accessToken?, refreshToken?}` | `@Public` | 5 attempts per challenge. Finds the account with `account_by_identifier`; returns guardian and relative memberships from `auth_memberships`. One membership issues a tenant token; several issue a 5-minute `select_school` token (OQ20); none gives `not_found` | A wrong code 5 times kills the challenge; an expired code gives 400 `invalid_code`; a staff-only account gives `not_found`; B's memberships never appear for A's number |
| `POST /auth/select-school` (bearer, `select_school` scope) | `@Authenticated` | Same rule as staff, for guardian and relative memberships only; returns a tenant token pair | 403 for a non-member tenant; 403 for a staff membership (Review Focus #2, bearer side) |
| `POST /auth/refresh` `{refreshToken}` → new pair | `@Public` | Format `{sessionId}.{generation}.{secret}`. A matching generation rotates. **An older generation revokes the family** (spec 05). A family lives 60 days | Review Focus #6; a family older than 60 days gives 401; a refresh token from tenant A cannot select B |
| `POST /auth/sign-out` (bearer) | `@Authenticated` | Revokes this device's family | 204, then refresh gives 401 |

The access JWT (EdDSA, 15 min) carries `sub` (membership id), `acc`, `tid`, `kind` (`guardian` or `relative`), `rh` (the roles hash) and `sid`. In M1 relative tokens reach only `/auth/refresh` and `/auth/sign-out` (M9b adds the moments routes; spec 05 and 06 make `GET /family/me` their only profile route). A test asserts that a relative token gets 403 on `GET /me` and on every other route.

**D32** (append under Sessions): parent JWT EdDSA, 15 min; refresh `{sid}.{generation}.{secret}`, a 60-day family, revoked on reuse; relative tokens reach only refresh and sign-out in M1; the bearer kind rule (guardian and relative only).

Steps:
- [x] **Step 1: Write the tests.**
- [x] **Step 2: Run them to see them fail.** Expected: FAIL.
- [x] **Step 3: Implement.** Then `pnpm api:client` (the Dart client changes too). Append the D32 bullet.
- [x] **Step 4: Run the checks.** `pnpm --filter @quad/domain test && pnpm --filter @quad/api test:api -- otp refresh bearer && pnpm codegen:check`. Expected: PASS.
- [x] **Step 5: Commit.** `feat(auth): parent OTP sign-in with EdDSA access tokens and rotating refresh families`.

### Task 10: Console sign-in under `/platform/auth/*`

**Files:**
- Create:
  - `apps/api/src/platform/auth/{platform-auth.module.ts,platform-auth.controller.ts,platform-auth.service.ts,platform-session.guard.ts,platform-roles.decorator.ts,platform-auth.routes.ts}`;
  - `apps/api/src/platform/me/platform-me.controller.ts`;
  - `packages/contracts/src/platform/auth.ts`;
  - `apps/api/test/platform/auth.api.test.ts`.
- Modify:
  - `docs/spec/02-architecture.md` (D32 bullet).

Every controller in `apps/api/src/platform/**` is marked `@PlatformController()` (Task 6), so the global `AuthGuard` skips it and `PlatformSessionGuard` owns it.

**Endpoints** (accepted only with the console cookie; D28 ruling R-console-realtime):
- `POST /platform/auth/password` `{email, password}`:
  - the only console first factor, in every environment (D37: no Google Workspace sign-in);
  - looks up active `platform_users`; an unknown, deactivated or wrong-password sign-in gets the same 401 and a `platform_audit` failure;
  - leads to the TOTP step.
- `POST /platform/auth/totp/verify`, and `POST /platform/auth/totp/setup` (TOTP is mandatory, spec 07; first sign-in sets it up).
- `POST /platform/auth/sign-out` (`@PlatformRole()`, any role).
- `GET /platform/me` (`@PlatformRole()`, any role: name and role).

Every sign-in and failure is written to `platform_audit` through `PlatformAuditService` (spec 05). The session is `kind='console'` with 8 h idle. `@PlatformRole(...)` guards platform routes (spec 05 roles).

**Tests** (four per endpoint):
- each of the five routes has a happy path, a 400 `validation`, a 401 or 403, and "the console cookie of platform user A never acts as B";
- password + TOTP works;
- an unknown email, a deactivated platform user and a wrong password get the same 401;
- a staff `quad_sid` cookie never authenticates a `/platform` route, and a console cookie never authenticates `/auth`, `/me` or `/users`;
- a `readonly` platform user is 403 on an owner-only probe route;

**D32** (append under Sessions): console sign-in is email, password and TOTP in every environment (D37).

Steps: test first, implement, `pnpm api:client`, append the D32 bullet, then `pnpm --filter @quad/api test && pnpm --filter @quad/api test:api -- platform && pnpm codegen:check`. Commit `feat(console): console sign-in with email, password and TOTP`.

**Acceptance:** Accept "`DEV_FIXED_OTP` is refused at boot when `APP_ENV=production`" (already covered in `config.test.ts`). Journey 42 API side.

**Handed on to the Platform users work (M2, spec 07; from the Task 10 review).** `POST /platform/users/:id/reset-totp` must:
- be owner only, and need a fresh TOTP step-up from the owner making the change (a code checked within the last few minutes, not just an active session);
- clear the target's `totp_secret_enc`, `totp_enabled` and `totp_last_step`, so the next sign-in goes to `two_step_setup`;
- revoke every console session of the target (`kind='console'` rows), in the same transaction;
- write `platform_audit` (actor, target, reason) in that transaction;
- force a password reset: the target sets a new password through a signed link before they can sign in again;
- come with a break-glass runbook for a sole owner who has lost their authenticator, since no other owner can reset them (the last owner cannot be demoted or deactivated, spec 07).

## Phase 4: RBAC and guards

### Task 11: The permission catalogue and access rules

Follow `quad-domain-logic`. 100% branch coverage (D23).

**Files:**
- Create:
  - `packages/contracts/src/permissions.ts` (replaces the stub);
  - `packages/contracts/src/access/staff-pages.ts`;
  - `packages/domain/src/access/{matrix,effective-permissions,system-roles,page-access,role-home,grant-checks}.ts` with tests.
- Modify: `packages/domain/src/index.ts`, `docs/spec/02-architecture.md` (D32 bullet).

**Contracts:**
- `PermissionKey`:
  - every `<module>.<action>` for the 9 matrix modules × 5 actions;
  - `sensitive.{safeguarding,medical,finance_reports,export_data}`;
  - `users.manage` (OQ3).

  Later milestones add their own keys, for example `circle.connection.read`.
- `STAFF_PAGES`: data only, the spec 08 navigation, each page with `{ id, group, href, requires: PagePredicate, planModule? }` per OQ4. The hrefs for Users & roles and School settings are `/app/settings/users` and `/app/settings/school` (Tasks 21 and 22).

**Domain:**
- `normaliseRow(row, change)`: unchecking View clears the row; checking any action checks View (spec 05).
- `systemRoleMatrix(key)`: the defaults for `admin`, `principal`, `finance`, `admissions`, `teacher`, `counsellor` and `frontdesk`, from the spec 05 table, filled in from the prototype's `rolePerms` where the spec is silent (OQ5). The result is frozen.
- `effectivePermissions({ roles, planModules, preview?, support?, adminSensitive })` returns `Set<PermissionKey>`:
  - module rows outside the plan are dropped (`settings` is always in);
  - a preview uses the previewed role, intersected with the admin's own sensitive keys (spec 06);
  - support gets the `admin` matrix minus `sensitive.safeguarding` and `sensitive.medical` (spec 05).
- `pageAccess(perms, planModules)`: each page is `hidden`, `view_only` or `full`. `view_only` means the role has `view` but no create, edit, delete or approve on the page's module.
- `roleHome(perms, primaryRoleScope)`: My teaching when `lms.create` and `primaryRoleScope` is `own_classes`; else Dashboard if visible; else Attendance; else the first visible page (spec 08).
- `canGrant(granterSensitive, requested)`: a school admin cannot give a sensitive key they do not hold (spec 08).

**Tests:**
- table-driven for every system role;
- journey 50's expectation as a unit test: `finance` sees exactly Dashboard, Communications, Students (`view_only`), Fees & invoicing and Accounting, and Timetable is `hidden`;
- `roleHome` with `lms.create` and scope `school` does not give My teaching;
- property tests: `normaliseRow` is idempotent, and no output row has an action without View;
- a preview never adds a sensitive key the admin lacks.

**D32** (append under Access): `users.manage` from `settings.edit`; the `STAFF_PAGES` map; system role defaults (counsellor with `medical`); scope enforcement deferred to M3/M5.

Commit `feat(domain): permission matrix, effective permissions and staff page access`.

### Task 12: `@Can`, `@Module`, `@Sensitive`, suspended schools, `/me/permissions` and Preview a role

**Files:**
- Create:
  - `apps/api/src/common/guards/{can.guard.ts,can.decorator.ts,module.guard.ts,module.decorator.ts,sensitive.decorator.ts,preview-read-only.guard.ts,tenant-status.guard.ts}`;
  - `apps/api/src/modules/me/role-preview.{controller,service}.ts`;
  - `apps/api/src/common/access/permissions.service.ts` (loads roles and `current_tenant_profile()`, cached per request and in Redis for 30 s);
  - `apps/api/test/guards/{probe.module.ts,guards.api.test.ts}` (test-only probe routes: `@Can('fees.view')`, `@Can('fees.view', 'finance.view')`, `@Module('transport')`, `@Sensitive('safeguarding')`, a POST);
  - `apps/api/test/me/{permissions,role-preview}.api.test.ts`;
  - `apps/api/test/routes-guarded.test.ts`.

**Rules:**
- **Route walk.** Every route carries exactly one of `@Public`, `@PreAuth`, `@Authenticated`, `@Can` and `@PlatformRole`. A test walks the Nest router and the OpenAPI route list and fails on a route with none (or with any other marker). `@Authenticated` is allowed only on the routes listed in Task 6.
- `@Can(...keys)` means any-of; the decorator's doc comment says so.
- `@Module(m)` returns 403 `module_not_in_plan` when the plan lacks the module. The spec name stays: never import Nest's `Module` and ours in one file (a lint note in the decorator is enough).
- `TenantStatusGuard`: a tenant with status `suspended` returns 403 `school_suspended` with the suspend reason on every staff and parent route (spec 05), except `POST /auth/sign-out`.
- `@Sensitive(k)` requires `sensitive.k` and **always refuses support sessions** for safeguarding and medical. Each allowed view writes an audit event.
- While a preview is on, every non-GET returns 403 `preview_read_only`, except `DELETE /me/role-preview` and `/auth/sign-out`.
- Guard order: CSRF first, then preview read-only, so a write without `X-CSRF-Token` never reports `preview_read_only`.
- **Permission cache.** The Redis key is the tenant, the roles hash and `max(roles.updated_at)`; role and permission writes (Task 13) also delete the tenant's keys, so a change is never served stale.

**Endpoints (four tests each):**

| Route | Permission | Notes |
|---|---|---|
| `GET /me/permissions` → `{keys, pages, home, preview?}` | `@Authenticated` | Reflects an active preview (spec 06); `pages` from `pageAccess`; `home` from `roleHome(perms, primaryRoleScope)` |
| `POST /me/role-preview` `{roleId, sampleUserId?}` | `@Can('users.manage')` | The role and sample user must belong to the session's school (cross-tenant 404); a teacher preview needs a sample user; audit `role_preview.started` |
| `DELETE /me/role-preview` | `@Authenticated` (with a preview) | Audit `role_preview.ended` |

Steps:
- [x] **Step 1: Write the tests.**
  - Probe tests for 403 `forbidden`, `module_not_in_plan`, `school_suspended`, the support + safeguarding refusal (Accept) and `preview_read_only`; `@Can` with two keys passes on either.
  - `POST /auth/sign-out` works for a suspended school.
  - A preview POST without `X-CSRF-Token` gets the CSRF 403, not `preview_read_only`.
  - The preview cases moved here from Tasks 6 and 7: `GET /me` reflects an active preview; `PATCH /me` gives 403 `preview_read_only`; `POST /me/totp` is refused in preview.
  - A permission change through the role tables is visible on the next request (no stale cache).
  - The route-walk test; the endpoint tests.
- [x] **Step 2: Run them to see them fail.** Expected: FAIL.
- [x] **Step 3: Implement.** The probe module is imported only by tests, never by `AppModule`, so the OpenAPI document is unchanged.
- [x] **Step 4: Run the checks.** `pnpm --filter @quad/api test && pnpm --filter @quad/api test:api -- guards me && pnpm codegen:check`. Expected: PASS.
- [x] **Step 5: Commit.** `feat(api): permission, module, sensitive and preview guards with /me/permissions`.

**Acceptance:**
- Accept "Cross-tenant and wrong-role tests fail with 403/404".
- Accept "safeguarding routes refuse support sessions" (probe level; real safeguarding routes in M8 reuse `@Sensitive`).

### Task 13: Users & roles API (staff accounts, invites, roles) and the enquiry stub

**Files:**
- Create:
  - `apps/api/src/modules/users/{users.module.ts,users.controller.ts,users.service.ts,users.repository.ts,invites.service.ts,users.routes.ts}`;
  - `apps/api/src/modules/roles/{roles.controller.ts,roles.service.ts,roles.repository.ts,roles.routes.ts}`;
  - `apps/api/src/public/signed-links/invites.controller.ts`;
  - `apps/api/src/public/enquiry/{enquiry.controller.ts,enquiry.routes.ts}`;
  - `packages/contracts/src/{users,roles}/*.ts`, `packages/contracts/src/public/enquiry.ts`;
  - `apps/api/test/{users,roles,invites}/*.api.test.ts`, `apps/api/test/public/enquiry.api.test.ts`.
- Modify: `packages/contracts/src/common/errors.ts` (codes `last_admin`, `system_role_locked`, `already_member`), `packages/contracts/i18n/en.json`, `docs/spec/02-architecture.md` (D32 bullets).

**Cross-account work goes through the Task 3 definers**, never `withPlatform` and never a direct account-table query for another person:
- invite: `ensure_account_for_email`;
- two-step status in the list, the summary and Remind: `member_two_step_status`;
- deactivate and sign out everywhere: `revoke_member_sessions`, then drop those sessions from the Redis session cache;
- role and permission writes (`POST`/`PATCH`/`DELETE /roles`, `PUT /roles/:id/permissions`, a role change on `PATCH /users/:id`) delete the tenant's permission cache keys (Task 12).

**Permission cache and role integrity (Task 12 review, fix round 1):**
- Every role or permission write moves `roles.updated_at` and calls `PermissionsService.invalidateTenant`. Make the bump structural with a migration: a trigger that sets `roles.updated_at = clock_timestamp()` on every `roles` update, and statement-level triggers (one per event, with transition tables) on `role_permissions` and `role_sensitive` that bump the roles they touch. Test that a matrix write with no explicit bump is seen on the next request.
- Only staff memberships may hold roles: add a database check or trigger so a `user_roles` row can only name a `users` row with `kind = 'staff'` (Task 12 already ignores any other in `PermissionsService`). Test the refusal.
- A role change on `PATCH /users/:id` (and deactivation) clears that member's role preview (`sessions.preview_role_id` and `preview_sample_user_id`) in this school and drops the cached sessions (`invalidateMember`). Task 12 already ignores a preview once the member lacks `users.manage`; clearing it ends the read-only state too.

**Endpoints.** Each has four tests: happy; 400; 403 for a `teacher` session (wrong role) and `preview_read_only`; cross-tenant (B's user or role id gives 404, lists omit A). All are audited per spec 05 through `AuditService`. Business-rule refusals are 422 (spec 06 Conventions) with the codes below.

| Route | Permission | Behaviour and extra tests |
|---|---|---|
| `GET /users?status=&roleId=&q=&cursor=` → staff list with role, status, two-step status, last sign-in | `@Can('users.manage')` | Staff kind only; the story summary ("14 staff, 3 without two-step") |
| `POST /users/invite` `{emails[1..50], roleId}` | `@Can('users.manage')` | For each email: `ensure_account_for_email`; an existing membership gives `fields.emails[i]: already_member`; otherwise creates `users` (status `invited`) and `user_roles`, and queues the `staff_invite` link `quad-edu.com/sign-in/invite/{token}`. An existing account gets a membership, never a second account (spec 05) |
| `PATCH /users/:id` `{roleId?, status?: 'active'\|'deactivated'}` | `@Can('users.manage')` | You cannot change your own role or deactivate yourself (422); deactivation revokes that school's sessions and refresh families (spec 05, journey 19); the last active admin cannot be demoted (422 `last_admin`) |
| `POST /users/:id/remind-two-step` | `@Can('users.manage')` | Queues the reminder email; 409 when two-step is already on |
| `POST /users/:id/reset-password` | `@Can('users.manage')` | Queues a `password_reset` link with `tid` = this school |
| `POST /users/:id/sign-out-everywhere` | `@Can('users.manage')` | Revokes the account's sessions in **this school** (OQ10); the member's sessions in another school survive |
| `POST /users/:id/resend-invite` (new; prototype "Resend invite") | `@Can('users.manage')` | A new token; only for `invited` |
| `GET /auth/invites/:token` → `{school, name, emailMasked, needsPassword}` | `@Public` (signed `staff_invite`) | `invalid_link` cases (journey 43) |
| `POST /auth/invites/:token/accept` `{password?}` | `@Public` (signed), with a session check for existing accounts | New account: sets the password (policy and breach check), then the session goes to `two_step_setup` if the school requires it (OQ9, accepted: the one case besides the support session where a token leads to a session). Existing account: needs a signed-in session for that account (spec 05); activates the membership |
| `GET /roles` → roles with member count, pages count and home | `@Can('users.manage', 'settings.view')` (any-of) | Feeds the Preview card |
| `POST /roles` `{name, description, color, scope, baseRoleKey}` | `@Can('users.manage')` | Copies the base role's matrix |
| `PATCH /roles/:id` / `DELETE /roles/:id` | `@Can('users.manage')` | System roles give 422 `system_role_locked`; deleting an assigned role gives 409 `in_use` |
| `PUT /roles/:id/permissions` `{matrix, sensitive[]}` | `@Can('users.manage')` | Normalised with `normaliseRow`; a module outside the plan gives 422 `module_not_in_plan`; a sensitive key the admin lacks gives 403 (spec 08) |

**Enquiry stub** (a separate step and commit in this task):
- `POST /public/enquiry/:embedKey` in `apps/api/src/public/enquiry/`, `@Public`, rate-limited to 20 per minute per IP, listed in `src/openapi/document.ts`, then `pnpm api:client`.
- It calls `tenant_by_embed_key` (a stub until M4), so every key is unknown: 404 `not_found`. M4 completes it; the captcha (spec 06) arrives in M4.
- Tests: 404 for an unknown (forged) key; 400 `validation` for a bad body; 429 after 20 per minute.

**D32** (append): Signed links: a new invitee's first password set on the invite page leads to a session (OQ9), the one exception besides the support session to "a token never grants a session by itself"; the enquiry stub route, with the captcha in M4.

Steps: test first, implement, `pnpm api:client`, append the D32 bullets, then `pnpm --filter @quad/api test:api -- users roles invites && pnpm codegen:check`. Commit `feat(users): staff accounts, invites and roles for Users & roles`. Then the enquiry stub: test first, implement, `pnpm api:client`, `pnpm --filter @quad/api test:api -- public && pnpm codegen:check`. Commit `feat(public): enquiry stub route on tenant_by_embed_key`.

### Task 14: School settings API (General, Sign-in read-only)

**Files:**
- Create:
  - `apps/api/src/modules/school/{school.module.ts,school.controller.ts,school.service.ts,school.repository.ts,school.routes.ts}`;
  - `packages/contracts/src/school/*.ts`;
  - `packages/domain/src/settings/settings-summary.ts` with tests;
  - `apps/api/test/school/*.api.test.ts`.

**Endpoints (four tests each):**
- `GET /school` [`@Can('settings.view')`] → `{ name, shortName, officeEmail, officePhone, address, timeZone (read-only), smsSenderId, smsSenderStatus, branding: {color, logoUrl} (read-only), signIn: {twoStep, passwordMinLength, sessionHours, ipAllowlist} (read-only: "Managed by Quad"), summary }`.
- `PATCH /school` [`@Can('settings.edit')`] `{name?, officeEmail?, officePhone?, address?, smsSenderId?}`:
  - the name goes through `update_current_tenant_name`;
  - time zone, logo, colour and sign-in rules are not accepted (08 wins over 06; OQ19);
  - takes `If-Match`, and a stale `etag` gives 409;
  - each change writes the `settings.updated` audit with before and after.
- `GET /school/branding` [`@Authenticated`]: read-only.
- `GET /settings` [`@Can('settings.view')`]: the `school_settings` row, read-only in M1. Spec 08 (`settings.view` to see) wins over spec 06's `[settings.edit]`; Task 28 edits spec 06. `PATCH /settings` arrives with each tab's feature (OQ19).
- `settingsSummary(settings, profile)` returns codes for the summary sentence, for example "Ask Quad is on. Quiet hours are 18:00–07:00 and weekends." Online payments is omitted until M7.

Commit `feat(school): school settings General and read-only sign-in rules`.

## Phase 5: Audit and support

### Task 15: Settings → Audit API and platform audit (read side)

`AuditService`, `PlatformAuditService` and the action keys already exist (Task 6). This task adds the read side.

**Files:**
- Create:
  - `apps/api/src/modules/audit/{audit.controller.ts,audit.repository.ts,audit.routes.ts}`;
  - `apps/api/src/platform/audit/platform-audit.controller.ts` (`@PlatformController()`);
  - `apps/api/src/common/export/csv.ts`;
  - `packages/contracts/src/audit/*.ts` (the read schemas);
  - `apps/api/test/audit/{audit,platform-audit}.api.test.ts`.

**Endpoints (four tests each):**
- `GET /audit?actor=&action=&from=&to=&cursor=` [`@Can('settings.view')`]:
  - `Accept: text/csv` needs `sensitive.export_data`, and the export itself is audited (`audit.exported`);
  - the response is a readable `summary` per row plus `meta`, with `viaSupport` set for support rows (08: "Support sessions from Quad are marked").
- `GET /platform/audit?actor=&tenantId=&action=&from=&to=` [`@PlatformRole()` any], with CSV (spec 07).

**Extra tests:**
- B's audit rows never appear for A;
- CSV without `export_data` gives 403.

(The `audit_log` UPDATE/DELETE trigger test is Task 2's.)

Commit `feat(audit): school and platform audit logs with filtered views and CSV export`.

### Task 16: Support sessions ("Open as school admin")

**Files:**
- Create:
  - `apps/api/src/platform/support/{support.controller.ts,support.service.ts}` (`@PlatformController()`);
  - `apps/api/src/platform/tenants/{tenants.controller.ts,tenants.service.ts}` (`@PlatformController()`; minimal `GET /platform/tenants` for the console list: id, name, short name, status, colour; M2 extends it);
  - `apps/api/src/public/signed-links/support-session.controller.ts`;
  - `apps/api/test/support/*.api.test.ts`.
- Modify: `docs/spec/02-architecture.md` (D32 bullet).

**Flow:**
1. `POST /platform/tenants/:id/support-session` `{reason (10–500 chars, required)}`:
   - needs the `support`, `admin` or `owner` platform role;
   - creates `support_sessions` (`expires_at` = now + 60 min) with `withPlatform`, and no `sessions` row (R-support-token: the redeemed cookie's hash lives on `support_sessions.token_hash`);
   - writes `platform_audit`;
   - returns `{ url: PUBLIC_WEB_URL + '/sign-in/support/' + token }` (purpose `support_session`, 2 min, single use; spec 05).
2. `POST /auth/support-session` `{token}` (new route, `src/public/signed-links`, `@Public` signed): verifies and consumes the token, generates the cookie token, calls `redeem_support_session(supportSessionId, sha256(cookie))`, sets the staff cookie for that session, and audits `support_session.started` in the school. No `withPlatform` here.
3. In the school, `/me` returns `support: {schoolName, platformUserName}` for the banner; permissions follow `effectivePermissions({ support })`. The `AuthGuard` accepts the session while `session_by_token` returns it (Task 6).
4. `POST /auth/support-session/end` ("Exit to platform"; `@Public`, authenticated by its own cookie): calls `end_support_session(sha256(cookie))`, which ends both rows and writes `platform_audit`; audits `support_session.ended` in the school; returns `{ redirect: CONSOLE_URL }`. The session hard-expires at 60 minutes.

Steps 2 and 4 follow ruling R-support-token (Task 3): the support cookie is resolved through `support_sessions.token_hash` by `session_by_token`; no `sessions` row is written for a support session, and AuthGuard validates it against `support_sessions` (active, same tenant).

**Tests:**
- a missing or short reason gives 400;
- a `billing` or `readonly` role gives 403;
- an unknown tenant gives 404;
- the link works once (a second use gives `invalid_link`);
- an expired link (fake clock + 2 min) is refused;
- a forged link gives `invalid_link`;
- every write in support produces one `audit_log` and one `platform_audit` row;
- the support + `@Sensitive('medical')` probe gives 403;
- after 60 minutes, 401; after Exit to platform, 401;
- a support session for A cannot read B (404).

**D32** (append under Signed links): `POST /auth/support-session` as the support redemption entry point (a D16 row), through `redeem_support_session` and `end_support_session`.

Commit `feat(support): reasoned, time-limited support sessions with dual audit`.

**Acceptance:** Accept "The support banner shows in support view; safeguarding routes refuse support sessions" (API side).

## Phase 6: Seeds and the end-to-end stack

The Playwright specs in Tasks 19–23 and the journeys in Task 26 need seeded accounts and a live API, so both come first.

### Task 17: Seed the M1 accounts and access data

**Files:**
- Modify:
  - `packages/db/src/{seed-data.ts,seed.ts}`;
  - `packages/db/src/env.ts` and `packages/db/src/env.test.ts` (the D27 follow-up: extend `loadRootEnv` into the one gated `.env` loader, local only, as `loadLocalEnvFile` does today; no new file);
  - `apps/api/src/boot.ts` (import that loader instead of its own `loadLocalEnvFile`);
  - `packages/db/test/seed.test.ts`;
  - `packages/db/test/factories.ts`.

**Seed (deterministic, written as `quad_owner`; D24):**
- `quad_owner` is `NOBYPASSRLS` and FORCE RLS filters it, so inside the seed transaction the seed runs `set_config('app.tenant_id', <school>, true)` before each school's tenant rows and `set_config('app.account_id', <account>, true)` before each account's rows.
- **Platform:**
  - `owner@quad.local` (owner; password from `SEED_PASSWORD`; TOTP on; local code `000000`);
  - `support@quad.local` (support role, for the support journey; password from `SEED_PASSWORD`, TOTP on).
- **Colombo International School:**
  - branding `#DD4A42`;
  - all modules;
  - security: `two_step: staff`;
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
- Prishan, Nadeesha, Ruwan and Dilini have `credentials.totp_enabled = true` with a secret encrypted by `FieldCipher` from `@quad/db` (Task 4, R-fieldcipher), so `DEV_FIXED_OTP=000000` passes their two-step step (journey 17) instead of sending them to setup.
- `SEED_TENANTS` gains fixed ids for the people, exported as `SEED_PEOPLE`.

**Tests:**
- re-seeding is idempotent;
- `auth_memberships(ruwan)` returns both schools;
- each seeded password verifies against `SEED_PASSWORD`;
- the four seeded staff have `totp_enabled` and a secret that decrypts;
- the seed refuses to run without `SEED_PASSWORD`, and refuses the placeholder outside `local`;
- the gated loader ignores `.env` when `APP_ENV` is `staging`.

Commit `feat(db): seed platform users, school access settings, roles and the sample people`.

### Task 18: The end-to-end stack

**Files:**
- Create:
  - `scripts/e2e-stack.mjs`:
    - takes a port parameter (default `:4000`);
    - creates a fresh database `quad_e2e_<pid>` as admin;
    - migrates and seeds it (Task 17);
    - starts `apps/api/dist/main.js` and `dist/worker.js` on that port with that `DATABASE_URL`, Mailpit SMTP, `APP_ENV=local` and `DEV_FIXED_OTP=000000` (no fake-clock variable: expired tokens come from a test helper that signs a past `exp`);
    - waits for `/health/ready`;
    - drops the database on exit;
    - has its own test (`scripts/test/e2e-stack.test.ts`);
  - `packages/config/playwright/{stack.ts,mailpit.ts}` (the stack fixture with the port parameter, and the Mailpit API helper);
  - `packages/config/playwright/signed-token.ts` (the helper that signs a token with a past `exp` or a wrong purpose for journey 43).
- Modify:
  - `packages/config/playwright/preset.ts` (`webServer` becomes `[stack, next start]` when a spec needs the API);
  - `scripts/check-services.mjs` (Mailpit SMTP when `SMTP_URL` is set);
  - `.github/workflows/ci.yml` `e2e-smoke` (postgres, redis and mailpit service containers, the same as `api-integration`);
  - `scripts/test/workflows.test.ts`;
  - `docs/spec/02-architecture.md` (D32 bullet).

**Tests:**
- the stack test: it starts on a given port, answers `/health/ready`, and drops its database on exit;
- two stacks on `:4000` and `:4001` run side by side with separate databases;
- `workflows.test.ts` asserts the `e2e-smoke` service containers.

**D32** (append under Testing): the e2e stack (fresh database per run, a port parameter, API, worker, fake issuer, Mailpit) and the CI `e2e-smoke` services.

Commit `test(e2e): a real API stack for Playwright with a fresh database per run`.

## Phase 7: Staff screens

All tasks in this phase follow `quad-web-screen`, with the prototype open side by side. Every screen has Playwright screenshots at 1440×900 and 390×844 in light and dark, saved to `docs/screenshots/m1/` in Task 27, and an axe check. Their Playwright specs run against the Task 18 stack with the Task 17 seed.

### Task 19: `/sign-in` and the signed-link pages

**Prototype:** `design/admin.html` `authRender` / `schoolAuth` (art panel and card), restructured identifier-first (spec wins, OQ15), with no Google or Microsoft buttons (D37). Copy comes from the prototype where the spec is silent: "Sign in to Quad", "One sign-in for every school on Quad…", "Two-step sign-in", "Trust this device for 30 days", "Use a recovery code", "Reset your password", "Check your inbox", "Choose a school", "Remember my choice on this device".

**Files:**
- Create:
  - `apps/staff/src/app/(auth)/layout.tsx` (app tokens, `QueryClientProvider`, Quad-branded art panel);
  - `apps/staff/src/app/(auth)/sign-in/page.tsx` and `_components/{EmailStep,PasswordStep,TwoStepStep,TwoStepSetup,RecoveryCodes,ChooseSchool,NoSchool,ForgotStep,CheckInbox,AuthCard}.tsx`;
  - `packages/ui/src/components/OtpBoxes.tsx` with its test (shared: the console uses it in Task 23);
  - `(auth)/sign-in/reset/[token]/page.tsx`, `(auth)/sign-in/invite/[token]/page.tsx`, `(auth)/sign-in/support/[token]/page.tsx`;
  - `apps/staff/src/lib/{api.ts,session.ts}`;
  - `apps/staff/test/build-export.test.ts` (inside the Vitest include);
  - `apps/staff/e2e/sign-in.spec.ts`.
- Modify:
  - `apps/staff/package.json` (`@quad/client` and `@tanstack/react-query`, spec 02);
  - `apps/staff/src/middleware.ts` (`/app/**` without the cookie redirects 307 to `/sign-in?next=`; the token pages get `Referrer-Policy: no-referrer` and `X-Robots-Tag: noindex`);
  - `apps/staff/scripts/build-export.mjs` (refuse `sign-in`);
  - `apps/staff/e2e/landing.spec.ts` (in the `export-*` projects only: `/sign-in` returns 404, and the selector becomes `a[href^="/sign-in"]`);
  - `packages/contracts/i18n/en.json`;
  - `docs/spec/02-architecture.md` (D32 bullets).

**Behaviour:**
- Work email, then password, then two-step (or setup with QR and 10 recovery codes), then Choose a school (logo or monogram, name, "your role"; none gives the spec 05 message), then "Opening {school}…", then `next` or `/app`.
- Errors come from `{code, fields}`, with no account hints.
- The lockout copy names the 15 minutes.
- `quad_last_school` shows "Welcome back to {school}" without preselecting anything (spec 05).
- The OTP boxes auto-advance, accept paste and set `autocomplete="one-time-code"`.

**Tests:**
- component tests for the step machine and `OtpBoxes` paste;
- Playwright:
  - email, then password, then `000000`, lands in `/app`;
  - no Google or Microsoft button appears (D37);
  - a wrong password shows the error;
  - forgot shows "Check your inbox";
  - a tampered reset link shows "This link isn't valid any more" with no school name;
  - 390 px with no horizontal scroll;
  - axe clean;
- `checkExport` refuses an out folder containing `sign-in`;
- the `export-*` projects: `/sign-in` is a 404 and no `a[href^="/sign-in"]` exists;
- `src/app/layout.tsx` imports nothing from `(auth)`, `@/lib/session` or `@quad/client` (the pre-launch guard).

**D32** (append): Signed links: web paths `/sign-in/{reset,invite,support}/{token}` with `no-referrer` and `noindex`. Pre-launch: `/sign-in` and `/app` stay out of the static export, and `checkExport` enforces it. Pinned `qrcode`, `@tanstack/react-query` versions.

Commit `feat(staff): identifier-first sign-in page and signed-link pages`.

### Task 20: The portal shell: session, branding, permission-filtered navigation, switch school, banners

**Prototype:** `design/admin.html`: the rail, top bar, `.me` profile menu with `swSchool`, `#supportBar`, `#rvBar`, `#rvPick`, `rvDenied`.

**Files:**
- Modify:
  - `apps/staff/src/app/app/layout.tsx` (server: `GET /me` and `/me/permissions` through `API_INTERNAL_URL`, OQ16; a 401 redirects to `/sign-in?next=`);
  - `docs/spec/02-architecture.md` (the variables table: `API_INTERNAL_URL`), `.env.example` (same order) and `apps/api/src/config.ts` (`NOT_READ_BY_THE_API`), all in this commit;
  - `apps/staff/src/components/shell/StaffShell.tsx` (navigation from `STAFF_PAGES` and `pages`; brand CSS variables `--brand`, `--brand-fill` and `--brand-ink` set as inline CSS variables from the API's computed palette, with `--brand-fill` taking `fill` in light and `fillDark` in dark; no raw hex in classes);
  - `apps/staff/src/app/app/page.tsx` (the greeting from `/me`);
  - `packages/ui/src/shell/{AppShell,Topbar,Sidebar}.tsx` (a `banner` slot, a profile menu with Switch school and Sign out, and a desktop `actions` slot for **View as**);
  - `apps/staff/e2e/screenshots.spec.ts` (sign in through the stack before opening `/app`).
- Delete:
  - `apps/staff/src/lib/placeholders.ts`;
  - `apps/staff/e2e/shell.spec.ts` (folded into `shell-auth.spec.ts`).
- Create:
  - `apps/staff/src/app/app/[...page]/page.tsx` (placeholder pages for unbuilt navigation items: "{Page} arrives soon", or the no-access page per `pages`);
  - `apps/staff/src/components/shell/{SupportBanner,PreviewBanner,ViewAsPicker,SwitchSchoolMenu,NoAccess,ViewOnlyTag}.tsx`;
  - `apps/staff/e2e/shell-auth.spec.ts` (signed in via the stack; takes over the `shell.spec.ts` cases, plus the signed-out redirect to `/sign-in?next=/app`).

**Behaviour:**
- Items are hidden by `pageAccess` and plan modules.
- Switch school calls `POST /auth/select-school` and reloads `/app` (spec 05).
- While a role preview is on, Switch school is a write and the API refuses it (`preview_read_only`, Task 12), so the profile menu offers **Back to my view** first (it calls `DELETE /me/role-preview`) and only then Switch school.
- Sign out goes to `/sign-in`.
- The support banner shows the spec 05 copy, is fixed, uses `role="status"`, and has **Exit to platform**.
- The preview banner reads "Previewing as {role} · {sample person}" with **Back to my view** (spec 08).
- The no-access page reads "{Page} isn't part of the {role} role" with a link to the role's home.
- **View only** tags hide action buttons.

**D27 follow-ups:** RTL unit tests for `Kpi`, `Pill`, `Tabs`, `Checkbox`, `Field` and `Textarea`, and a WebKit Playwright project for drawer focus (Secure cookies on WebKit localhost are why local cookies have no `Secure`, D32).

**D32** (append under Configuration): `API_INTERNAL_URL` (staff and console server components; not read by the API).

Commit `feat(staff): signed-in shell with school branding, role-aware navigation and banners`.

### Task 21: Settings → Users & roles

**Prototype:** `design/admin.html` `V.users`: the People and Roles & permissions tabs, `rvCard()`, the invite drawer, row actions.

**Files:**
- Create:
  - `apps/staff/src/app/app/settings/users/page.tsx` and `_components/{PeopleTable,RoleSelect,RowActions,PreviewRoleCard,RolesList,SensitiveSwitches,SaveBar}.tsx`;
  - `_drawers/{InviteStaffDrawer,ConfirmDeactivateDrawer}.tsx`;
  - `apps/staff/src/app/app/settings/users/roles/new/page.tsx` (the New role page);
  - `packages/ui/src/components/PermissionMatrix.tsx` (the only `PermissionMatrix`; shared with the console in M2);
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

### Task 22: School settings (General, Sign-in) and the Audit tab

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

## Phase 8: Console screens

### Task 23: Console sign-in, signed-in shell, Open as school admin, Audit log

**Prototype:** `design/platform.html` `platformAuth`, `V.tenants` (the "Open as school admin" button), `V.audit`. Spec wins: a reason is always required (D22).

**Files:**
- Create:
  - `apps/console/src/app/sign-in/page.tsx` (email and password, with no Google Workspace button (D37); then TOTP or setup, with `OtpBoxes` from `packages/ui`);
  - `apps/console/src/app/(console)/schools/page.tsx` (a minimal list from `GET /platform/tenants`);
  - `_drawers/OpenAsSchoolAdminDrawer.tsx` (a required reason with a hint, a button "Open {school} as school admin", which opens the returned URL);
  - `apps/console/src/app/(console)/audit/page.tsx` (filters, table, CSV);
  - `apps/console/e2e/{sign-in,support,audit}.spec.ts`.
- Modify:
  - `apps/console/src/middleware.ts` (it exists: robots only; no redirect on the console cookie, see Session gating below);
  - `apps/console/package.json` (`@quad/client` and `@tanstack/react-query`);
  - `apps/console/src/components/shell/ConsoleShell.tsx` (the real user and role, Sign out).
- Delete: `apps/console/src/lib/placeholders.ts`.

**Session gating (D32, Task 10 fix round 2):** the console cookies are `SameSite=Strict`, so the first request of a deep link arrives without them. Gate the signed-in pages on the client: after the page loads, call `GET /platform/me` and send a 401 to `/sign-in?next=…`. `middleware.ts` and server components must not decide on the console cookie (the middleware keeps only robots); a test opens a deep link in a new context with a signed-in session and lands on the page, not on sign-in.

Commit `feat(console): console sign-in, support entry with a reason, and the platform audit log`.

## Phase 9: Parent app (Flutter)

### Task 24: Auth core: secure storage, token interceptor, auth state and router guard

Follow `quad-flutter-screen`.

**Files:**
- Create:
  - `apps/parent/lib/core/{secure_store.dart,auth/auth_controller.dart,auth/token_interceptor.dart,auth/auth_state.dart,lock/lock_controller.dart}`;
  - tests in `apps/parent/test/core/auth/*`.
- Modify:
  - `apps/parent/pubspec.yaml` (`flutter_secure_storage`, `local_auth`);
  - `lib/core/api.dart` (the interceptor);
  - `lib/router.dart` (a redirect to `/welcome` when signed out and to `/lock` when locked);
  - Android `MainActivity` (`FlutterFragmentActivity` for `local_auth`) and `Info.plist` (`NSFaceIDUsageDescription`);
  - `docs/spec/02-architecture.md` (D32: pinned plugin versions).

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

### Task 25: Sign-in screens, biometric unlock, Switch school and Sign out

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
- **Switch school** clears the previous school's cached rows before the new school's token is used (spec 09).

**Tests:**
- widget tests for the loading, empty, error and data states of each screen, with a mocked `quad_api` and a fake `LocalAuthentication`;
- Switch school leaves no cached row of the previous school;
- goldens for welcome, phone, code, found you and lock at 390×844, light and dark, text scale 1.0 and 2.0;
- `integration_test/sign_in_test.dart` against the local API (runs in the nightly `e2e:mobile`, not here).

Run `fvm flutter analyze` (or `flutter` per D26), `dart format --set-exit-if-changed .` and `flutter test`. Commit `feat(parent): OTP sign-in, school picker, biometric lock, switch school and sign out`.

**Acceptance:** Accept "Sign in works in all three apps" (the parent part, with widget and integration tests; the device run is in CI nightly).

## Phase 10: Journeys

### Task 26: Journeys 17, 18, 19, 42, 43, 50

They run against the Task 18 stack and the Task 17 seed.

**Files:**
- Create:
  - `apps/staff/e2e/journeys/{j17-sign-in-one-school,j18-two-schools,j19-invite,j43-signed-links,j50-preview-role}.spec.ts`;
  - `apps/console/e2e/journeys/j42-console-sign-in.spec.ts`.

**Journeys** (spec 17, wording as there; Chromium at 1440 and 390, light and dark; axe on each page):
- **17:** from `/` (non-prelaunch build), the landing's **Sign in** goes to `/app`, then `/sign-in`. Prishan's email, password and `000000` land in `/app` with CIS's name and the brand variable `--brand` = `#DD4A42`.
- **18:** Ruwan sees **Choose a school** with both schools and his role in each, picks KHA, and sees KHA's branding. The profile menu's **Switch school** opens CIS, and the session cookie value changes (rotation).
- **19:**
  - the admin invites `new.teacher+<run>@colombo-intl.local` as Teacher, and the email arrives in Mailpit;
  - the link sets a password and two-step (QR secret read from the page, code `000000`);
  - the teacher signs in with the Teacher menu;
  - the admin changes the role to Front desk, and after reload the teacher's menu changes;
  - deactivating the teacher makes their next request redirect to `/sign-in`.
- **42:**
  - `owner@quad.local` signs in with email, password and `000000`, and the page has no Google or Microsoft button (D37);
  - a wrong TOTP code is refused;
  - `someone@gmail.com`, which is not a platform user, gets the same message as a wrong password.
- **43 (M1 part):**
  - a reset link from Mailpit works once and is refused the second time;
  - forged, expired (a token signed with a past `exp` by the `signed-token.ts` helper), wrong-purpose and tampered tokens are refused, and the page shows no school name;
  - `POST /api/v1/public/enquiry/unknown-key` gives 404 (the Task 13 stub route);
  - the webhook steps are marked `test.fixme` with `M7`. That is not `.skip`: the list in spec 17 says "webhooks from M7".
- **50:**
  - Prishan previews Finance officer;
  - the menu shows exactly Dashboard, Communications, Students, Fees & invoicing and Accounting;
  - Students shows **View only**;
  - `/app/timetable` shows the no-access page;
  - a write (`PATCH /api/v1/me` from the page context, sending `X-CSRF-Token` from the `quad_csrf` cookie) gives 403 `preview_read_only`;
  - **Back to my view** restores the menu;
  - Settings → Audit lists `role_preview.started` and `role_preview.ended`.
- **Support banner (Accept):** in a console journey step, the support user opens CIS with a reason; the staff portal shows the banner; **Exit to platform** returns to the console.

Commit `test(e2e): sign-in, invite, console, signed-link and role-preview journeys with a real API stack`.

## Phase 11: Verify and screenshots

### Task 27: Gate, screenshots and review

Steps:
- [x] **Step 1: Run the gates.** `pnpm verify && pnpm build`, then `NEXT_PUBLIC_QUAD_PRELAUNCH=true pnpm --filter @quad/staff build:export && pnpm --filter @quad/staff e2e:export`. Expected: all PASS.
- [x] **Step 2: Take the screenshots** at 1440×900 and 390×844, light and dark, into `docs/screenshots/m1/`:
  - `/sign-in` (each step);
  - Choose a school;
  - `/app` with CIS and with KHA branding;
  - the support banner and the preview banner;
  - the no-access page;
  - Users & roles (People, Roles, invite drawer, New role);
  - School settings (General, Sign-in, Audit);
  - the console sign-in, Schools with the reason drawer, and the Audit log.

  Compare each with the prototype at the same size and fix visible differences.
- [x] **Step 3: Check the parent app.** The Flutter goldens are reviewed, plus a simulator screenshot when one is available (otherwise noted as a gap).
- [x] **Step 4: Compare the export.** The export's landing at 1440 and 390, light and dark, matches `docs/screenshots/landing/` (no M1 change).
- [x] **Step 5: Review.** Run `quad-review`, `/code-review` and `/security-review` on the whole M1 diff, and fix the findings.
- [x] **Step 6: Commit.** `docs(screenshots): M1 sign-in, portal, settings and console screens`.

## Phase 12: Docs

### Task 28: Decision log, spec edits, README and progress

**Modify:**
- `docs/spec/02-architecture.md`:
  - D32: finalise the row that Tasks 1–26 built (check every item in "Proposed decision-log row" below is present; add only what is missing);
  - the D16 table row for the support session redemption (`redeem_support_session`, `end_support_session`);
  - 02:137 (the `auth_memberships` columns `short_name`, `user_id`, `suspended`, `suspend_reason`, and the tenant status set including `suspended`);
  - 02:276 (`FIELD_ENCRYPTION_KEY` required until M12): Task 4 already made this edit; confirm it.
  - The variables table needs nothing here: `API_INTERNAL_URL` came with Task 20, and the SSO variables leave with the D37 removal.
- `docs/spec/04-data-model.md`:
  - account tables and RLS;
  - the new columns (`accounts.locked_until`, `credentials.password_changed_at`, `sessions.*`, `platform_users.password_hash` and `totp_enabled`, `support_sessions.expires_at`, `school_settings.address` and `sms_sender_status`, `audit_log.support_session_id`);
  - 04:56: `sessions.token_hash`, `stage`, `keep_signed_in`, `refresh_generation`, `preview_role_id`, `preview_sample_user_id` and `support_session_id`, in place of `refresh_hash`;
  - 04:58: `otp_challenges.subject_hash` and `channel` (HMAC-keyed);
  - 04:279: the same `auth_memberships` columns and status set as 02:137;
  - `trusted_devices`;
  - the new definer functions and the `definer_read` policy.
- `docs/spec/05-auth-tenancy-rbac.md`:
  - `users.manage`; the page-access rule; staff invite TTL; `password_reset` with `tid` null;
  - 05:34: the country list is LK (+94) only for now (OQ12);
  - 05:56: "A token never grants a session by itself", except the support session and a new invitee's first password set (OQ9).
- `docs/spec/06-api-and-events.md`:
  - `POST /auth/support-session`, `POST /auth/support-session/end`, `POST /users/:id/resend-invite`;
  - the `/platform/auth/*` and `/platform/me` lines;
  - `GET /platform/tenants` minimal;
  - the new error codes;
  - 06:24: invite acceptance for a new account without a prior sign-in (OQ9), and the invite response `{school, name, emailMasked, needsPassword}`;
  - 06:60: `GET /settings` needs `settings.view` (spec 08 wins).
- `docs/spec/08-staff-portal.md`: the School settings tab list for M1 (Sign-in shown as a read-only tab).
- `docs/spec/17-testing-quality.md`: journey 17 starts "from the landing's **Sign in** (via `/app` → `/sign-in`) until M1b's dialog".
- `docs/spec/19-public-site.md` 19:7: `/sign-in` lives in the `(auth)` route group with app tokens, not `(public)` (OQ15).
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
- The prototype asks for email and password on one form. Spec 05 is identifier-first. (The prototype's SSO buttons were removed by D37.)
- The prototype's "Open as school admin" and "Sign in as" take no reason. D22 and spec 05 always need one.
- The prototype's parent welcome is school-branded. D13 makes it Quad-branded.
- Journey 17 says "opens Sign in on the landing page". In M1 that is the non-prelaunch link to `/app`, then `/sign-in`, and the dialog arrives in M1b.

## Proposed decision-log row

**D32 (2026-10-08). Auth, tenancy and permissions (M1).** One row in the D28 style. Task 1 creates it; the task named in brackets appends each item; Task 28 finalises:
- **Tables and lookups:**
  - account tables with RLS on `app.account_id` (key `id` on `accounts`) and `withAccount` (OQ1) [1];
  - `otp_challenges` as the only open table, with HMAC-keyed `code_hash` and `subject_hash` [1];
  - the account and open table classes in `findTenancyViolations` [1];
  - migration order `0003_platform_access`, `0004_accounts` [1];
  - new columns and `trusted_devices` [1];
  - new definers `account_by_identifier`, `session_by_token`, `sso_methods_for_domain`, `auth_sign_in_rules`, `current_tenant_profile`, `update_current_tenant_name`, `consume_signed_token`, `record_support_audit`, `ensure_account_for_email`, `member_two_step_status`, `revoke_member_sessions`, `redeem_support_session` and `end_support_session`, and the two D16 stubs [3];
  - `definer_read` (`FOR SELECT TO quad_owner USING (true)` on exactly `accounts`, `sessions`, `users`, `user_roles` and `roles`) as an amendment of D24's "no other permissive policy" [3];
  - `auth_memberships` returns suspended schools and `short_name`, `user_id`, `suspended`, `suspend_reason` [3].
- **Signed links:** the payload format and `SIGNED_LINK_RULES` TTLs; `tid` null for account-level `password_reset` [4]; a new invitee's first password set leads to a session (OQ9) [13]; web paths `/sign-in/{reset,invite,support}/{token}` with `no-referrer` and `noindex` [19]; `POST /auth/support-session` as the support redemption entry point (D16 row) [16].
- **Sessions:**
  - opaque 32-byte cookie, SHA-256 in the database, Redis cache for 30 s [6];
  - `__Host-` names, but `quad_sid` and `quad_console_sid` without `Secure` when `APP_ENV=local` [6];
  - double-submit CSRF in `__Host-quad_csrf` (`quad_csrf` locally) [6];
  - `stage` on the session row for the sign-in steps [6];
  - lockout failures in the Redis sorted set `lockout:{accountId}` [7];
  - parent JWT EdDSA, 15 min; relative tokens reach only refresh and sign-out in M1 [9];
  - refresh `{sid}.{generation}.{secret}`, a 60-day family, revoked on reuse [9].
- **Crypto:**
  - Argon2id through `@node-rs/argon2` (`m=19456, t=2, p=1`) [4];
  - `FieldCipher` AES-256-GCM with HKDF from `FIELD_ENCRYPTION_KEY`, required in every environment until M12's KMS adapter replaces it [4];
  - JWT and field keys required from M1, with local-only placeholders [4];
  - the breach-check failure mode [4].
- **Access:**
  - the `@Authenticated()` marker for `/me*`, `/auth/sign-out`, `/auth/select-school` and `/school/branding`; `@PlatformController()` [6];
  - `users.manage` from `settings.edit` [11];
  - the `STAFF_PAGES` map [11];
  - system role defaults (counsellor with `medical`) [11];
  - scope enforcement deferred to M3/M5 [11];
  - the API computes the school brand palette with `@quad/tokens` `deriveBrand` (a new allowed `apps/api` → `@quad/tokens` import, colour maths only) [6].
- **Configuration:** `OIDC_FAKE_ISSUER_URL` (local only) [8; removed by D37]; `API_INTERNAL_URL` [20]; the enquiry stub, with the captcha in M4 [13]; pinned dependency versions [each installing task].
- **Testing:** the e2e stack (fresh database per run, a port parameter, API, worker, Mailpit) and the CI `e2e-smoke` services [18].
- **Pre-launch:** `/sign-in` and `/app` stay out of the static export; `checkExport` enforces it [19].

## Risks and size

**Size**
- 28 tasks, the largest milestone so far. It touches every layer, 4 migrations and about 45 endpoints.
- Candidates to move to M2 if it runs long, in this order: the staff New role page, the console Audit log page, `GET /me/sessions`.

**Cannot run offline here**
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
- **Pre-launch regression.** Any change to `src/app/layout.tsx`, `(public)/**` or shared `@quad/ui` pieces the landing imports reaches `quad-edu.com` on the next merge to `main`. Task 19's guard test and Task 27's export comparison cover it.
- **Support-session definer writes (resolved by R-support-token).** Built in Task 3: the support cookie hash lives on `support_sessions.token_hash`; no null-account `sessions` row exists.

**Carried to M12 (hardening)**
- **Batch the two-step status lookup** (Task 13 review, M10). `GET /users` asks `member_two_step_status` for the page and every active member, and the definer runs one `with_account_scope` call per member. That is fine at school sizes, but M12's performance pass should batch it, for example with a set-based definer or a cached count for the summary.
