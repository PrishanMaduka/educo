# M0 Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A fresh clone of Quad installs, starts its local services, runs an API, two web shells and a Flutter shell, and passes `pnpm verify`. The tenancy guard rails (database roles, FORCE RLS, `withTenant`/`withPlatform`, lint bans) are in place before any feature exists.

**Architecture:** This is a pnpm + Turborepo monorepo. Shared packages are `config`, `contracts`, `domain`, `db`, `tokens`, `ui` and `client`. The apps are `api` (NestJS 11 on Fastify), `staff` and `console` (Next.js 15 + Tailwind v4) and `parent` (Flutter). The token, i18n and API-client generators feed both web and Flutter from one source.

**Tech Stack:**
- Language and runtime: Node 22, pnpm 9.15.9, Turborepo 2, TypeScript 5 strict.
- API and data: NestJS 11 + `@nestjs/platform-fastify`, Zod 3, Drizzle ORM + drizzle-kit, PostgreSQL 16, Redis 7, Pino, OpenTelemetry.
- Web: Next.js 15 / React 19, Tailwind CSS v4, Radix UI, class-variance-authority, tailwind-merge, i18next.
- Tests: Vitest, Testcontainers, Playwright + @axe-core/playwright.
- Codegen: openapi-typescript + openapi-fetch, openapi-generator-cli (dart-dio, Java 17).
- Mobile: Flutter 3.47.6 (Riverpod, go_router, flutter_svg).

**Spec:**
- `docs/spec/18-delivery-plan.md` (section M0).
- `docs/spec/02-architecture.md` (Stack, Monorepo layout, Tenancy, Database roles and RLS, Local development, Repository bootstrap).
- `docs/spec/03-design-system.md`.
- `docs/spec/15-cross-cutting.md` (Localisation, Observability).
- `docs/spec/17-testing-quality.md`.
- `docs/spec/19-public-site.md#design-tokens-to-add`.
- Project rules: `CLAUDE.md` and the `.claude/skills/quad-*` skills.

## Global Constraints

**Versions and workspace**
- Node `22` in `.nvmrc`, with `"engines": {"node": ">=22 <23"}` in the root `package.json`.
- `"packageManager": "pnpm@9.15.9"`.
- `.fvmrc` pins Flutter `3.47.6`.
- Java 17 is used only for `openapi-generator`.
- Package names use the `@quad/<name>` scope, for example `@quad/api`, `@quad/staff`, `@quad/console`, `@quad/parent`, `@quad/db` and `@quad/domain`.
- TypeScript is `"strict": true` with `noUncheckedIndexedAccess: true`. No `any`.

**API and configuration**
- API prefix `/api/v1`. Ports: API `4000`, staff `3000`, console `3001`.
- JSON keys are camelCase.
- The error body is `{ code, message, fields? }`.
- Lists return `{ items, nextCursor }` with `limit` defaulting to 50 and capped at 200.
- Configuration comes only from environment variables, validated by Zod in `apps/api/src/config.ts`. The API refuses to boot when a required variable is missing, and refuses `DEV_FIXED_OTP` or `CONSOLE_PASSWORD_LOGIN=true` when `APP_ENV=production`.

**Database roles and tenancy**
- `quad_owner` runs migrations only.
- `quad_app` has `NOBYPASSRLS` and is used for all API work.
- `quad_platform` has `BYPASSRLS` and is used only through `withPlatform()`.
- Every tenant table has `tenant_id uuid not null`, an index starting with `tenant_id`, `ENABLE` + `FORCE ROW LEVEL SECURITY`, and the policy `tenant_id = current_setting('app.tenant_id')::uuid` (USING and WITH CHECK).
- `withTenant(tenantId, fn)` runs `fn` in a transaction after `select set_config('app.tenant_id', $1, true)`.
- `withPlatform()` may be imported only under `apps/api/src/platform/**` and `apps/api/src/worker/platform-jobs/**`. The raw database client may be imported only inside `packages/db`.

**Generated files**
- `packages/client/src/generated/**`, `packages/contracts/openapi.json`, `apps/parent/packages/quad_api/**`, `apps/parent/lib/theme/tokens.g.dart`, `packages/tokens/dist/**` and `apps/parent/lib/l10n/app_en.arb` are generated and never edited by hand.
- `pnpm codegen:check` fails on a git diff after regeneration.

**Styling and UI**
- Web styling uses only Tailwind utilities mapped to tokens.
- No raw hex in classes, no arbitrary colour values, no CSS modules, no CSS-in-JS, and no inline styles except CSS variables.
- Token values are exactly those in spec 03 (light, dark and console) and spec 19 (`font-accent`, band and heat tokens).
- Font Figtree 400–800 (self-hosted via `next/font` on web, bundled in Flutter). The accent font is Fraunces italic, on public pages only.
- Theme: `data-theme="light|dark"` on `<html>` overrides the system setting. Without it, follow `prefers-color-scheme`.
- Everything works at 390 px with no horizontal scroll, in light and dark. Every interactive element is labelled. Motion is 150–280 ms with `cubic-bezier(.2,.8,.2,1)`, and none plays with `prefers-reduced-motion`.

**Copy and code**
- Strings come from `packages/contracts/i18n/en.json`, with ICU plurals.
- Buttons say what happens. No "tenant" in school-facing copy.
- Business rules go in `packages/domain` as pure functions, with `now` injected.
- Commits use Conventional Commits and end with the two attribution lines from the controller.

## Review Focus

1. **Tenant leakage across pooled connections.** After `withTenant(A)` finishes, a later query on the same pooled connection without `withTenant` must see no tenant rows. The setting is transaction-local. Task 5 owns the test.
2. **Bad tenant id.** `withTenant('not-a-uuid')` must throw before touching the database, not run with an empty or partial setting. Task 5 owns the test.
3. **Production misconfiguration.** Booting with `APP_ENV=production` and `DEV_FIXED_OTP=000000` must exit non-zero, naming the variable. Task 7 owns the test.
4. **Greeting across the school's time zone.** At 23:30 UTC the greeting for `Asia/Colombo` (UTC+5:30, so 05:00 local) is morning, not night. At 00:00 local it is night with the word "Hello". Task 4 owns the test.
5. **Phone width and dark mode.** The staff shell and `/design` at 390 px have `document.documentElement.scrollWidth <= 390`, and dark mode changes the canvas colour to `#13142A`. Task 12 owns the Playwright assertions.

---

### Task 1: Workspace, shared config and session bootstrap

**Files:**
- Create:
  - root files: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.nvmrc`, `.fvmrc`, `.npmrc`, `.gitignore`, `.editorconfig`, `.prettierrc.cjs`, `.prettierignore`, `eslint.config.mjs`, `tsconfig.base.json`;
  - in `packages/config/`: `package.json`, `tsconfig/{base,node,nextjs,react-library}.json`, `eslint/{base,react,next}.mjs`, `vitest/preset.ts`, `prettier.cjs`;
  - `.claude/hooks/session-start.sh`.
- Modify: `.claude/settings.json` (add a `SessionStart` hook entry; keep everything else).
- Test: `packages/config/test/config.test.ts`.

**Interfaces:**
- Produces:
  - `@quad/config` exports the tsconfig presets (`@quad/config/tsconfig/node.json` and the others), ESLint flat configs (`@quad/config/eslint/base`, `/react`, `/next`), a Vitest preset (`@quad/config/vitest`) and a Prettier config.
  - Root scripts exist with the exact names in spec 02 → Root scripts: `dev`, `build`, `typecheck`, `lint`, `format`, `db:migrate`, `db:generate`, `db:seed`, `db:reset`, `api:client`, `tokens:build`, `i18n:build`, `codegen:check`, `parent:run`, `test`, `test:api`, `e2e`, `e2e:mobile`, `eval:assistant`, `verify`. Scripts whose package doesn't exist yet may point at the turbo task; `eval:assistant` echoes "Ask Quad evaluation arrives in M10" and exits 0.
  - `turbo.json` follows spec 02 → Turborepo pipeline exactly, including `globalDependencies` (`.env.example`, `.nvmrc`, `.fvmrc`) and `globalEnv` (`APP_ENV`, `NODE_ENV`).

Steps:
- [ ] **Step 1: Write a failing test.** `packages/config/test/config.test.ts` asserts:
  - the base ESLint config, applied through ESLint's `Linter` API, reports `@typescript-eslint/no-explicit-any` on `const x: any = 1`;
  - the base tsconfig has `strict: true` and `noUncheckedIndexedAccess: true`.
- [ ] **Step 2: Run it to see it fail.** Run `pnpm --filter @quad/config test`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement the configs and root files.**
  - ESLint uses typescript-eslint `strictTypeChecked`, plus react, react-hooks, jsx-a11y and import order in the `react` and `next` configs.
  - `.gitignore` covers `node_modules`, `.next`, `dist`, `coverage`, `.turbo`, `.env`, `.env.*.local`, `playwright-report`, `test-results`, `.superpowers/` and Flutter build outputs.
- [ ] **Step 4: Write the session-start hook.** It runs only when `CLAUDE_CODE_REMOTE=true` and is idempotent. It:
  - starts `dockerd` if it isn't running;
  - runs `corepack enable` and `pnpm install --frozen-lockfile` when a lockfile exists;
  - puts `/opt/sdk/flutter/bin` on PATH through `$CLAUDE_ENV_FILE` when that directory exists;
  - exports `QUAD_IMAGE_REGISTRY=mirror.gcr.io/library/` to `$CLAUDE_ENV_FILE`;
  - runs `docker compose up -d` when `docker-compose.yml` exists.

  Register it in `.claude/settings.json` under `hooks.SessionStart` with the command `bash "$CLAUDE_PROJECT_DIR/.claude/hooks/session-start.sh"`.
- [ ] **Step 5: Run the checks.** Run `pnpm install && pnpm --filter @quad/config test && pnpm lint && pnpm typecheck`. Expected: PASS.
- [ ] **Step 6: Commit.** Message: `chore(repo): monorepo workspace, shared configs and session bootstrap`.

### Task 2: Local services and environment

**Files:**
- Create:
  - `docker-compose.yml`;
  - `docker/postgres/init/01-roles.sql`;
  - `.env.example`;
  - `scripts/check-services.mjs`;
  - `scripts/test/services.test.ts` (run by a root `vitest.workspace` project named `repo`).

**Interfaces:**
- Produces:
  - Compose services with pinned minor tags:
    - `postgres` (`${QUAD_IMAGE_REGISTRY:-}postgres:16.4`) on 5432;
    - `redis` (`redis:7.4`) on 6379;
    - `minio` on 9000/9001, with a one-shot `minio-init` that creates the buckets `quad-private` and `quad-public`;
    - `mailpit` (`axllent/mailpit`) on 1025/8025;
    - `clamav` (`clamav/clamav`) on 3310.

    Every image is prefixed with `${QUAD_IMAGE_REGISTRY:-}` where the image is from Docker Hub library.
  - Local database `quad`. The roles, with local-only passwords equal to their names, are:
    - `quad_owner` (owns the schema);
    - `quad_app` (`NOBYPASSRLS`, `LOGIN`);
    - `quad_platform` (`BYPASSRLS`, `LOGIN`).

    Extensions: `pg_trgm` and `citext`.
  - `.env.example` lists every variable in spec 02 → Environment variables, in that order. Each has a one-line `#` comment and no values, except the safe local defaults the Local development section needs:
    - `APP_ENV=local`;
    - the three database URLs;
    - `REDIS_URL`;
    - `SMTP_URL`;
    - `S3_*` for MinIO;
    - `DEV_FIXED_OTP=000000`;
    - `CONSOLE_PASSWORD_LOGIN=true`.

Steps:
- [ ] **Step 1: Write a failing test.** In `scripts/test/services.test.ts`:
  - `it('quad_app cannot bypass RLS and quad_platform can')` queries `pg_roles.rolbypassrls` for both roles through `DATABASE_OWNER_URL`;
  - `it('.env.example lists every variable named in spec 02')` parses the backticked names in the spec's Environment variables table and expects each one as a key in `.env.example`.
- [ ] **Step 2: Run it to see it fail.** Run `pnpm vitest run --project repo`. Expected: FAIL.
- [ ] **Step 3: Implement.** Write the compose file, the init SQL and `.env.example`. `scripts/check-services.mjs` waits for Postgres and Redis to be reachable, timing out after 60 s.
- [ ] **Step 4: Run the checks.** Run `docker compose up -d && node scripts/check-services.mjs && pnpm vitest run --project repo`. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `chore(infra): docker compose services, database roles and env example`.

### Task 3: Contracts and i18n

**Files:**
- Create:
  - `packages/contracts/{package.json,tsconfig.json}`;
  - `src/index.ts`, `src/common/{ids,money,errors,pagination}.ts`, `src/permissions.ts`, `src/i18n/build.ts`;
  - `i18n/en.json`;
  - tests next to the sources (`*.test.ts`).

**Interfaces:**
- Produces:
  - `IdSchema`: a uuid string.
  - `MoneySchema`: `{ amountMinor: int, currency: string(3, uppercase) }`.
  - `ErrorBodySchema`: `{ code: string, message: string, fields?: Record<string,string> }`.
  - `ErrorCode`: a Zod enum of the codes in spec 06 → Conventions (`validation`, `unauthorized`, `forbidden`, `module_not_in_plan`, `school_suspended`, `not_found`, `conflict`, `seat_limit`, `slot_taken`, `clash`, `in_use`, `business_rule`, `app_update_required`, `rate_limited`).
  - `paginated(item)`: returns a `{ items: item[], nextCursor: string | null }` schema.
  - `PageQuerySchema`: `{ cursor?: string, limit: int 1..200 default 50 }`.
  - `PermissionKey`: a Zod enum stub with `settings.edit` and `users.manage`.
  - `en.json` holds the shell strings: nav labels, theme toggle, the greeting words `greeting.morning`, `greeting.afternoon`, `greeting.evening` and `greeting.hello`, the 404 copy and a plural example `students.count`.
  - `pnpm i18n:build`:
    - validates every message with `@formatjs/icu-messageformat-parser`, failing with the key name on error;
    - writes `apps/parent/lib/l10n/app_en.arb` (keys converted to camelCase, `@@locale: en`).

Steps:
- [ ] **Step 1: Write failing tests.**
  - `MoneySchema` rejects `{amountMinor: 1.5, currency: 'LKR'}` and accepts `{amountMinor: 31000000, currency: 'LKR'}`.
  - `PageQuerySchema.parse({})` gives `limit` 50, and `limit: 201` fails.
  - `buildArb({ 'a.b': '{count, plural, one {# x} other {# xs}}' })` returns `{ '@@locale': 'en', aB: … }`.
  - `buildArb({ bad: '{count, plural, one {x}' })` throws an error that contains `bad`.
- [ ] **Step 2: Run them to see them fail.** Run `pnpm --filter @quad/contracts test`. Expected: FAIL.
- [ ] **Step 3: Implement.** Export `buildArb(messages: Record<string,string>): Record<string,string>` from `src/i18n/build.ts`. The CLI entry writes the ARB file.
- [ ] **Step 4: Run the checks.** Run `pnpm --filter @quad/contracts test && pnpm i18n:build`. Expected: PASS, and `app_en.arb` is written.
- [ ] **Step 5: Commit.** Message: `feat(contracts): base schemas, error and pagination contracts, i18n build`.

### Task 4: Domain package with the greeting period

**Files:**
- Create:
  - `packages/domain/{package.json,tsconfig.json,vitest.config.ts}`;
  - `src/index.ts`;
  - `src/greeting/greeting-period.ts` and `src/greeting/greeting-period.test.ts`.

**Interfaces:**
- Produces:
  - `type GreetingPeriod = 'morning' | 'afternoon' | 'evening' | 'night'`.
  - `greetingPeriod(now: Date, timeZone: string): { period: GreetingPeriod; word: 'Good morning' | 'Good afternoon' | 'Good evening' | 'Hello' }`.
  - Coverage threshold for this package: 100% branches.

Steps:
- [ ] **Step 1: Write failing tests.** Use table-driven cases in `Asia/Colombo` with local times:

  | Local time | Period | Word |
  |---|---|---|
  | 04:59 | night | Hello |
  | 05:00 | morning | Good morning |
  | 11:59 | morning | Good morning |
  | 12:00 | afternoon | Good afternoon |
  | 16:59 | afternoon | Good afternoon |
  | 17:00 | evening | Good evening |
  | 19:59 | evening | Good evening |
  | 20:00 | night | Good evening |
  | 23:59 | night | Good evening |
  | 00:00 | night | Hello |

  Also add the Review Focus #4 case: `2026-10-05T23:30:00Z` in `Asia/Colombo` is morning. An invalid time zone throws `RangeError`.
- [ ] **Step 2: Run them to see them fail.** Run `pnpm --filter @quad/domain test`. Expected: FAIL.
- [ ] **Step 3: Implement.** Read the local hour and minute with `Intl.DateTimeFormat(…, { timeZone, hourCycle: 'h23' })`.
- [ ] **Step 4: Run the checks.** Run `pnpm --filter @quad/domain test -- --coverage`. Expected: PASS with 100% branches.
- [ ] **Step 5: Commit.** Message: `feat(domain): greeting period by school time zone`.

### Task 5: Database package with roles, RLS helpers and the migration test

**Files:**
- Create:
  - `packages/db/{package.json,tsconfig.json,drizzle.config.ts,vitest.config.ts}`;
  - `src/index.ts`, `src/client.ts`, `src/tenant.ts`, `src/platform.ts`, `src/rls.ts`;
  - `src/schema/{index.ts,platform/tenants.ts}`;
  - `src/platform-tables.ts`;
  - `src/scripts/{migrate.ts,seed.ts,reset.ts}`;
  - `migrations/**` (generated, then edited only to add grants);
  - `test/{setup.ts,migration.test.ts,tenant.test.ts,factories.ts}`.

**Interfaces:**
- Produces:
  - `withTenant<T>(tenantId: string, fn: (tx: TenantTx) => Promise<T>): Promise<T>`. It throws `InvalidTenantIdError` for a non-uuid.
  - `withPlatform<T>(fn: (tx: PlatformTx) => Promise<T>): Promise<T>`, on a separate pool from `DATABASE_PLATFORM_URL`.
  - `tenantRlsSql(table: string): string`. It emits `ENABLE` and `FORCE ROW LEVEL SECURITY`, `CREATE POLICY tenant_isolation … USING (…) WITH CHECK (…)`, and grants on the table to `quad_app`.
  - `PLATFORM_TABLES: readonly string[]` (initially `['tenants']`, plus drizzle's migrations table). These are the only tables allowed without `tenant_id`.
  - Schema `tenants` with the columns from spec 04 → Platform. `plan_id` and `curriculum_template_id` are nullable uuids without foreign keys until M2.
  - Scripts:
    - `migrate`: runs as `DATABASE_OWNER_URL`;
    - `seed`: inserts the two seed tenants, Colombo International School and Kandy Hill Academy, with fixed uuids exported as `SEED_TENANTS`;
    - `reset`: refuses unless `APP_ENV=local`.
  - The raw client is exported only as `@quad/db/internal`, for use inside this package and its tests.

Steps:
- [ ] **Step 1: Write failing tests** against the compose Postgres, using a fresh database per test file created by `test/setup.ts`.
  - **`migration.test.ts`:**
    - `it('every non-platform table has tenant_id, a tenant_id-leading index, FORCE RLS and a policy')` inspects `information_schema` and `pg_class.relforcerowsecurity` / `pg_policies`.
    - `it('fails for a table without FORCE RLS')` creates a throwaway `rls_probe(tenant_id uuid not null)` with only ENABLE, runs the same checker function `findTenancyViolations(db): Promise<string[]>`, and expects `['rls_probe: FORCE ROW LEVEL SECURITY missing', …]`.
    - `it('quad_app has no BYPASSRLS')`.
  - **`tenant.test.ts`:**
    - with a probe tenant table created with `tenantRlsSql`, a row written under A is invisible under B;
    - writing a row with tenant B's id while in A fails with an RLS error;
    - Review Focus #1: after `withTenant(A)`, a raw `quad_app` query on the same pool returns 0 rows, and `current_setting('app.tenant_id', true)` is empty;
    - Review Focus #2: `withTenant('nope')` throws `InvalidTenantIdError`.
- [ ] **Step 2: Run them to see them fail.** Run `pnpm --filter @quad/db test`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Use `drizzle-orm/node-postgres` with `pg` pools.
  - `findTenancyViolations` lives in `src/rls.ts` so the test and a future CLI share it.
  - Generate the first migration with `pnpm db:generate`.
- [ ] **Step 4: Run the checks.** Run `pnpm db:migrate && pnpm db:seed && pnpm --filter @quad/db test`. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat(db): drizzle setup, tenants table, withTenant/withPlatform and RLS migration test`.

### Task 6: Lint rules for tenancy boundaries

**Files:**
- Create:
  - `packages/config/eslint/rules/{no-raw-db-client.mjs,no-with-platform-outside-platform.mjs}`;
  - `packages/config/eslint/plugin.mjs`;
  - `packages/config/test/rules.test.ts`.
- Modify: `packages/config/eslint/base.mjs` (enable both rules as errors).

**Interfaces:**
- Produces:
  - Rule `quad/no-raw-db-client` reports imports of `pg`, `drizzle-orm/node-postgres`, `postgres` or `@quad/db/internal` from any file outside `packages/db/**`.
  - Rule `quad/no-with-platform-outside-platform` reports importing `withPlatform` from `@quad/db` outside `apps/api/src/platform/**` and `apps/api/src/worker/platform-jobs/**`.

Steps:
- [ ] **Step 1: Write failing tests.** Using ESLint `RuleTester` in `rules.test.ts`:
  - `import { Pool } from 'pg'` is invalid in `apps/api/src/x.ts` and valid in `packages/db/src/client.ts`;
  - `import { withPlatform } from '@quad/db'` is invalid in `apps/api/src/modules/students/s.ts` and valid in `apps/api/src/platform/tenants/t.ts` and `apps/api/src/worker/platform-jobs/health.ts`.
- [ ] **Step 2: Run them to see them fail.** Expected: FAIL.
- [ ] **Step 3: Implement.** Write the two rules, matching on `context.filename` relative to the repository root.
- [ ] **Step 4: Run the checks.** Run `pnpm --filter @quad/config test && pnpm lint`. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat(config): lint rules banning raw db client and withPlatform outside platform code`.

### Task 7: API skeleton

**Files:**
- Create:
  - `apps/api/{package.json,tsconfig.json,vitest.config.ts,nest-cli.json}`;
  - `src/main.ts`, `src/worker.ts`, `src/app.module.ts`;
  - `src/config.ts`;
  - `src/common/{error.filter.ts,errors.ts,zod.pipe.ts,request-context.ts}`;
  - `src/observability/{logger.ts,tracing.ts}`;
  - `src/health/{health.module.ts,health.controller.ts}`;
  - `src/openapi/{document.ts,export.ts}`;
  - `test/{config.test.ts,health.test.ts,openapi.test.ts}`.

**Interfaces:**
- Consumes: `@quad/contracts` (`ErrorBodySchema`, `ErrorCode`) and `@quad/db` (a `pingDatabase()` exported for readiness).
- Produces:
  - `loadConfig(env: NodeJS.ProcessEnv): Config`. It throws `ConfigError` listing every missing or invalid variable. In `APP_ENV=production` it rejects a set `DEV_FIXED_OTP` and `CONSOLE_PASSWORD_LOGIN=true`.
  - `createApp(config: Config): Promise<NestFastifyApplication>`, with the global prefix `api/v1`.
  - Routes:
    - `GET /api/v1/health/live` returns `{ status: 'ok' }`;
    - `GET /api/v1/health/ready` returns `{ status: 'ok', db: 'ok', redis: 'ok' }`, or 503 with the failing part;
    - `GET /api/v1/openapi.json` returns OpenAPI 3.1 generated from the Zod schemas with `@asteasolutions/zod-to-openapi`.
  - Typed domain errors: `AppError(code: ErrorCode, message, status, fields?)` with subclasses `NotFoundError`, `ForbiddenError`, `ConflictError` and `BusinessRuleError`. The global filter maps them to `ErrorBodySchema` and maps Zod failures to 400 `validation` with `fields`.
  - `buildOpenApiDocument(): OpenAPIObject`, which works without starting a server. It is used by `api:client`.
  - `src/worker.ts` is a BullMQ worker entry that connects to Redis and logs readiness (no jobs yet).
  - Pino logger with the `requestId`, `tenantId` and `userId` fields. Personal data is never logged.
  - OpenTelemetry SDK initialisation, which does nothing when `OTEL_EXPORTER_OTLP_ENDPOINT` is empty.

Steps:
- [ ] **Step 1: Write failing tests.**
  - `config.test.ts`:
    - missing `DATABASE_URL` → `ConfigError` mentioning `DATABASE_URL`;
    - Review Focus #3: production with `DEV_FIXED_OTP` → `ConfigError` mentioning `DEV_FIXED_OTP`;
    - production with `CONSOLE_PASSWORD_LOGIN=true` → `ConfigError`.
  - `health.test.ts` (Fastify `inject`):
    - live returns 200;
    - ready returns 200 against the compose services, and 503 with `db: 'down'` when the database URL points at a closed port;
    - an unknown route returns 404 with `{ code: 'not_found' }`.
  - `openapi.test.ts`: the document has `openapi: '3.1.0'` and the path `/api/v1/health/live`.
- [ ] **Step 2: Run them to see them fail.** Expected: FAIL.
- [ ] **Step 3: Implement.** Also add the `main.ts` boot check: run `loadConfig(process.env)`, and on `ConfigError` print the message and `process.exit(1)`.
- [ ] **Step 4: Run the checks.** Run `pnpm --filter @quad/api test`. Then, to prove the boot check, run `APP_ENV=production DEV_FIXED_OTP=000000 node apps/api/dist/main.js; echo $?`. Expected: tests PASS; the boot prints `DEV_FIXED_OTP` and exits 1.
- [ ] **Step 5: Commit.** Message: `feat(api): NestJS Fastify skeleton with config validation, health, errors, logging and OpenAPI`.

### Task 8: API client generation

**Files:**
- Create:
  - `packages/client/{package.json,tsconfig.json}`;
  - `src/index.ts`, `src/fetcher.ts`, `src/query.ts`;
  - `scripts/api-client.mjs` (root);
  - `scripts/codegen-check.mjs`;
  - `openapitools.json`.

**Interfaces:**
- Consumes: `buildOpenApiDocument()` from Task 7.
- Produces:
  - `pnpm api:client`:
    - writes `packages/contracts/openapi.json`;
    - runs `openapi-typescript` into `packages/client/src/generated/schema.d.ts`;
    - runs `openapi-generator-cli generate -g dart-dio` into `apps/parent/packages/quad_api` (pubName `quad_api`).
  - `createApiClient(baseUrl: string)`: an `openapi-fetch` client typed by `paths`.
  - `apiQueryOptions`: TanStack Query helpers, with one example for `health/live`.
  - `pnpm codegen:check` runs `api:client`, `tokens:build` and `i18n:build`, then `git diff --exit-code` on the generated paths. It names the stale files on failure.

Steps:
- [ ] **Step 1: Write a failing test.** In `packages/client/src/index.test.ts`, a typed call `client.GET('/api/v1/health/live')` against a stub `fetch` resolves to `{ data: { status: 'ok' } }`. The type check in `pnpm typecheck` fails if the path is unknown.
- [ ] **Step 2: Run it to see it fail.** Expected: FAIL (no generated schema).
- [ ] **Step 3: Implement.** Run `pnpm api:client` and commit its output.
- [ ] **Step 4: Run the checks.** Run `pnpm api:client && pnpm --filter @quad/client test && pnpm typecheck && node scripts/codegen-check.mjs`. Expected: PASS and a clean diff.
- [ ] **Step 5: Commit.** Message: `feat(client): generated TypeScript and Dart API clients and codegen check`.

### Task 9: Design tokens and logo components

**Files:**
- Create:
  - `packages/tokens/{package.json,tsconfig.json}`;
  - `src/{colors.ts,type.ts,shape.ts,public-site.ts,index.ts}`;
  - `src/build/{css.ts,dart.ts,index.ts}`;
  - `src/logo/{QuadMark.tsx,QuadLogo.tsx,index.ts}`;
  - tests.
- Generated: `packages/tokens/dist/{theme.css,tokens.css}` and `apps/parent/lib/theme/tokens.g.dart`.

**Interfaces:**
- Produces:
  - `colors.light`, `colors.dark` and `colors.console` (overrides of rail tokens): `Record<TokenName, string>`, with exactly the spec 03 values.
  - `publicSite` tokens: `font-accent`, `band*`, `band-tag-*` (background/text pairs) and `heat-0..3`, as spec 19 defines them, with heat values computed with `color-mix` on `surface`.
  - `type`, `radius` (`card` 16 px, `scene` 24 px, `input` 12 px, `pill` 999 px), `shadow` (`card` and `lg` from spec 03) and the spacing scale.
  - `dist/theme.css`:
    - Tailwind v4 `@theme` mapping utilities to `var(--…)` (`bg-canvas`, `bg-surface`, `text-ink-2`, `border-line`, `bg-brand`, `text-brand-ink`, `rounded-card`, `shadow-card`, `font-sans`, `font-accent`);
    - `:root` light values;
    - `[data-theme=dark]` and `@media (prefers-color-scheme: dark) :root:not([data-theme=light])` dark values;
    - `[data-app=console]` rail overrides.
  - `tokens.g.dart`: a `QuadTokens` constants class and `QuadColors extends ThemeExtension<QuadColors>` with `light`/`dark` instances, `copyWith` and `lerp`.
  - `<QuadMark />` and `<QuadLogo variant="color|white" />` React components drawn from `design/brand/quad-mark.svg` and `quad-logo.svg` paths, with `aria-label="Quad"`.

Steps:
- [ ] **Step 1: Write failing tests.**
  - `colors.light.brand === '#DD4A42'`;
  - `colors.dark.canvas === '#13142A'`;
  - `colors.console['rail'] === '#15173A'`;
  - the built CSS contains `--color-canvas` in `@theme` and `[data-theme=dark]` with `#13142A`;
  - the generated Dart contains `static const light = QuadColors(` and `canvas: Color(0xFFFAF8F5)`;
  - the band tokens equal the spec 19 table.
- [ ] **Step 2: Run them to see them fail.** Expected: FAIL.
- [ ] **Step 3: Implement.** Write the token sources, both generators and the logo components.
- [ ] **Step 4: Run the checks.** Run `pnpm tokens:build && pnpm --filter @quad/tokens test`. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat(tokens): design tokens with Tailwind theme, Dart theme extension and logo components`.

### Task 10: UI primitives (part 1)

**Files:**
- Create:
  - `packages/ui/{package.json,tsconfig.json,vitest.config.ts}`;
  - `src/lib/cn.ts`;
  - `src/format/{money.ts,date.ts}`;
  - `src/components/{Button,IconButton,Input,Textarea,Select,DropdownFilter,Segmented,Switch,Checkbox,Chip,Pill,Card,Kpi,Table,Avatar,EmptyState,Tooltip,Tabs,Toast}.tsx`;
  - one `*.test.tsx` per logic-bearing component;
  - `src/index.ts`.

**Interfaces:**
- Consumes: `@quad/tokens` CSS (the apps import it; components use token utilities only).
- Produces:
  - `cn(...classes)`.
  - `formatMoney({amountMinor, currency}, locale)`: `Rs 310,000` for `{amountMinor: 31000000, currency: 'LKR'}` in `en-LK`.
  - `formatDate(date, timeZone, style)`.
  - The components:
    - `Button` with `variant: primary | secondary | ghost | danger` and `size: sm | md`, plus an optional icon;
    - `DropdownFilter` with `{label, icon, value, options: {value,label,count,group?}[], searchable?, onChange, onClear}`;
    - `Toast` through `useToast().show(message)`, showing at most 2 at once for 2.8 s each in an `aria-live="polite"` region;
    - `Avatar` with initials and a deterministic colour from a fixed palette;
    - `Table` that is sortable and selectable, with columns that can hide progressively on phones.

    All components are typed and labelled, and built on Radix where there is behaviour.

Steps:
- [ ] **Step 1: Write failing tests** (Vitest + Testing Library + jsdom):
  - `Button` renders `variant=danger` with the `bg-bad` class;
  - `DropdownFilter` shows the active value and a clear button labelled "Clear {label}", and filters options when searchable;
  - `Toast` keeps only the 2 newest;
  - `Avatar('Amaya Perera')` gives the initials `AP` and the same colour on every call;
  - `formatMoney` gives the value above;
  - `Table` sorts by a column when its header button is pressed.
- [ ] **Step 2: Run them to see them fail.** Expected: FAIL.
- [ ] **Step 3: Implement** to match `design/admin.html` styling (classes from tokens only).
- [ ] **Step 4: Run the checks.** Run `pnpm --filter @quad/ui test && pnpm --filter @quad/ui lint`. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat(ui): core UI primitives and formatters`.

### Task 11: UI primitives (part 2)

**Files:**
- Create: in `packages/ui/src/components/`, `Drawer.tsx` (with `Stepper`), `GreetingScene.tsx`, `Sparkline.tsx`, `PetalBurst.tsx` and `CommandPalette.tsx`, each with tests.

**Interfaces:**
- Consumes: `GreetingPeriod` from `@quad/domain`.
- Produces:
  - `Drawer`:
    - props `{open, onOpenChange, title, subtitle?, eyebrow?, icon?, width: 'md'|'wide', steps?: string[], step?: number, footer}`;
    - 520 px wide, or 760 px when wide; full screen under 640 px;
    - Escape closes it, focus is trapped and returns to the opener;
    - a "Discard changes?" inline confirmation when `dirty`.
  - `GreetingScene`:
    - props `{period: GreetingPeriod, className?}`;
    - a port of `design/brand/greeting/scenes.js` that colours with CSS variables (`var(--c1)` and the rest);
    - `preserveAspectRatio="xMaxYMax slice"` and `aria-hidden`;
    - the rise animation and star twinkle are off with reduced motion.
  - `Sparkline`: `{values: number[], trend: 'up'|'down'}`, 64×24, with the end point marked.
  - `PetalBurst`: `burst()` from `usePetalBurst()`, and nothing with reduced motion.
  - `CommandPalette`: a shell that opens with Ctrl K or ⌘K, with a search input and grouped results passed in through props.

Steps:
- [ ] **Step 1: Write failing tests.**
  - The drawer closes on Escape and returns focus to the trigger.
  - The drawer shows step 2 of 3 as `aria-current="step"`.
  - Each `GreetingScene` period renders an svg with the class `gs-<period>`; night contains elements with the class `gs-star`.
  - `PetalBurst` renders nothing when `matchMedia('(prefers-reduced-motion: reduce)')` matches.
  - `CommandPalette` opens on Ctrl K.
- [ ] **Step 2: Run them to see them fail.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the checks.** Run `pnpm --filter @quad/ui test`. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat(ui): drawer with stepper, greeting scene, sparkline, petal burst and command palette`.

### Task 12: Staff and console shells, with the style guide

**Files:**
- Create:
  - `apps/staff/{package.json,next.config.ts,tsconfig.json,postcss.config.mjs,playwright.config.ts}`;
  - `src/app/{layout.tsx,globals.css,page.tsx,not-found.tsx}`;
  - `src/app/app/{layout.tsx,page.tsx}`;
  - `src/app/design/page.tsx`;
  - `src/components/shell/{Sidebar.tsx,Topbar.tsx,ThemeToggle.tsx,MobileNav.tsx}`;
  - `src/i18n/{index.ts}`;
  - `e2e/{shell.spec.ts,design.spec.ts}`.
- Create, mirroring staff: `apps/console/**` (no `/design` route; `data-app="console"`).
- Move the shell parts to `packages/ui/src/shell/*` if both apps use the same component (rule of two in `quad-reuse`).

**Interfaces:**
- Consumes:
  - from `@quad/ui`: the components, `GreetingScene` and the formatters;
  - from `@quad/tokens`: `dist/theme.css` and the logo;
  - `greetingPeriod` from `@quad/domain`;
  - `en.json` through i18next.
- Produces:
  - **Staff routes:**
    - `/` is a placeholder: "Quad: the landing page arrives in M1b", with a link to `/app`;
    - `/app` is the shell with the home placeholder: a greeting section with `GreetingScene`, "Good morning, Prishan" using the highlighted-name style, and a summary sentence placeholder;
    - `/design` is the living style guide, showing every `@quad/ui` component in light and dark side by side;
    - `/api/v1/*` is rewritten to `http://localhost:4000/api/v1/*`.
  - **Console:** the same shell on :3001 with console rail colours and the lilac active item, and a home placeholder.
  - **Theme toggle:** cycles system → light → dark, stored in `localStorage` (`quad-theme`), and sets `data-theme` on `<html>` before paint with an inline script that only sets the attribute. Figtree comes through `next/font/google` (self-hosted at build).
  - **Side bar:** 248 px, collapsible to 72 px; a slide-over below 900 px.

Steps:
- [ ] **Step 1: Write failing Playwright tests.**
  - `shell.spec.ts`, for `[1440x900, 390x844] × [light, dark]`:
    - `/app` shows a navigation landmark and the greeting;
    - `document.documentElement.scrollWidth <= viewport width` (Review Focus #5);
    - the `body` background equals `rgb(250, 248, 245)` in light and `rgb(19, 20, 42)` in dark;
    - axe reports no serious or critical violations;
    - an unknown path shows the 404 page.
  - `design.spec.ts`: `/design` renders a heading for every exported component name.
  - The same shell spec runs for the console on :3001.
- [ ] **Step 2: Run them to see them fail.** Run `pnpm --filter @quad/staff e2e`. Expected: FAIL.
- [ ] **Step 3: Implement both apps.**
- [ ] **Step 4: Run the checks and take screenshots.** Run `pnpm build && pnpm e2e`. Expected: PASS. Save screenshots of `/design`, `/app` and the console home at 1440 and 390, light and dark, to `docs/screenshots/m0/`.
- [ ] **Step 5: Commit.** Message: `feat(web): staff and console shells with theme, i18n and the /design style guide`.

### Task 13: Parent app shell (Flutter)

**Files:**
- Create:
  - `apps/parent/{pubspec.yaml,analysis_options.yaml,package.json,env/{dev,staging,prod}.json}`;
  - `lib/{main.dart,app.dart,router.dart}`;
  - `lib/theme/{theme.dart}`;
  - `lib/ui/{greeting_icon.dart}`;
  - `lib/features/{home,circle,payments,messages,more}/screens/*_screen.dart`;
  - `lib/l10n/` (ARB from Task 3, plus `l10n.yaml`);
  - `assets/{fonts/Figtree-*.ttf,greeting/icon-*.svg,brand/*.svg}`;
  - the flavour configuration under `android/app/build.gradle(.kts)` and the iOS schemes;
  - `test/{app_test.dart,goldens/shell_golden_test.dart}`.

**Interfaces:**
- Consumes:
  - `tokens.g.dart` (Task 9);
  - `app_en.arb` (Task 3);
  - `packages/quad_api` (Task 8), as a path dependency;
  - greeting icons copied from `design/brand/greeting/icon-*.svg`.
- Produces:
  - Flavours `dev`, `staging` and `prod`, with the bundle ids `com.quadedu.parent.dev`, `com.quadedu.parent.staging` and `com.quadedu.parent`.
  - `env/<flavor>.json` with `API_URL`, `SOCKET_URL`, `SENTRY_DSN` and `APP_ENV`. Dev uses `http://localhost:4000/api/v1`.
  - A `go_router` tab bar: Home, Circle, Payments, Messages, More.
  - `ThemeData` built from `QuadColors.light` / `.dark`, with Figtree.
  - `GreetingIcon(period)`, tinted amber for morning and afternoon, coral for evening and lilac for night.
  - `package.json` scripts: `lint` → `fvm flutter analyze`, `test` → `fvm flutter test`, `format` → `fvm dart format`. These fall back to `flutter` when `fvm` is not installed.

Steps:
- [ ] **Step 1: Write failing tests.**
  - `app_test.dart`: the app shows 5 tabs with their labels from the ARB, and tapping Payments shows the Payments screen.
  - The golden tests cover the shell Home at 390×844, light and dark, with text scale 1.0 and 2.0.
- [ ] **Step 2: Run them to see them fail.** Run `cd apps/parent && fvm flutter test`. Expected: FAIL.
- [ ] **Step 3: Implement.** Then run `fvm flutter test --update-goldens` once and commit the images after looking at them.
- [ ] **Step 4: Run the checks.** Run `cd apps/parent && fvm flutter analyze && fvm flutter test`. Expected: no analysis issues; tests PASS.
- [ ] **Step 5: Commit.** Message: `feat(parent): Flutter shell with flavors, token theme, tabs and goldens`.

### Task 14: CI, the verify gate and documentation

**Files:**
- Create: `.github/workflows/ci.yml` and `scripts/verify.mjs`.
- Modify:
  - `package.json` (`verify` → `node scripts/verify.mjs`);
  - `README.md` (getting started);
  - `docs/spec/02-architecture.md` (decision log D24);
  - `docs/spec/18-delivery-plan.md` (tick M0).

**Interfaces:**
- Produces:
  - `pnpm verify` runs, in order and stopping at the first failure:
    1. `turbo run typecheck lint test`;
    2. `codegen:check`;
    3. `test:api`;
    4. `e2e` smoke;
    5. `pnpm audit --prod --audit-level high`.
  - CI runs on pull requests and on pushes to `main`. It:
    - uses Ubuntu with service containers (postgres:16.4 with the init script mounted, redis:7.4);
    - sets up pnpm from the cache, Java 17, and Flutter through `subosito/flutter-action` with `flutter-version-file: .fvmrc`;
    - installs the Playwright Chromium;
    - runs `pnpm verify` and `pnpm build`.

Steps:
- [ ] **Step 1: Run `pnpm verify` locally.** Expected: PASS end to end. Fix any failure at its root.
- [ ] **Step 2: Validate the workflow.** Write it and run `npx --yes @action-validator/cli .github/workflows/ci.yml`. Expected: valid.
- [ ] **Step 3: Update the docs.**
  - **README:** a Getting started section with the commands from spec 02 → Local development.
  - **D24 in the decision log:** Flutter pinned to 3.47.6; the `QUAD_IMAGE_REGISTRY` prefix for registry mirrors; staff `/` is a placeholder until M1b; the `PLATFORM_TABLES` allowlist drives the migration test.
  - **Spec 18:** tick M0 in Progress.
- [ ] **Step 4: Commit.** Message: `ci: verify workflow and M0 docs`.
