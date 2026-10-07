# M0b Infrastructure and Staging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Everything staging needs is written and validated offline: Terraform for the tooling and staging accounts, container images for every service, a deploy workflow that runs the migration and stops if it fails, the app changes that staging relies on (proxy hops, noindex, health, realtime handshake, the SES webhook, Sentry and OpenTelemetry), and the fastlane staging lanes. Nothing is applied or deployed. `infra/README.md` is the checklist for the first real deploy.

**Architecture:**
- **Terraform.** Three roots:
  - `infra/bootstrap` (tooling account): the state bucket, lock table and state role.
  - `infra/envs/global` (tooling account): the `quad-edu.com` zone, its shared records and the cross-account DNS role.
  - `infra/envs/staging` (staging account): composes five modules in the order network → data → edge → dns → app.
- **Images.** Each image is built once from the repository root:
  - api, with worker, migrate, seed and db-bootstrap as commands of the same image;
  - staff and console, as Next standalone servers;
  - clamav, the official image plus config.
- **Workflows.** CI gains named checks and image builds. `deploy-staging.yml` and `infra.yml` skip cleanly until the AWS role variables exist.

**Tech Stack:**
- Infrastructure: Terraform 1.16.5, `hashicorp/aws` 6.67.0, `hashicorp/random` 3.9.1, `terraform test` with `mock_provider`. Scanners: tflint (AWS ruleset) and checkov 3.3.25.
- Images and CI: Docker BuildKit, hadolint v2.12.0, GitHub Actions with OIDC, action-validator 0.6.0 and actionlint 1.7.9.
- App libraries: `@sentry/node` and `@sentry/nextjs` 11.4.0, `@vercel/otel` 2.1.3, `socket.io` 4.8.4, `sentry_flutter` 9.30.1.
- Mobile release: fastlane 2.240.1 (Ruby 3.3).

**Spec:**
- `docs/spec/18-delivery-plan.md` (section M0b: Scope, Accept, Prompt).
- `docs/spec/20-infrastructure-operations.md` (all of it).
- `docs/spec/02-architecture.md`:
  - Environments, Paths, Environment variables, Root scripts, Local development;
  - Tenant-less entry points (D16);
  - the decision log D1–D27, especially D13–D15 and D27 with its M0 follow-ups.
- `docs/spec/16-security-privacy.md` (Operational security).
- `docs/spec/09-parent-app.md` (Flavors and configuration, Store publishing).
- `docs/spec/04-data-model.md` (`email_suppressions`) and `docs/spec/05-auth-tenancy-rbac.md` (tenant-less route folders).
- Project rules: `CLAUDE.md` and the `.claude/skills/quad-*` skills.

## Global Constraints

**Never touch real AWS**
- Never run `terraform apply`, `terraform destroy` or `terraform plan` against AWS. Never run `terraform init` with a backend (always `-backend=false`). Never use the AWS credentials present in the environment.
- Run Terraform only through `node scripts/infra-check.mjs`, which removes every `AWS_*` variable and sets `AWS_EC2_METADATA_DISABLED=true`, or with `mock_provider` in `terraform test`.
- Do not create `*.tfvars` files: reading them is denied, and staging values are variable defaults or locals.
- Do not read `.env` or `.env.*.local` (denied). Use `.env.example` and explicit `-e` flags.

**Commits and repository content**
- Use Conventional Commits. End every commit message with the two attribution trailer lines the controller supplies (`Co-Authored-By: …` and `Claude-Session: …`).
- Write no AI model name and no session link into any repository file. They appear only in commit trailers. The existing `ASSISTANT_MODEL` spec text is untouched.
- Run `quad-review` on the diff before each commit.
- Commit no secrets: no keys, passwords or real DSNs. Placeholders are empty values. The spec 20 public CA bundle and test public keys generated at runtime are fine.
- Never edit `design/`. Regenerate generated files (`pnpm api:client`); never hand-edit them.
- Migrations are append-only from M0b (ruling R12). The new migration is `0001_*`.
- Ruling R-db-admin (Task 8 review): on AWS the RDS master password is RDS-managed and never a Terraform-built `DATABASE_ADMIN_URL`. db-bootstrap gets `DATABASE_ADMIN_USER`/`DATABASE_ADMIN_PASSWORD` from the RDS-managed secret's JSON keys plus plain `DATABASE_ADMIN_HOST`/`DATABASE_ADMIN_PORT` (direct to RDS), and keeps `DATABASE_ADMIN_URL` for local runs and CI. Tasks 9 and 12 carry the details; D28 records it.

**Toolchain in this container**
- Flutter is at `/opt/sdk/flutter/bin` (put it on `PATH`). `fvm` is absent; `scripts/flutter.mjs` falls back to `flutter`. There is no Android SDK and no Xcode, so mobile builds run only in CI.
- Docker works but `dockerd` may need starting (the session hook does it).
  - Set `QUAD_IMAGE_REGISTRY=mirror.gcr.io/` (trailing slash, host only). `FROM` lines use `${QUAD_IMAGE_REGISTRY}library/node:…`, `${QUAD_IMAGE_REGISTRY}clamav/clamav:…`, and so on.
  - Builds go through `scripts/docker-build.mjs` (Task 7), which adds `--network host`, the proxy build args and the CA secret.
- Services: `docker compose up -d postgres redis mailpit`. MinIO and ClamAV do not run in this container (ruling R5).
- Network:
  - Blocked: `registry.terraform.io`, GitHub release downloads and `ghcr.io` blobs.
  - Reachable: `releases.hashicorp.com`, npm, PyPI, RubyGems, pub.dev, `mirror.gcr.io` and `truststore.pki.rds.amazonaws.com`.
  - If a needed tool cannot be obtained, record the gap in the task report and in `infra/README.md` → Validation gaps. Do not route around a block.

**Fixed names and values**
- Accounts and region:
  - Region `ap-south-1`; CloudFront certificates and WAF in `us-east-1` (provider alias `aws.us_east_1`).
  - Accounts: `tooling` (state, DNS zone) and `staging`. Production is M12.
- Hosts:
  - `staging.quad-edu.com` (staff, `/api/v1/*`, `/socket.io/*`);
  - `console.staging.quad-edu.com`;
  - `origin.staging.quad-edu.com` (the ALB's own name, which CloudFront calls);
  - `mail.quad-edu.com` (SES), with MAIL FROM `bounce.mail.quad-edu.com`.
- Resource prefix `quad-staging`. Every resource is tagged `env`, `service`, `owner`, `cost-centre`:
  - `env`, `owner` and `cost-centre` come from provider `default_tags` (`staging`, `platform`, `quad-staging`);
  - `service` is set per resource.
- Origin header: `X-Quad-Origin-Secret`, with a 48-character value from `random_password`.
- `TRUST_PROXY_HOPS=2` on AWS (CloudFront + ALB).
- Ports: API `4000`, staff `3000`, console `3001`.
- GitHub repository `prishanmaduka/educo`. The workflows reference role ARNs only as `vars.*`, never `secrets.*`. Variable names:
  - AWS roles: `AWS_STAGING_DEPLOY_ROLE_ARN`, `AWS_STAGING_PLAN_ROLE_ARN`, `AWS_STAGING_APPLY_ROLE_ARN`, `AWS_TOOLING_PLAN_ROLE_ARN`;
  - Terraform state and DNS (Task 8 fix round 1): `TF_STATE_BUCKET`, `TF_LOCK_TABLE`, `TF_STATE_KMS_KEY_ARN`, `TF_GLOBAL_STATE_READ_ROLE_ARN`, `TF_STAGING_STATE_READ_ROLE_ARN`, `TF_STAGING_STATE_RW_ROLE_ARN`, `TF_DNS_READ_ROLE_ARN`, `TF_STAGING_DNS_WRITE_ROLE_ARN`;
  - Sentry (public DSNs): `SENTRY_DSN_STAFF`, `SENTRY_DSN_CONSOLE`;
  - store uploads: `IOS_UPLOAD_ENABLED`, `PLAY_UPLOAD_ENABLED`.

**Terraform style**
- Versions: `required_version = "1.16.5"`, `hashicorp/aws = "6.67.0"`, `hashicorp/random = "3.9.1"`, and no other providers.
- Each module has `versions.tf`, `main.tf` (split by concern when a file passes about 250 lines), `variables.tf` (every variable has a type and description), `outputs.tf` and `tests/<module>.tftest.hcl`.
- IAM policies are `jsonencode(...)` locals, not `data "aws_iam_policy_document"`, so mocked tests can assert on them.
- Tests use `command = apply` with mock providers loaded from `infra/tests/mocks/` (Task 8).

**Spec rules**
- Spec wins. Each task appends its own sentences to decision row **D28** in `docs/spec/02-architecture.md` in the same commit. Task 1 creates the row; Task 16 tidies it.
- A new environment variable goes into the spec 02 table, `.env.example` (same order) and `apps/api/src/config.ts` (or `NOT_READ_BY_THE_API`) in one commit. The parity tests enforce this.
- `pnpm verify` stays green after every task. CI on this branch stays green. No workflow may fail on this branch or on `main` while the AWS accounts are missing.
- Do not tick M0b in spec 18.

## Review Focus

1. **Direct requests to the ALB.** A request to `origin.staging.quad-edu.com` without the origin header, or with a wrong value, gets 403 from the listener default. No rule forwards without the header. Owners:
   - Task 10: the `terraform test` checks that every listener rule carries the header condition and that the default is a fixed 403.
   - Task 6: the smoke `--origin` check.
2. **Spoofed `X-Forwarded-For` behind two proxies.** With `TRUST_PROXY_HOPS=2`, a client sending `X-Forwarded-For: 6.6.6.6` is seen as the viewer IP that CloudFront appended (`203.0.113.7`), not as `6.6.6.6` and not as the CloudFront edge IP. Task 3 owns the test.
3. **SNS messages with a valid signature that we didn't ask for.** Three cases must be refused with 403, without fetching `SubscribeURL` and without writing a row:
   - a correctly signed message from another topic;
   - a `SigningCertURL` on a host other than `sns.<region>.amazonaws.com`;
   - a `SignatureVersion` of `1`.

   Task 4 owns the test.
4. **A failed one-off task stops the deploy.** Each of these makes `taskOutcome` report failure, and the workflow stops before any service is updated:
   - a migrate task whose container exits non-zero;
   - a task that never starts (no `exitCode`, `stoppedReason` set);
   - a `run-task` call with `failures`.

   Task 15 owns the tests and the job ordering assertion.
5. **The workflows on `main` before the accounts exist.** Every job in `deploy-staging.yml`, and the plan and apply jobs in `infra.yml`, have a job-level `if` on the matching `vars.*` value. They are skipped, not failed, and no workflow references `secrets.AWS_*`. Task 15's workflow test owns it.

---

### Task 1: Terraform toolchain, offline mirror and the infra check runner

**Files:**
- Create:
  - `infra/toolchain.json` and `infra/.terraform-version` (`1.16.5`);
  - `infra/.tflint.hcl` and `infra/.checkov.yaml`;
  - `scripts/terraform-mirror.mjs` and `scripts/infra-check.mjs`;
  - `scripts/test/terraform-mirror.test.ts` and `scripts/test/infra-check.test.ts`.
- Modify:
  - `.gitignore` (`.cache/`, `**/.terraform/`, `infra/modules/**/.terraform.lock.hcl`, `*.tfstate*`, `*.tfplan`);
  - root `package.json` (scripts `infra:tools`, `infra:check`);
  - `docs/spec/02-architecture.md` (two Root scripts rows, and create decision row D28).

**Interfaces:**
- Produces:
  - `infra/toolchain.json`:
    ```json
    {
      "terraform": { "version": "1.16.5", "sumsSha256": "<sha256 of terraform_1.16.5_SHA256SUMS>" },
      "providers": [
        { "source": "hashicorp/aws", "version": "6.67.0", "sumsSha256": "…" },
        { "source": "hashicorp/random", "version": "3.9.1", "sumsSha256": "…" }
      ],
      "platforms": ["linux_amd64", "darwin_arm64"]
    }
    ```
  - Exports of `scripts/terraform-mirror.mjs`:
    - `parseSha256Sums(text: string): Map<string, string>`;
    - `hostPlatform(platform: NodeJS.Platform, arch: string): string` (`linux`/`x64` → `linux_amd64`, `darwin`/`arm64` → `darwin_arm64`, `darwin`/`x64` → `darwin_amd64`, `linux`/`arm64` → `linux_arm64`; anything else throws);
    - `providerZipName(type: string, version: string, platform: string): string`;
    - `mirrorZipPath(mirrorDir: string, source: string, version: string, platform: string): string`, using the packed layout `<mirrorDir>/registry.terraform.io/<ns>/<type>/terraform-provider-<type>_<version>_<platform>.zip`;
    - `cliConfig(mirrorDir: string): string`, a `provider_installation { filesystem_mirror { path = "<mirrorDir>" include = ["registry.terraform.io/hashicorp/*"] } }` block with no `direct` block.
  - CLI behaviour of `node scripts/terraform-mirror.mjs`:
    - downloads with `curl -fsSL --retry 3` (curl honours the proxy) into `.cache/terraform/`;
    - checks each `SHA256SUMS` file against `sumsSha256`, then each zip against its `SHA256SUMS` line;
    - unzips terraform to `.cache/terraform/bin/terraform`;
    - places provider zips for every platform in `platforms` plus the host platform;
    - writes `.cache/terraform/terraformrc`.
  - Flags of `node scripts/terraform-mirror.mjs`:
    - `--print-env` prints `export PATH=…/.cache/terraform/bin:$PATH` and `export TF_CLI_CONFIG_FILE=…/terraformrc`;
    - `--record` writes the observed `sumsSha256` values. Use it once, in this task.
  - Exports of `scripts/infra-check.mjs`:
    - `INFRA_ROOTS = ['infra/bootstrap', 'infra/envs/global', 'infra/envs/staging']`;
    - `INFRA_MODULES = ['infra/modules/network', 'infra/modules/data', 'infra/modules/edge', 'infra/modules/dns', 'infra/modules/app']`;
    - `infraEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv` (drops every key starting `AWS_`, sets `AWS_EC2_METADATA_DISABLED=true` and `TF_IN_AUTOMATION=1`);
    - `checkSteps(dirs: string[], tools: { tflint: boolean; checkov: boolean }): Step[]`.
  - Steps that `checkSteps` produces, in order:
    1. `terraform fmt -check -recursive infra`;
    2. for each existing dir: `terraform -chdir=<dir> init -backend=false -input=false`, then `validate`, then `test` when `<dir>/tests` exists;
    3. `tflint --init` and `tflint --recursive --config <abs>/infra/.tflint.hcl` when tflint is on `PATH`;
    4. `checkov -d infra --config-file infra/.checkov.yaml` when checkov is on `PATH`.
  - CLI of `node scripts/infra-check.mjs [--only <dir>]`:
    - exits 1 with "Run `pnpm infra:tools` and eval its `--print-env` output first." when `terraform` is missing;
    - skips missing scanners with a warning, unless `QUAD_REQUIRE_INFRA_TOOLS=1`, which makes a missing scanner a failure;
    - passes on directories that don't exist yet, so it works before Tasks 8–13.
  - `infra/.tflint.hcl`: `plugin "aws" { enabled = true, version = "<latest 0.x>", source = "github.com/terraform-linters/tflint-ruleset-aws" }` plus `config { call_module_type = "local" }`.
  - `infra/.checkov.yaml`: `framework: [terraform]`, `quiet: true`, and a `skip-check` list. It starts empty. Later tasks add entries, each with a `# reason` comment.

Steps:
- [ ] **Step 1: Write failing tests.**
  - In `terraform-mirror.test.ts`:
    - `parseSha256Sums('abc  terraform_1.16.5_linux_amd64.zip\n')` maps the name to `abc`;
    - `hostPlatform('darwin', 'arm64') === 'darwin_arm64'`, and `hostPlatform('win32', 'x64')` throws;
    - `mirrorZipPath('/m', 'hashicorp/aws', '6.67.0', 'linux_amd64')` equals `/m/registry.terraform.io/hashicorp/aws/terraform-provider-aws_6.67.0_linux_amd64.zip`;
    - `cliConfig('/m')` contains `filesystem_mirror` and `/m` and does not contain `direct`;
    - `infra/.terraform-version` equals `toolchain.json`'s terraform version;
    - every `required_version` and provider `version` in `infra/**/versions.tf` (once files exist) equals the toolchain pins.
  - In `infra-check.test.ts`:
    - `infraEnv({ AWS_ACCESS_KEY_ID: 'x', AWS_PROFILE: 'p', PATH: '/bin' })` equals `{ PATH: '/bin', AWS_EC2_METADATA_DISABLED: 'true', TF_IN_AUTOMATION: '1' }`;
    - `checkSteps(['infra/modules/network'], { tflint: false, checkov: false })` starts with the fmt step and includes `init -backend=false`;
    - the tflint step appears only when `tflint: true`.
- [ ] **Step 2: Run them to see them fail.** Run `pnpm --filter @quad/scripts test`. Expected: FAIL (modules not found).
- [ ] **Step 3: Implement both scripts.** Both are strict `checkJs` `.mjs` like `scripts/verify.mjs`, and export pure functions plus an `isMain` CLI.
- [ ] **Step 4: Record and verify the toolchain.** Run `node scripts/terraform-mirror.mjs --record && node scripts/terraform-mirror.mjs && eval "$(node scripts/terraform-mirror.mjs --print-env)" && terraform version`. Expected: `Terraform v1.16.5`. A second run without `--record` re-verifies and downloads nothing.
- [ ] **Step 5: Try the scanners.**
  - checkov: `python3 -m venv .cache/checkov && .cache/checkov/bin/pip install checkov==3.3.25 && .cache/checkov/bin/checkov --version`. Expected: `3.3.25`.
  - tflint: try the Docker Hub mirror. If no tflint binary with the AWS plugin can be fetched (GitHub releases are blocked), record "tflint runs in CI only" for `infra/README.md`.
- [ ] **Step 6: Run the checks.** Run `pnpm --filter @quad/scripts test && pnpm lint && pnpm typecheck && node scripts/infra-check.mjs`. Expected: PASS; infra-check reports the `fmt` step only, since there are no dirs yet.
- [ ] **Step 7: Create D28.** Its first sentences: Terraform 1.16.5, `hashicorp/aws` 6.67.0 and `hashicorp/random` 3.9.1 are pinned in `infra/toolchain.json`. `scripts/terraform-mirror.mjs` builds a checksum-verified provider mirror from `releases.hashicorp.com`. Lock files carry `h1:` hashes for `linux_amd64` and `darwin_arm64`. `pnpm infra:check` is not part of `pnpm verify`; `infra.yml` runs it.
- [ ] **Step 8: Commit.** Message: `build(infra): pinned Terraform toolchain, offline provider mirror and infra check runner`.

### Task 2: API image entry points: database bootstrap, migrate, seed and worker health

**Files:**
- Create:
  - `packages/db/src/bootstrap.ts` and `packages/db/src/admin.ts` (the `@quad/db/admin` entry);
  - `packages/db/test/bootstrap.api.test.ts`;
  - `apps/api/src/cli/{migrate.ts,seed.ts,db-bootstrap.ts,worker-health.ts}`;
  - `apps/api/src/worker/heartbeat.ts`;
  - `apps/api/scripts/copy-migrations.mjs`;
  - `apps/api/test/{heartbeat.test.ts,cli.test.ts}`.
- Modify:
  - `packages/db/package.json` (`exports["./admin"]`);
  - `packages/db/src/migrate.ts` (`runMigrations(ownerUrl, migrationsFolder = MIGRATIONS_FOLDER)`);
  - `packages/config/eslint/rules/no-raw-db-client.mjs` and its tests;
  - `apps/api/tsup.config.ts` (entries), `apps/api/package.json` (`build`), `apps/api/scripts/check-dist.mjs`;
  - `apps/api/src/worker/run.ts` (start the heartbeat);
  - `apps/api/src/config.ts` (`NOT_READ_BY_THE_API` += `DATABASE_ADMIN_URL`);
  - `.env.example`, `.github/workflows/ci.yml` (env `DATABASE_ADMIN_URL`);
  - `docs/spec/02-architecture.md` (Database row: `DATABASE_ADMIN_URL`; D28).

**Interfaces:**
- Consumes: `databaseUrls()`, `runMigrations`, `seedDatabase` and `SEED_TENANTS` from `@quad/db/internal`.
- Produces:
  - `@quad/db/admin` exports `runMigrations`, `seedDatabase`, `bootstrapRoles`, `databaseUrls` and `MIGRATIONS_FOLDER`. ESLint `quad/no-raw-db-client` allows `@quad/db/admin` only in `packages/db/**` and `apps/api/src/cli/**`.
  - Role bootstrap:
    ```ts
    interface RoleCredentials { readonly name: string; readonly password: string }
    function bootstrapRoles(adminUrl: string, roles: { owner: RoleCredentials; app: RoleCredentials; platform: RoleCredentials }, database: string): Promise<void>
    ```
    It is idempotent and runs as the RDS master user (or the local `postgres` superuser). It mirrors `docker/postgres/init/01-roles.sql`:
    - creates the roles if missing: owner `NOBYPASSRLS`, app `NOBYPASSRLS`, platform `BYPASSRLS`;
    - always runs `ALTER ROLE … PASSWORD` with `client.escapeLiteral`;
    - `GRANT <owner> TO current_user`, then makes the owner own the database and `public`;
    - revokes `CONNECT` from `PUBLIC` and grants it to the three roles;
    - grants `USAGE` on `public` to app and platform;
    - creates `pg_trgm` and `citext`;
    - sets the default privileges for owner → platform.

    Afterwards it reads `pg_roles` and throws `Error('quad_platform must have BYPASSRLS …')` or `Error('quad_app must not have BYPASSRLS …')` if either attribute is wrong.
  - New variable `DATABASE_ADMIN_URL` (spec 02 → Database: "the RDS master user, used only by the db-bootstrap task"). The local value in `.env.example` and CI is `postgres://postgres:postgres@localhost:5432/quad`.
  - `apps/api/dist` gains `migrate.js`, `seed.js`, `db-bootstrap.js` and `worker-health.js`, plus `dist/migrations/**`, which `copy-migrations.mjs` copies from `packages/db/migrations`. `check-dist.mjs` fails if `dist/migrations/meta/_journal.json` is missing.
  - CLI behaviour:
    - `migrate.js` takes `DATABASE_OWNER_URL` and runs `runMigrations(url, resolve(__dirname, 'migrations'))`;
    - `seed.js` refuses `APP_ENV=production` with exit 1;
    - `db-bootstrap.js` reads the role names and passwords from the user and password in `DATABASE_OWNER_URL`, `DATABASE_URL` and `DATABASE_PLATFORM_URL`, and the database name from `DATABASE_OWNER_URL`'s path;
    - each prints one line and exits 0 on success, or exits 1 with the error message and no URL or password.
  - CLI helpers, exported for the tests: `parseRoleFromUrl(url: string): RoleCredentials` (URL-decoded user and password) and `seedRefusal(appEnv: string | undefined): string | null`.
  - Worker heartbeat:
    - `startHeartbeat(redis: Redis, key: string, options?: { intervalMs?: number; ttlSeconds?: number }): () => void` sets `key` to the current ISO time with `EX ttlSeconds` (default 60) every `intervalMs` (default 15 000). It returns `stop`.
    - The key is `heartbeatKey(host: string) = 'quad:worker:heartbeat:' + host`; the worker uses `os.hostname()`.
    - `worker-health.js` exits 0 when `heartbeatKey(os.hostname())` exists, and exits 1 otherwise or after 3 s.

Steps:
- [ ] **Step 1: Write failing tests.**
  - `bootstrap.api.test.ts`, as the compose superuser on a fresh database with roles named `qbt_owner_<rand>`, `qbt_app_<rand>` and `qbt_platform_<rand>` (dropped in `afterAll`):
    - after two runs, `rolbypassrls` is false for owner and app and true for platform;
    - the app role can connect with its password;
    - the database owner is the owner role;
    - a second run with a changed app password lets the app role connect with the new one.
  - `cli.test.ts`:
    - `parseRoleFromUrl('postgres://quad_app:p%40ss@h:5432/quad')` gives `{ name: 'quad_app', password: 'p@ss' }`;
    - `seedRefusal('production')` returns the refusal message;
    - a built `dist/migrations/meta/_journal.json` exists after `pnpm --filter @quad/api build`.
  - `heartbeat.test.ts`, with a fake Redis recording `set` calls and Vitest fake timers: the key `quad:worker:heartbeat:host-a` is set with `EX 60` at start and again after 15 s, and `stop()` ends the calls.
  - `rules.test.ts`: `import { runMigrations } from '@quad/db/admin'` is invalid in `apps/api/src/modules/x.ts` and valid in `apps/api/src/cli/migrate.ts`.
- [ ] **Step 2: Run them to see them fail.** Run `pnpm --filter @quad/db test:api && pnpm --filter @quad/api test && pnpm --filter @quad/config test`. Expected: FAIL.
- [ ] **Step 3: Implement.** Keep the D24 grant rules exactly. `bootstrapRoles` must not grant `quad_app` any default privileges.
- [ ] **Step 4: Run the checks.** Run `pnpm --filter @quad/api build && (cd apps/api && node dist/migrate.js)` with `DATABASE_OWNER_URL` exported from `.env.example`'s value. Expected: `Migrations applied.` Then run `pnpm verify`. Expected: PASS.
- [ ] **Step 5: Add to D28.** Add these points:
  - the api image runs `dist/{main,worker,migrate,seed,db-bootstrap,worker-health}.js`;
  - migrations ship in `dist/migrations`;
  - `DATABASE_ADMIN_URL` is used only by db-bootstrap;
  - `@quad/db/admin` is allowed only in `apps/api/src/cli/**`;
  - the worker heartbeat key is `quad:worker:heartbeat:<hostname>` with a 60 s TTL.
- [ ] **Step 6: Commit.** Message: `feat(api): database bootstrap, migrate and seed commands and worker heartbeat for the api image`.

### Task 3: Edge-facing behaviour: proxy hops, noindex, web health and the realtime handshake

**Files:**
- Create:
  - `apps/api/src/realtime/{realtime.module.ts,realtime.service.ts}`;
  - `apps/api/test/realtime.test.ts` and `apps/api/test/robots.test.ts`;
  - `apps/{staff,console}/src/middleware.ts`;
  - `apps/{staff,console}/src/app/healthz/route.ts`;
  - `apps/{staff,console}/e2e/healthz.spec.ts`.
- Modify:
  - `apps/api/test/proxy.test.ts`;
  - `apps/api/src/app.ts` (`onSend` robots hook), `apps/api/src/app.module.ts`, `apps/api/package.json`;
  - `packages/contracts/src/web-env.ts` and `web-env.test.ts`.

**Interfaces:**
- Produces:
  - `robotsTagFor(appEnv: string | undefined, surface: 'staff' | 'api' | 'console'): string | null`, exported from `@quad/contracts/web-env`. It returns `'noindex, nofollow'` for `console` in every environment and for `staff`/`api` when `appEnv === 'staging'`; otherwise it returns `null`.
  - **API:** an `onSend` hook sets `X-Robots-Tag` from `robotsTagFor(config.APP_ENV, 'api')`.
  - **staff and console:**
    - `middleware.ts` (with `export const config = { runtime: 'nodejs', matcher: '/:path*' }`) sets the header from `robotsTagFor(process.env.APP_ENV, …)`. `APP_ENV` is read at runtime, not `NEXT_PUBLIC_APP_ENV`.
    - `GET /healthz` returns `200 {"status":"ok"}` with `cache-control: no-store`.
  - **Realtime:** `RealtimeService` (`OnApplicationBootstrap`, `OnApplicationShutdown`) attaches `new Server(httpServer, { path: '/socket.io', serveClient: false })` through `HttpAdapterHost`.
    - It accepts connections and joins no rooms.
    - M1 adds the auth middleware; M6 adds the Redis adapter.
    - It closes on shutdown.

Steps:
- [ ] **Step 1: Write failing tests.**
  - `proxy.test.ts`: add `it('with TRUST_PROXY_HOPS=2 (CloudFront + ALB) the client is the viewer CloudFront appended')`:
    - socket `10.0.1.5`;
    - `x-forwarded-for: '6.6.6.6, 203.0.113.7, 130.176.0.1'`;
    - expected `{ ip: '203.0.113.7' }` (Review Focus #2).

    This closes the D27 follow-up.
  - `robots.test.ts`: `/api/v1/health/live` has `x-robots-tag: noindex, nofollow` with `APP_ENV=staging` and no such header with `APP_ENV=local`.
  - `realtime.test.ts`, with the app listening on `127.0.0.1:0`:
    - `GET /socket.io/?EIO=4&transport=polling` returns 200 with a body starting `0{` and containing `"sid"`;
    - a Node `WebSocket` to `ws://…/socket.io/?EIO=4&transport=websocket` receives a first message starting `0{`.
  - `web-env.test.ts`: the `robotsTagFor` table (console in local → noindex; staff in production → null; staff in staging → noindex).
  - `healthz.spec.ts`: `GET /healthz` gives 200 with `{ status: 'ok' }`.
- [ ] **Step 2: Run them to see them fail.** Run `pnpm --filter @quad/api test && pnpm --filter @quad/contracts test`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Add `socket.io` 4.8.4 to `apps/api` dependencies so `check-dist` keeps it external.
  - Keep the OpenAPI route test green: `/socket.io` is served by Engine.IO, not by a Fastify route.
- [ ] **Step 4: Run the checks.** Run `pnpm verify`. Expected: PASS (the e2e smoke includes the healthz specs).
- [ ] **Step 5: Add to D28.** Add these points:
  - `TRUST_PROXY_HOPS=2` on AWS, tested;
  - `X-Robots-Tag: noindex, nofollow` on staging for staff and API (runtime `APP_ENV`) and on the console in every environment;
  - `/healthz` for staff and console;
  - the Socket.IO server accepts the handshake now; auth is M1 and the Redis adapter is M6.
- [ ] **Step 6: Commit.** Message: `feat(api,web): two-hop proxy trust, staging noindex, web health route and the realtime handshake`.

### Task 4: SES bounce and complaint webhook

Follow `quad-api-endpoint` and `quad-tenant-table`. This is a tenant-less route with **no** tenant at all, like demo requests. `@Can` is not applicable: the SNS signature is the check. M1's global guard must mark the route public.

**Files:**
- Create:
  - `packages/contracts/src/webhooks/ses.ts` and its test;
  - `packages/db/src/schema/platform/email-suppressions.ts`;
  - `packages/db/migrations/0001_email_suppressions.sql` (generated, plus hand-added function SQL);
  - `packages/db/src/definers.ts` and `packages/db/test/email-suppressions.api.test.ts`;
  - `apps/api/src/database/database.module.ts`;
  - `apps/api/src/webhooks/ses/{ses-webhook.module.ts,ses-webhook.controller.ts,ses-webhook.service.ts,sns-signature.ts,ses-webhook.routes.ts}`;
  - `apps/api/test/webhooks/{sns-signature.test.ts,ses-webhook.api.test.ts}`.
- Modify:
  - `packages/db/src/{db.ts,index.ts,platform-tables.ts}`;
  - `apps/api/src/{tokens.ts,app.module.ts,config.ts,openapi/document.ts}`;
  - `.env.example`;
  - `docs/spec/02-architecture.md` (Email row `SES_SNS_TOPIC_ARN`; a D16 table row; D28);
  - `docs/spec/06-api-and-events.md` (the route line);
  - the generated clients, through `pnpm api:client`.

**Interfaces:**
- Produces:
  - **Table** `email_suppressions` (platform, spec 04): `address citext primary key`, `reason email_suppression_reason not null` (enum `bounce`, `complaint`, `manual`), `source text not null`, `at timestamptz not null default now()`. Add it to `PLATFORM_TABLES`. `quad_app` gets no table privilege.
  - **Function** `record_email_suppression(p_address citext, p_reason email_suppression_reason, p_source text) returns void`:
    - `SECURITY DEFINER`, `SET search_path = public, pg_temp`, owned by `quad_owner`;
    - upserts on `address`, setting `reason`, `source` and `at = now()`;
    - `REVOKE ALL … FROM PUBLIC; GRANT EXECUTE … TO quad_app`.
  - **Definer calls:** `QuadTenantDb.definers: DefinerCalls`, with
    ```ts
    interface DefinerCalls { recordEmailSuppression(input: { address: string; reason: 'bounce' | 'complaint' | 'manual'; source: string }): Promise<void> }
    ```
    The named security-definer calls run on the `quad_app` pool without a tenant (D16 pattern; M1 adds `authMemberships` here).
  - **Nest wiring:** `DatabaseModule` provides `TENANT_DB` (`QuadTenantDb` from `createTenantDb({ appUrl: config.DATABASE_URL, poolMax: config.DATABASE_POOL_MAX })`) and closes it on shutdown.
  - **New variable:** `SES_SNS_TOPIC_ARN` (spec 02 Email row: "the SNS topic whose SES bounce and complaint events the webhook accepts"). It is validated as `arn:aws:sns:<region>:<12 digits>:<name>`. When it is unset, the webhook refuses every message.
  - **Contract** (`SnsEnvelopeSchema`): `{ Type: 'Notification' | 'SubscriptionConfirmation' | 'UnsubscribeConfirmation', MessageId, TopicArn, Message, Timestamp, SignatureVersion, Signature, SigningCertURL, Subject?, SubscribeURL?, Token? }`. `SesWebhookAck = { status: 'ok' }`.
  - **Signature checks:**
    - `canonicalSnsString(msg: SnsEnvelope): string` follows the AWS field order: Notification uses `Message, MessageId, Subject?, Timestamp, TopicArn, Type`; the confirmations use `Message, MessageId, SubscribeURL, Timestamp, Token, TopicArn, Type`. Each field is written as `key\nvalue\n`.
    - `isAwsSnsUrl(url: string): boolean` requires `https:` and a host matching `^sns\.[a-z0-9-]+\.amazonaws\.com$`.
    - `verifySnsSignature(msg, getKey: (certUrl: string) => Promise<string>): Promise<boolean>` accepts only `SignatureVersion === '2'` (SHA256withRSA). The key is a PEM certificate or public key, cached per URL for 24 h, at most 10 entries.
    - Injection tokens in `tokens.ts`: `SNS_KEY_FETCHER` (`(certUrl) => Promise<string>`; by default an HTTPS GET of the cert) and `SNS_SUBSCRIBE_FETCHER` (`(url) => Promise<void>`; by default a GET). Tests override both.
  - **Route** `POST /api/v1/webhooks/ses`:
    - accepts `text/plain` (what SNS sends) or `application/json`; a body that isn't JSON → 400 `validation`;
    - a bad or missing signature, a wrong topic or a non-AWS URL → 403 `forbidden`, with nothing fetched or written;
    - `SubscriptionConfirmation` → GET `SubscribeURL` (only when `isAwsSnsUrl`), then 200;
    - `Notification` carrying an SES event (`eventType` or `notificationType`):
      - `Bounce` with `bounceType: 'Permanent'` → one suppression per `bouncedRecipients[].emailAddress`, reason `bounce`;
      - `Complaint` → reason `complaint` for each `complainedRecipients`;
      - transient bounces and other events → 200 with no write;
    - `source` is `'ses'`.

Steps:
- [ ] **Step 1: Write failing tests.**
  - Contract test: a sample SNS envelope parses, and `Type: 'Other'` fails at `Type`.
  - `sns-signature.test.ts` (unit):
    - sign a canonical string with an RSA key from `generateKeyPairSync`;
    - `verifySnsSignature` is true with the matching public key and false after changing `Message`;
    - `SignatureVersion '1'` is false;
    - `isAwsSnsUrl('https://sns.ap-south-1.amazonaws.com/x.pem')` is true; `http://…`, `https://sns.ap-south-1.amazonaws.com.evil.io/x.pem` and `https://evil.io/` are false.
  - `ses-webhook.api.test.ts`, with the key getter and SubscribeURL fetcher injected through the module's providers:
    - a permanent bounce for `a@example.com` writes reason `bounce`;
    - replaying it keeps one row;
    - a complaint changes the reason to `complaint`;
    - a transient bounce writes nothing;
    - a confirmation from the configured topic calls the fetcher once;
    - Review Focus #3: another topic, a non-AWS cert URL or version `1` → 403, no fetch, no row;
    - a non-JSON body → 400 `validation`;
    - the tenant-less check: as `quad_app`, `select * from email_suppressions` fails with permission denied.
  - `email-suppressions.api.test.ts`: the migration test (`findTenancyViolations`) reports nothing; `quad_app` can execute the function and cannot select the table.
- [ ] **Step 2: Run them to see them fail.** Run `pnpm --filter @quad/contracts test && pnpm --filter @quad/api test && pnpm test:api`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Run `pnpm db:generate`, then append the function SQL to `0001_email_suppressions.sql`.
  - Declare the route in `ses-webhook.routes.ts`, list it in `API_ROUTES`, and run `pnpm api:client`.
- [ ] **Step 4: Run the checks.** Run `pnpm db:migrate && pnpm verify`. Expected: PASS, including `codegen:check`.
- [ ] **Step 5: Update the spec.**
  - Spec 02, D16 table: add the row "SES bounce and complaint webhook | No tenant: SNS signature (version 2) and topic checked first, then the platform table `email_suppressions` through `record_email_suppression`".
  - Spec 06: add `POST /webhooks/ses` next to the payment webhooks.
  - D28: the route lives in `apps/api/src/webhooks/ses` (spec 05) and writes through the security-definer function, because `withPlatform` is restricted to the platform folders.
- [ ] **Step 6: Commit.** Message: `feat(api): SES bounce and complaint webhook with SNS signature checks and email suppressions`.

### Task 5: Sentry and OpenTelemetry in the API, worker and web apps

**Files:**
- Create:
  - `apps/api/src/observability/{sentry.ts,tenant-span-processor.ts}`;
  - `apps/api/src/cli/sentry-test.ts`;
  - `apps/api/test/{sentry.test.ts,tenant-span.test.ts}`;
  - `packages/contracts/src/observability/sentry-scrub.ts` and its test;
  - `apps/{staff,console}/src/{instrumentation.ts,instrumentation-client.ts}`.
- Modify:
  - `apps/api/src/{main.ts,worker.ts,observability/tracing.ts,common/error.filter.ts,app.ts}`;
  - `apps/api/tsup.config.ts` (`sentry-test` entry), `apps/api/package.json`;
  - `apps/{staff,console}/next.config.ts` (`withSentryConfig`), `apps/{staff,console}/package.json`;
  - `packages/contracts/src/index.ts`.

**Interfaces:**
- Produces:
  - `scrubSentryEvent<T extends ScrubbableEvent>(event: T): T`, where `ScrubbableEvent` is a structural type with optional `request` and `user`. It:
    - deletes `request.data`, `request.cookies` and `request.query_string`;
    - keeps only the `user-agent` request header;
    - reduces `user` to `{ id }`.
  - The API error reporter:
    ```ts
    interface ErrorReporter { capture(error: unknown): void; flush(timeoutMs: number): Promise<boolean> }
    function initErrorReporting(config: Pick<Config, 'SENTRY_DSN' | 'SENTRY_ENVIRONMENT' | 'SENTRY_RELEASE' | 'APP_ENV'>, service: 'api' | 'worker'): ErrorReporter
    ```
    - It is a no-op when `SENTRY_DSN` is unset.
    - Otherwise it calls `@sentry/node` `init` with `skipOpenTelemetrySetup: true`, `sendDefaultPii: false`, `tracesSampleRate: 0`, `environment: SENTRY_ENVIRONMENT ?? APP_ENV`, `release: SENTRY_RELEASE` and `beforeSend: scrubSentryEvent`.
  - `AppErrorFilter(logger, reporter = NO_OP_REPORTER)` calls `reporter.capture(error)` only for the 500 `internal` path.
  - `TenantSpanProcessor implements SpanProcessor`: `onStart` sets `tenant_id` from `currentRequestContext()?.tenantId` when it is non-null. `startTracing` passes `spanProcessors: [new TenantSpanProcessor(), new BatchSpanProcessor(exporter)]`. Sampling stays at 100% (staging volume). Tail sampling is M12.
  - `dist/sentry-test.js`:
    - exits 1 with "The Sentry test error is not sent in production." when `APP_ENV=production`;
    - exits 1 with "SENTRY_DSN is not set." when unset;
    - otherwise captures `new Error('Quad Sentry test error (<service>, <APP_ENV>)')`, flushes for 5 s, prints the event id and exits 0.
    - The logic is `runSentryTest(config: Config, makeReporter = initErrorReporting): Promise<{ code: 0 | 1; message: string }>`; the CLI prints `message` and exits with `code`.
  - Web apps:
    - `instrumentation.ts` `register()`, in the Node runtime: `@sentry/nextjs` `init` from runtime `SENTRY_DSN`/`SENTRY_ENVIRONMENT`/`APP_ENV` with `skipOpenTelemetrySetup: true` and the scrub, then `registerOTel({ serviceName: OTEL_SERVICE_NAME ?? 'quad-staff' | 'quad-console' })` from `@vercel/otel` only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set;
    - `instrumentation-client.ts` calls `init` from `NEXT_PUBLIC_SENTRY_DSN`, with no replay and the scrub;
    - `withSentryConfig(config, { silent: true, telemetry: false, sourcemaps: { disable: true } })`.

Steps:
- [ ] **Step 1: Write failing tests.**
  - `sentry-scrub.test.ts`: an event with `request.data`, cookies, `authorization` and `user.email` keeps only the `user-agent` header and `user.id`.
  - `sentry.test.ts`:
    - `initErrorReporting({ APP_ENV: 'local' }, 'api')` is a no-op whose `flush` resolves true;
    - the filter with a fake reporter captures an unexpected `Error` once and does not capture `NotFoundError`;
    - `runSentryTest({ APP_ENV: 'production', … })` returns exit code 1 with the production message.
  - `tenant-span.test.ts`, with `BasicTracerProvider`, `InMemorySpanExporter` and `TenantSpanProcessor`:
    - a span started inside `runWithRequestContext`, after setting `tenantId = SEED_TENANTS[0].id`, has `tenant_id` equal to that id;
    - a span outside any request has no `tenant_id`.
- [ ] **Step 2: Run them to see them fail.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Add `@sentry/node` and `@opentelemetry/sdk-trace-base` (the version `sdk-node` already resolves) to `apps/api` dependencies.
  - Add `@sentry/nextjs` and `@vercel/otel` to both web apps.
  - Keep the existing tracing tests green.
- [ ] **Step 4: Run the checks.** Run `pnpm verify && pnpm build`. Expected: PASS. `check-dist` still passes and `pnpm audit --prod --audit-level high` is clean. If a new dependency fails the audit, add a pinned override with a D28 note, the way D27 did.
- [ ] **Step 5: Add to D28.** Add these points:
  - Sentry SDKs run with `skipOpenTelemetrySetup`, so traces go only through OpenTelemetry;
  - staging samples 100% and the 10%/errors/slow tail sampling is set up with production in M12;
  - scrubbing is shared through `@quad/contracts`;
  - `dist/sentry-test.js` is the test-error path (never in production);
  - web source map upload is deferred.
- [ ] **Step 6: Commit.** Message: `feat(observability): Sentry error reporting and tenant-tagged OpenTelemetry spans for api, worker and web`.

### Task 6: Smoke checks script

**Files:**
- Create: `scripts/smoke.mjs` and `scripts/test/smoke.test.ts`.
- Modify: root `package.json` (`"smoke": "node scripts/smoke.mjs"`) and spec 02 Root scripts (one row).

**Interfaces:**
- Produces:
  - `parseSmokeArgs(argv: string[]): SmokeOptions`, where
    ```ts
    SmokeOptions = { web: string; console: string; api: string; origin?: string; robots: 'noindex' | 'indexable' | 'ignore'; timeoutMs: number }
    ```
    - `--api` defaults to `--web`;
    - `--expect-noindex` sets `robots: 'noindex'`, `--expect-indexable` sets `'indexable'`, and the default is `'ignore'`;
    - `timeoutMs` is 10 000.
  - `runSmoke(options, deps: { fetch: typeof fetch; openWebSocket: (url: string) => Promise<string> }): Promise<SmokeResult[]>` runs these checks in order:
    1. `ready`: `GET {api}/api/v1/health/ready` → 200 with JSON `status: 'ok'`.
    2. `landing`: `GET {web}/` → 200 with `content-type` starting `text/html`.
    3. `portal`: `GET {web}/app` (no redirect follow) → 200 HTML, or 302/303/307 to a path starting `/sign-in`.
    4. `console`: `GET {console}/` → 200 HTML.
    5. `robots`: for checks 1–4, `x-robots-tag` contains `noindex` (noindex mode) or is absent (indexable mode).
    6. `websocket`: the first message on `ws(s)://{api host}/socket.io/?EIO=4&transport=websocket` starts with `0{` and contains `"sid"`.
    7. `origin-refused` (only with `--origin`): `GET {origin}/api/v1/health/live` → 403.
  - `SmokeResult = { name: string; ok: boolean; detail: string }`.
  - The CLI prints one line per check and exits 1 if any fails. `openWebSocket` uses Node 22's global `WebSocket`.

Steps:
- [ ] **Step 1: Write failing tests** with a fake `fetch` (a table of URL → response) and a fake socket:
  - all green → seven ok results with `--origin`, or six without;
  - `/app` 307 to `/sign-in?next=/app` → ok; 307 to `/elsewhere` → fail;
  - noindex mode with a missing header on `console` → `robots` fails and its detail names `console`;
  - a socket first message `40` → `websocket` fails;
  - origin 200 → `origin-refused` fails (Review Focus #1).
- [ ] **Step 2: Run them to see them fail.** Run `pnpm --filter @quad/scripts test`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the checks.** Start `pnpm dev` (API on :4000, staff on :3000, console on :3001), then run `node scripts/smoke.mjs --web http://localhost:3000 --api http://localhost:4000 --console http://localhost:3001`. Expected: six ok lines and exit 0. The console robots header is present but not checked in ignore mode.
- [ ] **Step 5: Commit.** Message: `feat(scripts): smoke checks for health, shells, noindex, websocket and origin refusal`.

### Task 7: Container images and the local image smoke test

**Files:**
- Create:
  - `.dockerignore`;
  - `docker/api.Dockerfile`, `docker/web.Dockerfile` (staff and console via `ARG APP`);
  - `docker/clamav/{Dockerfile,clamd.conf,freshclam.conf}`;
  - `docker/certs/README.md`;
  - `scripts/docker-build.mjs` and `scripts/test/docker-build.test.ts`.
- Modify:
  - `apps/{staff,console}/next.config.ts` (`output: 'standalone'`, `outputFileTracingRoot` = the repository root);
  - root `package.json` (`"images:build": "node scripts/docker-build.mjs all"`), spec 02 Root scripts (a row).

**Interfaces:**
- Consumes: the dist entries from Tasks 2 and 5, `/healthz` (Task 3) and `scripts/smoke.mjs` (Task 6).
- Produces:
  - **Base images:**
    - `${QUAD_IMAGE_REGISTRY}library/node:22.23-alpine3.24` for build and runtime;
    - `${QUAD_IMAGE_REGISTRY}clamav/clamav:1.4`;
    - `ARG QUAD_IMAGE_REGISTRY=` defaults to Docker Hub.
  - **API image** (`quad/api`):
    - stages `deps` (`pnpm fetch`) → `build` (`pnpm install --offline --frozen-lockfile`, `pnpm --filter @quad/api build`, `pnpm --filter @quad/api deploy --prod /out`) → `runtime`;
    - `WORKDIR /app` holds `dist/`, `node_modules/` and `package.json`;
    - `USER node`, `ENV NODE_ENV=production`, `EXPOSE 4000`;
    - `CMD ["node","--enable-source-maps","dist/main.js"]`;
    - `HEALTHCHECK` with `node -e` fetching `http://127.0.0.1:4000/api/v1/health/live`;
    - the Amazon RDS CA bundle at `/app/certs/rds-global-bundle.pem`, via `ADD --checksum=sha256:<pinned> https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem` (the migrate and seed tasks set `NODE_EXTRA_CA_CERTS` to it);
    - commands of the same image: `node dist/worker.js`, `dist/migrate.js`, `dist/seed.js`, `dist/db-bootstrap.js`, `dist/worker-health.js`, `dist/sentry-test.js`.
  - **Web images** (`quad/staff`, `quad/console`):
    - build args `APP` (`staff`|`console`), `PORT`, `NEXT_PUBLIC_APP_ENV`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SENTRY_DSN`;
    - the runtime copies `.next/standalone`, `apps/<app>/.next/static` and `apps/<app>/public` when present;
    - `USER node`, `CMD ["node","apps/<app>/server.js"]`, `ENV HOSTNAME=0.0.0.0`;
    - `HEALTHCHECK` on `/healthz`.
  - **ClamAV image** (`quad/clamav`): the official image plus `clamd.conf` (`TCPSocket 3310`, `TCPAddr 0.0.0.0`, `StreamMaxLength 100M`, `MaxFileSize 100M`) and `freshclam.conf` (`Checks 12`). It keeps the image's own user handling. Note why in a `# hadolint ignore=DL3002`-style comment only if hadolint flags it.
  - **Build script** exports `dockerBuildCommand(image: 'api' | 'staff' | 'console' | 'clamav', env: NodeJS.ProcessEnv, options: { tag: string; push?: boolean; buildArgs?: Record<string, string> }): string[]`. It:
    - always passes `--build-arg QUAD_IMAGE_REGISTRY=$QUAD_IMAGE_REGISTRY` (empty when unset) and `--build-arg GIT_SHA`;
    - when `HTTPS_PROXY` is set, adds `--network host` and the `HTTPS_PROXY`/`https_proxy` build args;
    - when `NODE_EXTRA_CA_CERTS` points at a file, adds `--secret id=proxy_ca,src=<file>`; Dockerfile `RUN` steps that reach the network mount it at `/run/secrets/proxy_ca` with `required=false` and set `NODE_EXTRA_CA_CERTS`;
    - uses `-f docker/<file> .` and `--push` when `push`.
  - **Build CLI:** `node scripts/docker-build.mjs <image|all> [--tag <ref>] [--push] [--build-arg K=V]`. The default tag is `quad/<image>:local`.

Steps:
- [ ] **Step 1: Write failing tests** in `docker-build.test.ts`:
  - with `{ QUAD_IMAGE_REGISTRY: 'mirror.gcr.io/' }`, the api command includes `--build-arg QUAD_IMAGE_REGISTRY=mirror.gcr.io/` and `-f docker/api.Dockerfile` and does not include `--network`;
  - with `HTTPS_PROXY` and a real `NODE_EXTRA_CA_CERTS` file, it includes `--network host` and `--secret id=proxy_ca,src=…`;
  - `staff` passes `--build-arg APP=staff --build-arg PORT=3000`; `console` passes `APP=console` and `PORT=3001`.
- [ ] **Step 2: Run them to see them fail.** Expected: FAIL.
- [ ] **Step 3: Implement the script, the Dockerfiles and `.dockerignore`.**
  - `.dockerignore` excludes `.git`, every `node_modules`, `.next`, `dist`, `.turbo`, `.cache`, `.superpowers`, `design`, `docs`, `infra`, `.env*` except `.env.example`, `apps/parent/{android,ios,build,test,assets,packages}`, `coverage`, `test-results` and `playwright-report`.
  - Keep every `package.json` the lockfile names.
- [ ] **Step 3b: Check that each workspace still builds and runs outside Docker with the new Next config.** Run `pnpm build && pnpm e2e`. Expected: PASS.
- [ ] **Step 4: Lint the Dockerfiles.** Run `docker run --rm -i mirror.gcr.io/hadolint/hadolint:v2.12.0 < docker/<file>` for each. Expected: no errors (warnings fixed or ignored inline with a reason).
- [ ] **Step 5: Build the images.** Run `QUAD_IMAGE_REGISTRY=mirror.gcr.io/ node scripts/docker-build.mjs all --build-arg NEXT_PUBLIC_APP_ENV=local`. Expected: four images.
  - `docker run --rm quad/api:local id -u` prints `1000`.
  - `docker image ls quad/*` sizes are recorded in the report.
- [ ] **Step 6: Smoke the images against compose.**
  - Run `docker compose up -d postgres redis`.
  - Then `docker run --rm --network host --env-file .env.example quad/api:local node dist/migrate.js`. Expected: `Migrations applied.`
  - Start three containers:
    - `docker run -d --network host --env-file .env.example -e TRUST_PROXY_HOPS=2 quad/api:local`;
    - `docker run -d --network host -e APP_ENV=staging quad/staff:local`;
    - `docker run -d --network host -e APP_ENV=staging quad/console:local`.
  - Run `node scripts/smoke.mjs --web http://localhost:3000 --api http://localhost:4000 --console http://localhost:3001`. Expected: all ok.
  - `curl -sI http://localhost:3000/ | grep -i x-robots-tag` shows `noindex, nofollow`, proving the runtime `APP_ENV` drives the header.
  - `curl -s localhost:4000/api/v1/health/ready` shows `"status":"ok"`.
  - Stop the containers afterwards.
- [ ] **Step 7: Add to D28.** Add these points:
  - the base images are pinned;
  - web images carry `NEXT_PUBLIC_*` from build time, so M0b builds them per environment. That conflicts with spec 20's "promote by digest", and M12 decides: runtime public config, or per-environment web builds.
  - the RDS CA bundle ships in the api image.
- [ ] **Step 8: Commit.** Message: `build(images): multi-stage non-root images for api, staff, console and clamav with a local smoke test`.

### Task 8: Terraform bootstrap and global roots, with shared mocks

**Files:**
- Create:
  - `infra/bootstrap/{versions.tf,main.tf,variables.tf,outputs.tf,tests/bootstrap.tftest.hcl,.terraform.lock.hcl}`;
  - `infra/envs/global/{versions.tf,backend.tf,providers.tf,main.tf,variables.tf,outputs.tf,tests/global.tftest.hcl,.terraform.lock.hcl}`;
  - `infra/tests/mocks/aws/aws.tfmock.hcl` and `infra/tests/mocks/random/random.tfmock.hcl`.

**Interfaces:**
- Produces:
  - **bootstrap** (local state on first apply, then migrated into the bucket it creates; see the README):
    - variables `state_bucket_name` (default `quad-tfstate-tooling`), `lock_table_name` (default `quad-terraform-locks`), `trusted_account_ids` (list(string), no default);
    - resources: a KMS key (rotation on); an S3 bucket with versioning, SSE-KMS, all four public access blocks, a TLS-only policy and ownership `BucketOwnerEnforced`; a DynamoDB table (`LockID` string hash key, `PAY_PER_REQUEST`, PITR, SSE); role `quad-terraform-state` trusted by `arn:aws:iam::<id>:root` for each trusted account, allowed state-object CRUD under `*/terraform.tfstate*` and lock-table item CRUD;
    - outputs: `state_bucket`, `lock_table`, `state_role_arn`.
  - **global** (tooling account; `backend "s3" { key = "global/terraform.tfstate", region = "ap-south-1", encrypt = true }` with the bucket, table and role passed by `-backend-config`; `use_lockfile = true` alongside the DynamoDB table):
    - zone `quad-edu.com`;
    - CAA `0 issue "amazon.com"`, plus `amazontrust.com`, `awstrust.com` and `amazonaws.com`, plus `0 iodef "mailto:security@quad-edu.com"`;
    - apex MX `1 smtp.google.com` and apex TXT `v=spf1 include:_spf.google.com ~all` (Google Workspace, D19);
    - `mail.quad-edu.com` TXT `v=spf1 include:amazonses.com ~all`;
    - `_dmarc.mail.quad-edu.com` TXT `v=DMARC1; p=quarantine; rua=mailto:${var.dmarc_report_address}` (default `dmarc-reports@quad-edu.com`);
    - `bounce.mail.quad-edu.com` MX `10 feedback-smtp.ap-south-1.amazonses.com` and TXT `v=spf1 include:amazonses.com ~all`;
    - role `quad-dns-records`, trusted by `var.dns_writer_account_ids`, with `route53:ChangeResourceRecordSets`/`ListResourceRecordSets`/`GetChange`/`ListHostedZonesByName` scoped to the zone;
    - the tooling account's GitHub OIDC provider and role `quad-tooling-plan`, trusted by the subject `repo:prishanmaduka/educo:pull_request:ref:refs/pull/*` (`StringLike`, with `aud` = `sts.amazonaws.com`) and given `ReadOnlyAccess`.
  - global outputs: `zone_id`, `name_servers` (to paste at the registrar), `dns_role_arn`, `tooling_plan_role_arn`.
  - **Changed in fix round 1 (review of 519daec..0e32c20; D28 has the result):**
    - bootstrap: `trusted_account_ids` and the single `quad-terraform-state` role are replaced by `state_environments` (per environment: `plan_principal_arns`, `apply_principal_arns`) and `break_glass_principal_arns`. They create `quad-terraform-state-read-<env>` and `quad-terraform-state-rw-<env>`, each trusting the principals' account roots narrowed by `ArnEquals aws:PrincipalArn`. The bucket policy refuses uploads not encrypted with the state key, and refuses object access to everyone but the state roles and break-glass roles. Outputs: `state_bucket`, `lock_table`, `state_kms_key_arn`, `state_read_role_arns`, `state_rw_role_arns`.
    - every backend passes `-backend-config kms_key_id=<state_kms_key_arn>`; plans use the read role with `-lock=false`; applies use the rw role.
    - global: `dns_writer_account_ids` and the role `quad-dns-records` are replaced by `dns_writer_names` (per-environment name patterns; default staging `staging.quad-edu.com`, `*.staging.quad-edu.com`, `*._domainkey.mail.quad-edu.com`), `dns_writer_principal_arns` (per environment, the apply roles) and `dns_reader_principal_arns` (the plan roles). They create `quad-dns-records-<env>` (CREATE/UPSERT/DELETE of A/AAAA/CNAME within its names) and `quad-dns-read`. `quad-tooling-plan` keeps `ReadOnlyAccess` with explicit denies on state-object reads, `ssm:GetParameter*`, `secretsmanager:GetSecretValue` and `kms:Decrypt`. The mail SPF records end `-all`, and the apex has DMARC `p=none`. Outputs: `zone_id`, `name_servers`, `dns_write_role_arns`, `dns_read_role_arn`, `tooling_plan_role_arn`.
  - **Shared mocks:** `mock_resource`/`mock_data` defaults with valid formats for every attribute that feeds an ARN- or format-validated argument. Start with:
    - `aws_iam_role.arn`, `aws_iam_policy.arn`, `aws_kms_key.arn`;
    - `aws_s3_bucket.arn`, `aws_secretsmanager_secret.arn`, `aws_sns_topic.arn`, `aws_lb.arn`, `aws_lb_target_group.arn`, `aws_acm_certificate.arn`, `aws_ecs_cluster.arn`, `aws_ecr_repository.{arn,repository_url}`;
    - `aws_cloudfront_distribution.{arn,domain_name,hosted_zone_id}`, `aws_wafv2_web_acl.arn`, `aws_iam_openid_connect_provider.arn`;
    - `data.aws_caller_identity.account_id = "123456789012"`, `data.aws_region.name = "ap-south-1"`, `data.aws_route53_zone.zone_id`, `data.aws_ec2_managed_prefix_list.id`.

    Grow the file whenever `terraform test` reports an invalid mock value.

Steps:
- [ ] **Step 1: Write failing tests.**
  - `bootstrap.tftest.hcl` (`mock_provider "aws" { source = "../tests/mocks/aws" }`):
    - all four `aws_s3_bucket_public_access_block` flags are true;
    - versioning is `Enabled`;
    - the SSE algorithm is `aws:kms`;
    - the bucket policy denies `aws:SecureTransport = false`;
    - the lock table hash key is `LockID` with PITR on;
    - the state role trust names only the given account ids.
  - `global.tftest.hcl`:
    - the DMARC record value contains `p=quarantine`;
    - CAA has the four Amazon issuers;
    - `quad-tooling-plan`'s trust `StringLike` `token.actions.githubusercontent.com:sub` equals `repo:prishanmaduka/educo:pull_request:ref:refs/pull/*` and `aud` equals `sts.amazonaws.com`;
    - the DNS role policy's `Resource` is the zone ARN only.
- [ ] **Step 2: Run them to see them fail.** Run `node scripts/infra-check.mjs --only infra/bootstrap` (and `--only infra/envs/global`). Expected: FAIL (no configuration).
- [ ] **Step 3: Implement both roots.**
- [ ] **Step 4: Write the lock files.** In each root, run `terraform providers lock -fs-mirror=$PWD/.cache/terraform/mirror -platform=linux_amd64 -platform=darwin_arm64` through the infra env (no AWS variables). Expected: `.terraform.lock.hcl` with `h1:` hashes for both platforms.
- [ ] **Step 5: Run the checks.** Run `node scripts/infra-check.mjs` and checkov. Expected: fmt, validate and test pass. Every checkov finding is fixed or skipped in `infra/.checkov.yaml` with a one-line reason.
- [ ] **Step 6: Add to D28.** Add these points:
  - the `quad-edu.com` zone and the records every environment shares live in a new root `infra/envs/global` (tooling account), delegated from the registrar by NS;
  - environments write their own records through the `quad-dns-records` role;
  - state lives in `infra/bootstrap` with DynamoDB locking per spec 20 plus `use_lockfile` (DynamoDB locking is deprecated from Terraform 1.11).
- [ ] **Step 7: Commit.** Message: `feat(infra): bootstrap state root and global DNS root for the tooling account`.

### Task 9: Network and data modules

**Files:**
- Create: `infra/modules/network/{versions.tf,main.tf,variables.tf,outputs.tf,tests/network.tftest.hcl}` and `infra/modules/data/{versions.tf,rds.tf,redis.tf,s3.tf,kms.tf,secrets.tf,variables.tf,outputs.tf,tests/data.tftest.hcl}`.

**Interfaces:**
- Produces:
  - **network**
    - Variables:
      - `name` (default none);
      - `cidr` (`10.40.0.0/16`);
      - `azs` (`["ap-south-1a","ap-south-1b","ap-south-1c"]`);
      - `nat_gateway_count` (1);
      - `interface_endpoints` (`["ecr.api","ecr.dkr","secretsmanager","logs","ssm"]`);
      - `flow_log_retention_days` (30).
    - Resources: a VPC, three public and three private subnets, one IGW, the NAT gateways, an S3 gateway endpoint, interface endpoints with their own security group (443 from the VPC CIDR), VPC flow logs to CloudWatch, and the default security group with no rules.
    - Outputs: `vpc_id`, `vpc_cidr`, `public_subnet_ids`, `private_subnet_ids`.
  - **data**
    - Variables:
      - `name`, `vpc_id`, `private_subnet_ids`;
      - `db_instance_class` (`db.t4g.medium`), `multi_az` (false), `backup_retention_days` (7), `deletion_protection` (true), `db_name` (`quad`);
      - `redis_node_type` (`cache.t4g.micro`), `redis_replicas` (0);
      - `private_bucket_name` (`quad-staging-private`), `public_bucket_name` (`quad-staging-public`).
    - **KMS:** `data` (RDS, S3, Secrets Manager, Redis) and `field` (field-level encryption), both with rotation on.
    - **RDS:**
      - PostgreSQL `16`, `storage_type gp3`, 20 GB growing to 100 GB, `storage_encrypted` with the data key;
      - `publicly_accessible = false`, `deletion_protection` from the variable;
      - Performance Insights on with the data key, `copy_tags_to_snapshot`, `auto_minor_version_upgrade`;
      - parameter group `rds.force_ssl=1`, `log_min_duration_statement=500` and `log_statement=none` (defence in depth: db-bootstrap already sends only SCRAM verifiers, Task 2);
      - master user `quad_admin` with `manage_master_user_password = true` (Task 8 review): RDS keeps the master password in its own Secrets Manager secret, encrypted with the data key (`master_user_secret_kms_key_id`), so it is never in Terraform state. Per ruling R-db-admin there is no `DATABASE_ADMIN_URL` secret: Task 12's db-bootstrap task reads that secret's `username` and `password` keys directly.
    - **RDS Proxy:** `engine_family POSTGRESQL`, `require_tls = true`, `iam_auth = "DISABLED"` (D28), and auth entries for the `quad_app` and `quad_platform` secrets.
    - **Role secrets:** `random_password` for `quad_owner`, `quad_app` and `quad_platform`. Each gets a Secrets Manager secret `quad-staging/db/<role>` holding `{"username","password"}`.
    - **No secret in state (Task 8 review):** generate these passwords (and the URL secrets built from them) with `ephemeral "random_password"`, and write them with `aws_secretsmanager_secret_version.secret_string_wo` plus `secret_string_wo_version` (bump the version to rotate), never `secret_string`. Each role's password, every URL secret built from it, and the RDS Proxy auth secret for that role must be written from the same ephemeral value in the same apply, under one shared `*_wo_version` variable or local per role. Otherwise a rotation can leave the role secret, its URL and the proxy holding different passwords. Add a test that no `aws_secretsmanager_secret_version` sets `secret_string`. For the ElastiCache `auth_token`, prefer IAM authentication if the API's Redis client can use it; otherwise the token stays in state, and that gap is recorded in D28 and `infra/README.md`.
    - **URL secrets:** `quad-staging/env/<NAME>`, each holding one URL:
      - `DATABASE_URL` (quad_app at the proxy, `?sslmode=verify-full`);
      - `DATABASE_PLATFORM_URL` (quad_platform at the proxy);
      - `DATABASE_OWNER_URL` (quad_owner direct to RDS).
      - No `DATABASE_ADMIN_URL` (ruling R-db-admin).
    - **Redis:** an ElastiCache replication group (`engine redis`, `engine_version 7.1`), with `transit_encryption_enabled`, `at_rest_encryption_enabled` (data key), an `auth_token` from `random_password` (no special characters) and parameter `maxmemory-policy=noeviction`. Its URL goes in secret `quad-staging/env/REDIS_URL` as `rediss://:<token>@<primary endpoint>:6379`.
    - **Security groups:** `client` (no ingress; attached to the tasks that use data) and `db`/`proxy`/`redis`, with ingress only from `client` (and proxy → db).
    - **S3:**
      - both buckets have all four public access blocks, ownership `BucketOwnerEnforced`, versioning and SSE-KMS (data key);
      - private bucket lifecycle: noncurrent versions expire after 30 days, `tmp/` after 1 day and `exports/` after 7 days;
      - the private bucket policy is TLS only. The public bucket policy belongs to edge (Task 10).
    - Outputs:
      - `client_security_group_id`, `db_proxy_endpoint`, `db_instance_address`;
      - `env_secret_arns` (map with keys `DATABASE_URL`, `DATABASE_PLATFORM_URL`, `DATABASE_OWNER_URL`, `REDIS_URL`);
      - `db_master_secret_arn` (`aws_db_instance.master_user_secret[0].secret_arn`, for the db-bootstrap task in Task 12, ruling R-db-admin);
      - `private_bucket_name`, `private_bucket_arn`, `public_bucket_name`, `public_bucket_arn`, `public_bucket_id`, `public_bucket_regional_domain_name`;
      - `data_kms_key_arn`, `field_kms_key_arn`;
      - `rds_instance_id`, `redis_replication_group_id` (for the dashboard).

Steps:
- [ ] **Step 1: Write failing tests.**
  - `network.tftest.hcl`:
    - 3 public and 3 private subnets in 3 distinct AZs;
    - private subnets have `map_public_ip_on_launch = false`;
    - `nat_gateway_count = 1` gives one NAT gateway;
    - the default security group has no ingress or egress;
    - flow logs exist.
  - `data.tftest.hcl`:
    - the RDS `storage_encrypted`, `!publicly_accessible`, `deletion_protection` and `engine_version` start with `16`;
    - the parameter group has `rds.force_ssl = 1`;
    - the proxy has `require_tls`;
    - every `aws_s3_bucket_public_access_block` has all four flags true;
    - the private lifecycle has the `tmp/` 1-day and `exports/` 7-day rules;
    - Redis has both encryptions and `maxmemory-policy = noeviction`;
    - the `env_secret_arns` keys equal the four names, and none is `DATABASE_ADMIN_URL`;
    - the RDS instance has `manage_master_user_password = true` and no `password`;
    - the `db` security group ingress references only the `client` and proxy groups (no CIDR).
- [ ] **Step 2: Run them to see them fail.** Run `node scripts/infra-check.mjs --only infra/modules/network` (and data). Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the checks.** Run `node scripts/infra-check.mjs` and checkov. Expected: PASS; checkov findings fixed or skipped with a reason.
- [ ] **Step 5: Add to D28.** Add these points:
  - staging RDS is `db.t4g.medium` single-AZ with 7-day backups (production values are M12);
  - RDS Proxy uses Secrets Manager password auth with TLS in staging, and IAM auth (spec 20) arrives with production and the 90-day rotation in M12;
  - Redis is a single node in staging;
  - the database URLs are whole-URL secrets so the API config stays unchanged.
- [ ] **Step 6: Commit.** Message: `feat(infra): network and data modules (VPC, RDS with RDS Proxy, Redis, S3, KMS, database secrets)`.

### Task 10: Edge module (ALB, CloudFront, WAF, ACM)

**Files:**
- Create: `infra/modules/edge/{versions.tf,alb.tf,cloudfront.tf,waf.tf,acm.tf,variables.tf,outputs.tf,tests/edge.tftest.hcl}`.

**Interfaces:**
- Consumes: network outputs (`vpc_id`, `public_subnet_ids`) and data outputs (`public_bucket_id`, `public_bucket_arn`, `public_bucket_regional_domain_name`).
- Produces:
  - **Providers:** `configuration_aliases = [aws.us_east_1, aws.dns]`.
  - **Variables:**
    - `name`, `vpc_id`, `public_subnet_ids`, `zone_id`;
    - `web_domain` (`staging.quad-edu.com`), `console_domain` (`console.staging.quad-edu.com`), `origin_domain` (`origin.staging.quad-edu.com`);
    - the public bucket inputs above;
    - `noindex` (true), `waf_rate_limit` (2000), `waf_sensitive_rate_limit` (100), `alb_idle_timeout` (120).
  - **ACM:** a `us-east-1` certificate for `web_domain` + `console_domain`, and an `ap-south-1` certificate for `origin_domain`. DNS validation records are written with `aws.dns`, followed by `aws_acm_certificate_validation`.
  - **ALB:**
    - public subnets, `idle_timeout` 120, `drop_invalid_header_fields = true`;
    - its security group allows 443 only from `data.aws_ec2_managed_prefix_list` `com.amazonaws.global.cloudfront.origin-facing`;
    - an HTTPS listener with `ELBSecurityPolicy-TLS13-1-2-2021-06` and a default `fixed-response` 403 "Forbidden";
    - target groups (`ip` type), each with `deregistration_delay` 30:
      - `api` (port 4000, health `/api/v1/health/ready`);
      - `api_socket` (port 4000, the same health check, `stickiness { type = "app_cookie", cookie_name = "io", cookie_duration = 86400 }`);
      - `staff` (3000, `/healthz`);
      - `console` (3001, `/healthz`).
  - **Listener rules.** Every rule also has an `http_header` condition with `X-Quad-Origin-Secret` = `random_password.origin_secret.result`.

    | Priority | Host | Path | Target group |
    |---|---|---|---|
    | 10 | `console_domain` | `/api/v1/platform/*` | `api` |
    | 20 | `console_domain` | – | `console` |
    | 30 | – | `/api/v1/*` | `api` |
    | 40 | – | `/socket.io/*` | `api_socket` |
    | 50 | – | `/*` | `staff` |

  - **CloudFront:**
    - one distribution with aliases `web_domain` and `console_domain`, `http2and3`, `PriceClass_200`, the us-east-1 certificate with `TLSv1.2_2021`, and the WAF ACL;
    - origins: `alb` (`origin_domain`, HTTPS only, `custom_header { name = "X-Quad-Origin-Secret", value = random_password.origin_secret.result }`, read timeout 60, keepalive 60) and `assets` (S3 with origin access control);
    - behaviours:
      - `/api/v1/*` and `/socket.io/*` → `alb` with the managed `CachingDisabled` and `AllViewer` origin-request policies, all methods;
      - `/_next/static/*` → `alb` with `CachingOptimized`;
      - `/assets/*` → `assets` with `CachingOptimized`;
      - default → `alb` with `CachingDisabled` + `AllViewer`, all methods;
    - a response headers policy with HSTS (`max-age=63072000; includeSubDomains; preload`) and, when `noindex`, a custom `X-Robots-Tag: noindex, nofollow` (override false).
  - **Public bucket policy:** allows `s3:GetObject` for `cloudfront.amazonaws.com` with `AWS:SourceArn` = the distribution, and denies non-TLS requests.
  - **WAF** (`CLOUDFRONT` scope, provider `aws.us_east_1`):
    - managed groups `AWSManagedRulesCommonRuleSet`, `KnownBadInputsRuleSet`, `SQLiRuleSet`, `AmazonIpReputationList`, and `AnonymousIpList` scoped down to the console host;
    - rate rule `all` at 2000 per 5 minutes per IP;
    - rate rule `sensitive` at 100, scoped down to paths starting `/api/v1/auth/` or `/api/v1/public/`;
    - an empty geo block list variable (`geo_block_countries`, default `[]`; the rule exists only when non-empty);
    - CloudWatch metrics on.
  - **Outputs:**
    - `alb_security_group_id`, `alb_dns_name`, `alb_zone_id`, `alb_arn_suffix`;
    - `target_group_arns` (map with keys `api`, `api_socket`, `staff`, `console`), `target_group_arn_suffixes`;
    - `cloudfront_domain_name`, `cloudfront_hosted_zone_id`, `cloudfront_distribution_id`.

Steps:
- [ ] **Step 1: Write failing tests** (`edge.tftest.hcl`, mocks for `aws`, `aws.us_east_1`, `aws.dns` and `random`):
  - `run "alb_refuses_requests_without_the_origin_header"`: every `aws_lb_listener_rule` has an `http_header` condition named `X-Quad-Origin-Secret` whose value equals the CloudFront `alb` origin's custom header value; the listener default is `fixed-response` with status `403` (Review Focus #1).
  - `run "socket_io_is_sticky"`: the `api_socket` target group has `stickiness[0].enabled`, type `app_cookie` and duration `86400`; rule 40's path is `/socket.io/*` and it forwards to `api_socket`.
  - `run "routes_match_d14"`: the priority → (host, path, target) table above.
  - `run "alb_only_reachable_from_cloudfront"`: the ALB security group ingress uses `prefix_list_ids` and has no `cidr_blocks`.
  - `run "waf_limits"`: the rate limits are 2000 and 100.
  - `run "staging_is_noindex"`: the response headers policy contains `X-Robots-Tag`.
- [ ] **Step 2: Run them to see them fail.** Run `node scripts/infra-check.mjs --only infra/modules/edge`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the checks.** Run `node scripts/infra-check.mjs` and checkov. Expected: PASS. ALB access logs, CloudFront logging and the WAF logging destination may be skipped with "staging; production logging arrives in M12" if not added.
- [ ] **Step 5: Add to D28.** Add these points:
  - the origin secret is enforced only at the ALB (listener rules, a default 403 and an ALB security group open only to CloudFront's origin-facing prefix list). The API does no app-level check: the secret stays out of app config and rotates in one place, and `TRUST_PROXY_HOPS` relies on that path.
  - CloudFront reaches the ALB at `origin.<env>` with its own certificate;
  - ACM validation records sit beside the certificates in edge;
  - staging adds `X-Robots-Tag` at CloudFront as well as in the apps.
- [ ] **Step 6: Commit.** Message: `feat(infra): edge module with CloudFront, WAF, ALB path routing and the origin secret`.

### Task 11: DNS and SES module

**Files:**
- Create: `infra/modules/dns/{versions.tf,records.tf,ses.tf,variables.tf,outputs.tf,tests/dns.tftest.hcl}`.

**Interfaces:**
- Consumes: edge outputs (`cloudfront_domain_name`, `cloudfront_hosted_zone_id`, `alb_dns_name`, `alb_zone_id`).
- Produces:
  - **Providers:** `configuration_aliases = [aws.dns]`.
  - **Variables:** `name`, `zone_id`, `web_domain`, `console_domain`, `origin_domain`, the four edge values, `mail_domain` (`mail.quad-edu.com`), `mail_from_domain` (`bounce.mail.quad-edu.com`), `ses_webhook_url` (`https://staging.quad-edu.com/api/v1/webhooks/ses`).
  - **Records** (provider `aws.dns`): A and AAAA aliases for `web_domain` and `console_domain` → CloudFront, and A for `origin_domain` → ALB.
  - **SES** (in `ap-south-1`):
    - `aws_sesv2_email_identity` for `mail_domain`, with `dkim_signing_attributes { next_signing_key_length = "RSA_2048_BIT" }` and three DKIM CNAMEs `<token>._domainkey.<mail_domain>` (via `aws.dns`);
    - `aws_sesv2_email_identity_mail_from_attributes` with `mail_from_domain` and `behavior_on_mx_failure = "USE_DEFAULT_VALUE"` (the MX and SPF records for it are in the global root);
    - configuration set `${name}`, with an event destination to SNS for `BOUNCE` and `COMPLAINT`;
    - SNS topic `${name}-ses-events` with `signature_version = 2`, encrypted with its own KMS key whose policy allows `ses.amazonaws.com`;
    - a topic policy allowing `ses.amazonaws.com` `sns:Publish` with `AWS:SourceAccount` set;
    - an `https` subscription to `ses_webhook_url`.
  - **Outputs:** `ses_identity_arn`, `ses_configuration_set_name`, `ses_events_topic_arn`.

Steps:
- [ ] **Step 1: Write failing tests:**
  - DKIM key length `RSA_2048_BIT`;
  - three DKIM records;
  - the event destination types are exactly `BOUNCE` and `COMPLAINT`;
  - the topic `signature_version == 2`;
  - the subscription protocol is `https` and its endpoint ends `/api/v1/webhooks/ses`;
  - the alias records target the CloudFront zone id.
- [ ] **Step 2: Run them to see them fail.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the checks.** Run `node scripts/infra-check.mjs` and checkov. Expected: PASS.
- [ ] **Step 5: Add to D28.** SES records are split: the global root holds SPF, DMARC and the MAIL FROM records (one value for every account), and each environment holds its SES identity and DKIM CNAMEs. SES stays in the sandbox until M12.
- [ ] **Step 6: Commit.** Message: `feat(infra): dns module with CloudFront aliases and SES identity, DKIM and bounce events`.

### Task 12: App module (ECR, ECS, IAM, secrets and GitHub OIDC)

**Files:**
- Create: `infra/modules/app/{versions.tf,ecr.tf,ecs.tf,tasks.tf,iam.tf,oidc.tf,secrets.tf,ssm.tf,variables.tf,outputs.tf,tests/app.tftest.hcl}`.

**Interfaces:**
- Consumes:
  - network: `vpc_id`, `private_subnet_ids`;
  - data: `client_security_group_id`, `env_secret_arns`, the bucket names and ARNs, both KMS key ARNs;
  - edge: `alb_security_group_id`, `target_group_arns`;
  - dns: `ses_identity_arn`, `ses_configuration_set_name`, `ses_events_topic_arn`.
- Produces:
  - **Variables:**
    - `name`, `environment` (`staging`), `public_web_url`, `console_url`, `cdn_url`, `email_from_domain`, `log_retention_days` (30);
    - `image_tag` (`bootstrap`), `desired_count` (1), `otel_exporter_endpoint` (`""`);
    - `github_repository` (`prishanmaduka/educo`), `github_environment` (`staging`), `github_infra_environment` (`infra-staging`);
    - `services`, a map of `{ cpu, memory }`:

      | Service | CPU | Memory |
      |---|---|---|
      | api | 512 | 1024 |
      | worker | 512 | 1024 |
      | staff | 512 | 1024 |
      | console | 256 | 512 |
      | clamav | 1024 | 3072 |

  - **ECR:** repositories `quad/api`, `quad/staff`, `quad/console` and `quad/clamav`, with `IMMUTABLE` tags, scan on push, KMS encryption and a lifecycle policy that keeps the last 30 images.
  - **ECS:**
    - a cluster with Container Insights and Cloud Map namespace `${name}.internal`;
    - service discovery `clamav` (so `CLAMAV_HOST=clamav.${name}.internal`, port 3310);
    - log groups `/quad/${environment}/<service>`.
  - **Task definitions** (Fargate, `awsvpc`, Linux X86_64, read-only root file system where the image allows):
    - `api`: command default, port 4000;
    - `worker`: `node dist/worker.js`, health `CMD node dist/worker-health.js` (interval 30, retries 3, start period 60);
    - `staff`: port 3000;
    - `console`: port 3001;
    - `clamav`: port 3310, health `CMD clamdcheck.sh`;
    - one-off tasks: `migrate` (`node dist/migrate.js`), `seed` (`node dist/seed.js`), `db-bootstrap` (`node dist/db-bootstrap.js`).
  - **Environment variables on every Node task** (secrets marked †):
    - `APP_ENV=staging`, `NODE_ENV=production`, `TRUST_PROXY_HOPS=2`, `PUBLIC_WEB_URL`, `CONSOLE_URL`, `API_PORT=4000`;
    - `S3_REGION`, `S3_BUCKET_PRIVATE`, `S3_BUCKET_PUBLIC`, `CDN_URL`;
    - `CLAMAV_HOST`, `CLAMAV_PORT`;
    - `EMAIL_PROVIDER=ses`, `SES_REGION`, `SES_CONFIGURATION_SET`, `SES_SNS_TOPIC_ARN`, `EMAIL_FROM_DOMAIN`;
    - `OTEL_EXPORTER_OTLP_ENDPOINT` (when non-empty), `OTEL_SERVICE_NAME=quad-<service>`, `SENTRY_ENVIRONMENT=staging`;
    - runtime secrets: `DATABASE_URL`†, `DATABASE_PLATFORM_URL`†, `REDIS_URL`†, `SESSION_SECRET`†, `LINK_SIGNING_SECRET`†, `SENTRY_DSN`†, `OTEL_EXPORTER_OTLP_HEADERS`†;
    - staff and console get only `APP_ENV`, `PORT`, `SENTRY_DSN`†, `SENTRY_ENVIRONMENT`, `OTEL_*`.
  - **One-off tasks:**
    - `migrate` and `seed`: `DATABASE_OWNER_URL`† and `NODE_EXTRA_CA_CERTS=/app/certs/rds-global-bundle.pem`;
    - `db-bootstrap` (ruling R-db-admin): `DATABASE_ADMIN_USER`† and `DATABASE_ADMIN_PASSWORD`† from the RDS-managed master secret's JSON keys (`valueFrom` = `<db_master_secret_arn>:username::` and `:password::`); plain `DATABASE_ADMIN_HOST` (the RDS instance address, not the proxy) and `DATABASE_ADMIN_PORT` (`5432`); `NODE_EXTRA_CA_CERTS=/app/certs/rds-global-bundle.pem`; and `DATABASE_OWNER_URL`† + `DATABASE_URL`† + `DATABASE_PLATFORM_URL`†.
    - **Code change, owned by this task:** `apps/api/src/cli/db-bootstrap.ts` keeps accepting `DATABASE_ADMIN_URL` (local runs and CI). When it is absent, it requires all four `DATABASE_ADMIN_*` parts and builds the `pg` client config object from them (`host`, `port`, `user`, `password`, `database`), with `ssl: { rejectUnauthorized: true, ca: <the RDS bundle> }`. It never builds a URL string, so a password with URL-special characters is safe. Test first: URL wins when set; parts give a TLS config with `rejectUnauthorized: true`; a missing part names it and exits non-zero; the password never appears in an error. The four variables go into the spec 02 Environment variables table, `.env.example` (empty, same order) and `NOT_READ_BY_THE_API` in the same commit, so the parity tests pass; only `src/cli/db-bootstrap.ts` reads them.
  - **App secrets** (`quad-staging/env/<NAME>`): `SESSION_SECRET` and `LINK_SIGNING_SECRET` from `random_password` (64 characters, different values). `SENTRY_DSN` and `OTEL_EXPORTER_OTLP_HEADERS` start with an empty-string version and `lifecycle { ignore_changes = [secret_string] }`; they are set by hand per the README.
  - **IAM:**
    - execution role `runtime-exec`: may read only the runtime secrets plus decrypt with the data key;
    - execution role `migrate-exec`: may read the owner, app and platform URL secrets and the RDS-managed master secret (`db_master_secret_arn`), and `kms:Decrypt` on the data key that encrypts it. The execution role, not a task role, reads it (ruling R-db-admin);
    - task roles:
      - `api` and `worker`: private bucket read/write, field-key encrypt/decrypt, and `ses:SendEmail`/`SendRawEmail` on the identity and configuration set;
      - `staff`, `console` and `clamav`: none.
    - No task role has any `rds:*` or `rds-db:connect` action. No runtime role can read `DATABASE_OWNER_URL` or the RDS-managed master secret. This is the "no BYPASSRLS-equivalent" guarantee for `quad_app`: the runtime can never act as the schema owner or the master user.
  - **Services:**
    - private subnets, `assign_public_ip = false`, `desired_count`;
    - `deployment_circuit_breaker { enable = true, rollback = true }`;
    - `lifecycle { ignore_changes = [task_definition, desired_count] }` (the deploy workflow owns revisions);
    - `api` registers with both `api` and `api_socket` target groups, `staff` with `staff`, `console` with `console`;
    - security group `tasks`: ingress from the ALB security group on 4000/3000/3001 and from itself on 3310; all Node tasks also attach the data `client` group.
  - **SSM parameters** under `/quad/${environment}/deploy/`: `cluster`, `subnets` (comma-separated), `security_groups` (comma-separated), `services` (JSON map), `task_families` (JSON map including `migrate`, `seed`, `db-bootstrap`), `ecr_registry`.
  - **GitHub OIDC** (staging account): provider `token.actions.githubusercontent.com`, `aud` `sts.amazonaws.com`.
  - **Deploy and Terraform roles.** Each subject uses `StringEquals` unless the table says otherwise.

    | Role | Trusted `sub` | Permissions |
    |---|---|---|
    | `${name}-deploy` | `repo:prishanmaduka/educo:environment:staging:ref:refs/heads/main` | ECR push to the four repositories, `ecr:GetAuthorizationToken`, `ecs:RegisterTaskDefinition`/`DescribeTaskDefinition`/`UpdateService`/`DescribeServices`/`RunTask`/`DescribeTasks`, `iam:PassRole` on the four task and execution roles only, `ssm:GetParameter(s)` under `/quad/staging/deploy/*` |
    | `${name}-plan` | `repo:prishanmaduka/educo:pull_request:ref:refs/pull/*` (`StringLike`) | `ReadOnlyAccess` with explicit denies on `secretsmanager:GetSecretValue`, `ssm:GetParameter*` and `kms:Decrypt` (state is decrypted only through the state-read role), plus `sts:AssumeRole` on `quad-terraform-state-read-staging` and `quad-dns-read` only |
    | `${name}-apply` | `repo:prishanmaduka/educo:environment:infra-staging:ref:refs/heads/main` | `AdministratorAccess`; it assumes `quad-terraform-state-rw-staging` and `quad-dns-records-staging` (Task 8 fix round 1) |

    The plan and apply role ARNs are the `plan_principal_arns`/`apply_principal_arns` of `state_environments.staging` in bootstrap, and the `dns_reader_principal_arns`/`dns_writer_principal_arns.staging` in global. Add a test that every `aws_secretsmanager_secret_version` in the module uses `secret_string_wo`, never `secret_string` (Task 8 review). The app secrets above come from `ephemeral "random_password"`.

  - **Outputs:** `cluster_name`, `service_names` (map), `task_families` (map), `ecr_repository_urls` (map), `deploy_role_arn`, `plan_role_arn`, `apply_role_arn`, `tasks_security_group_id`, `ecs_service_names_for_dashboard`.

Steps:
- [ ] **Step 1: Write failing tests** (`app.tftest.hcl`, mocked inputs):
  - `run "oidc_trust_is_this_repo_main_and_staging_only"`: `jsondecode(aws_iam_role.deploy.assume_role_policy)` has exactly one statement; its `StringEquals` `sub` equals `repo:prishanmaduka/educo:environment:staging:ref:refs/heads/main` and its `aud` equals `sts.amazonaws.com`; the plan and apply subjects match the table.
  - `run "runtime_cannot_act_as_owner_or_master"`:
    - `runtime-exec`'s policy resources include `DATABASE_URL` and exclude the `DATABASE_OWNER_URL` ARN and `db_master_secret_arn` (ruling R-db-admin);
    - the decoded `container_definitions` of `api` and `worker` have no secret named `DATABASE_OWNER_URL`, `DATABASE_ADMIN_URL`, `DATABASE_ADMIN_USER` or `DATABASE_ADMIN_PASSWORD`;
    - `run "db_bootstrap_reads_the_rds_managed_master_secret"`: db-bootstrap's secrets map `DATABASE_ADMIN_USER` and `DATABASE_ADMIN_PASSWORD` to `<db_master_secret_arn>:username::` and `:password::`, `DATABASE_ADMIN_HOST` equals the instance address (not the proxy endpoint), and only `migrate-exec` names `db_master_secret_arn`;
    - no task role policy mentions `rds`.
  - `run "api_runs_behind_two_proxies"`: the api container environment has `TRUST_PROXY_HOPS = "2"` and `APP_ENV = "staging"`.
  - `run "services_roll_back"`: every service has the circuit breaker with rollback; `api` has two `load_balancer` blocks (`api`, `api_socket`).
  - `run "deploy_role_passes_only_its_roles"`: `iam:PassRole` resources equal the four role ARNs.
  - `run "migrate_task_uses_owner_url"`: `migrate` has the secret `DATABASE_OWNER_URL` and the command `["node","dist/migrate.js"]`.
- [ ] **Step 2: Run them to see them fail.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the checks.** Run `node scripts/infra-check.mjs` and checkov. Expected: PASS.
- [ ] **Step 5: Add to D28.** Add these points:
  - GitHub OIDC subjects include the ref claim through the repository's OIDC subject customisation (`include_claim_keys: ["repo","context","ref"]`, a one-time setting in the README), so the deploy role is limited to this repository, the `staging` environment and `main`;
  - Terraform owns services and the first task definitions; the deploy workflow owns later revisions (`ignore_changes`);
  - deploy settings reach the workflow through SSM parameters, not GitHub variables.
- [ ] **Step 6: Commit.** Message: `feat(infra): app module with ECR, ECS services, one-off tasks, IAM and GitHub OIDC roles`.

### Task 13: Staging environment, starter dashboard and full infra validation

**Files:**
- Create:
  - `infra/envs/staging/{versions.tf,backend.tf,providers.tf,main.tf,variables.tf,outputs.tf,dashboard.tf,tests/staging.tftest.hcl,.terraform.lock.hcl}`;
  - `infra/observability/cloudwatch/overview.json.tftpl`.

**Interfaces:**
- Consumes: every module's outputs (Tasks 9–12).
- Produces:
  - **Backend:** `backend "s3" { key = "staging/terraform.tfstate", region = "ap-south-1", encrypt = true, use_lockfile = true }`. `bucket`, `dynamodb_table`, `kms_key_id` and `assume_role.role_arn` come from `-backend-config`. CI passes `vars.TF_STATE_BUCKET`, `vars.TF_LOCK_TABLE` and `vars.TF_STATE_KMS_KEY_ARN`, plus `vars.TF_STAGING_STATE_READ_ROLE_ARN` for plans (`-lock=false`) or `vars.TF_STAGING_STATE_RW_ROLE_ARN` for applies. Without `kms_key_id` the backend sends AES256, and the state bucket refuses the upload (Task 8).
  - **Providers:**
    - `aws` (`ap-south-1`, `default_tags { env = "staging", owner = "platform", cost-centre = "quad-staging" }`);
    - `aws.us_east_1`;
    - `aws.dns` (`assume_role { role_arn = var.dns_role_arn }`, region `ap-south-1`);
    - `random`.
  - **Variables:** `dns_role_arn` (required, no default: `vars.TF_DNS_READ_ROLE_ARN` for plans, `vars.TF_STAGING_DNS_WRITE_ROLE_ARN` for applies) and `otel_exporter_endpoint` (default `""`). Every other staging value is a module argument in `main.tf`.
  - `data "aws_route53_zone" "root" { provider = aws.dns, name = "quad-edu.com" }`.
  - **Module wiring:** `network` → `data` → `edge` → `dns` → `app`, with `name = "quad-staging"`.
  - **Dashboard:** `aws_cloudwatch_dashboard.overview` (`quad-staging-overview`), rendered with `templatefile` from `infra/observability/cloudwatch/overview.json.tftpl`. Its widgets:
    - ALB `RequestCount`, `HTTPCode_Target_5XX_Count` and `TargetResponseTime` p95 per target group;
    - ECS `CPUUtilization`/`MemoryUtilization` per service;
    - RDS `CPUUtilization` and `DatabaseConnections`;
    - ElastiCache `DatabaseMemoryUsagePercentage`;
    - WAF `BlockedRequests`.
  - **Outputs:** `cloudfront_domain_name`, `deploy_role_arn`, `plan_role_arn`, `apply_role_arn`, `ecr_repository_urls`, `name_servers_note` (the string "NS records live in envs/global").

Steps:
- [ ] **Step 1: Write failing tests** (`staging.tftest.hcl`, all providers mocked, `variables { dns_role_arn = "arn:aws:iam::111111111111:role/quad-dns-records" }`):
  - the dashboard body (`jsondecode`) has a widget whose metrics include `HTTPCode_Target_5XX_Count`;
  - the edge module's CloudFront aliases are `staging.quad-edu.com` and `console.staging.quad-edu.com`;
  - the app module's api environment has `PUBLIC_WEB_URL = "https://staging.quad-edu.com"`;
  - the SES webhook URL passed to dns equals `https://staging.quad-edu.com/api/v1/webhooks/ses`;
  - `default_tags` has the four tag keys on a sample resource (`tags_all`).
- [ ] **Step 2: Run them to see them fail.** Run `node scripts/infra-check.mjs --only infra/envs/staging`. Expected: FAIL.
- [ ] **Step 3: Implement, then write the lock file.** Run `terraform providers lock -fs-mirror=… -platform=linux_amd64 -platform=darwin_arm64` as in Task 8.
- [ ] **Step 4: Validate everything.**
  - Run `QUAD_REQUIRE_INFRA_TOOLS=0 node scripts/infra-check.mjs`. Expected: fmt clean; `init -backend=false`, `validate` and `test` pass in all three roots and five modules.
  - Run `.cache/checkov/bin/checkov -d infra --config-file infra/.checkov.yaml`. Expected: 0 failed checks, with every skip carrying a reason.
  - If Docker Hub's mirror offers `aquasec/trivy`, also run `docker run --rm -v $PWD/infra:/infra mirror.gcr.io/aquasec/trivy:<pinned> config --exit-code 1 --severity HIGH,CRITICAL /infra`. Expected: no HIGH or CRITICAL findings, or each one recorded and skipped with a reason.
- [ ] **Step 5: Add to D28.** The starter dashboard is a CloudWatch dashboard kept as code under `infra/observability/` (no Grafana account yet); Grafana dashboards follow when the account exists.
- [ ] **Step 6: Commit.** Message: `feat(infra): staging environment composition, overview dashboard and provider lock files`.

### Task 14: Parent app staging release lanes

**Files:**
- Create:
  - `apps/parent/Gemfile` and `Gemfile.lock` (`fastlane` 2.240.1);
  - `apps/parent/fastlane/{Appfile,Fastfile,Matchfile,README.md}`;
  - `apps/parent/firebase/README.md`;
  - `apps/parent/lib/core/sentry.dart`;
  - `apps/parent/test/core/sentry_test.dart`.
- Modify:
  - `apps/parent/android/app/build.gradle.kts` (release signing from `key.properties` when present, otherwise the debug keys);
  - `apps/parent/.gitignore` (`android/key.properties`, `*.jks`, `*.keystore`, `android/app/src/*/google-services.json`, `ios/config/*/GoogleService-Info.plist`, `fastlane/report.xml`, `fastlane/*.ipa`, `vendor/bundle`);
  - `apps/parent/pubspec.yaml` (`sentry_flutter: 9.30.1`), `apps/parent/lib/main.dart`.

**Interfaces:**
- Consumes: `env/staging.json` (`APP_ENV`, `SENTRY_DSN`) and the flavors from D26.
- Produces:
  - **iOS lanes** (`platform :ios`):
    - `lane :staging`:
      1. `setup_ci`;
      2. `match(type: "appstore", readonly: true, app_identifier: "com.quadedu.parent.staging")`;
      3. writes `ios/config/staging/GoogleService-Info.plist` from `ENV["GOOGLE_SERVICE_INFO_PLIST_B64"]` when set;
      4. `sh("flutter build ipa --flavor staging --release --dart-define-from-file=env/staging.json --export-method app-store")`;
      5. `upload_to_testflight(api_key: app_store_connect_api_key(key_id: ENV["ASC_KEY_ID"], issuer_id: ENV["ASC_ISSUER_ID"], key_content: ENV["ASC_KEY_P8_B64"], is_key_content_base64: true), skip_waiting_for_build_processing: true)`.
    - `match` reads `MATCH_GIT_URL`, `MATCH_PASSWORD` and `MATCH_GIT_BASIC_AUTHORIZATION` from env.
  - **Android lanes** (`platform :android`):
    - `lane :staging_build`: writes `android/key.properties` and the keystore from `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD` when all are set, then `flutter build appbundle --flavor staging --release --dart-define-from-file=env/staging.json`;
    - `lane :staging`: runs `staging_build`, then `upload_to_play_store(track: "internal", package_name: "com.quadedu.parent.staging", aab: …, json_key_data: ENV["PLAY_SERVICE_ACCOUNT_JSON"], release_status: "draft")`.
  - **Signing rule:** credentials come only from environment variables (GitHub `staging` environment secrets) or `match`. Nothing is committed.
  - **Sentry:** `sentryOptionsFor(AppEnv env) → SentryConfig?` returns null when `SENTRY_DSN` is empty; otherwise `{ dsn, environment: APP_ENV, sendDefaultPii: false, tracesSampleRate: 0.1 }`. `main.dart` wraps `runApp` with `SentryFlutter.init` only when it is non-null.
  - **Firebase:** packages and the `google-services` Gradle plugin arrive with push in M6. M0b only reserves the git-ignored file paths and documents in `apps/parent/firebase/README.md`:
    - the projects `quad-dev` and `quad-staging`;
    - the APNs `.p8` upload;
    - where each file goes;
    - that spec 02 keeps the staging and production files out of git.

Steps:
- [ ] **Step 1: Write a failing test.** In `sentry_test.dart`: an env with an empty DSN gives null; a DSN with `APP_ENV` `staging` gives `environment == 'staging'` and `sendDefaultPii == false`.
- [ ] **Step 2: Run it to see it fail.** Run `cd apps/parent && flutter test test/core/sentry_test.dart`. Expected: FAIL.
- [ ] **Step 3: Implement the Dart, Gradle and fastlane files.**
- [ ] **Step 4: Validate.**
  - Run `cd apps/parent && flutter analyze && flutter test`. Expected: PASS.
  - Run `gem install bundler && bundle config set --local path vendor/bundle && bundle install && bundle exec fastlane lanes`. Expected: lists `ios staging`, `android staging_build` and `android staging`.
  - `ruby -c fastlane/Fastfile` prints `Syntax OK`.
  - The Android and iOS builds cannot run here (no Android SDK or Xcode). Record that in the report; CI's `parent-build` job (Task 15) proves the Android build.
- [ ] **Step 5: Add to D28.** Add these points:
  - staging builds go to TestFlight and the Play internal track (spec 18, 20 and 17), not Firebase App Distribution as spec 09 says; spec 09 is updated to match;
  - store and signing credentials are GitHub `staging` environment secrets (spec 20), and the AWS side has none;
  - Firebase packages wait for M6.

  Also edit spec 09's Store publishing line.
- [ ] **Step 6: Commit.** Message: `feat(parent): fastlane staging lanes, release signing from env and Sentry`.

### Task 15: Workflows: named CI checks, image builds, staging deploy and infra

**Files:**
- Create:
  - `.github/actions/setup/action.yml` (composite: pnpm, Node from `.nvmrc`, `pnpm install --frozen-lockfile`, with optional Java 17 and Flutter inputs);
  - `.github/workflows/deploy-staging.yml` and `.github/workflows/infra.yml`;
  - `scripts/ecs-deploy.mjs` and `scripts/test/{ecs-deploy.test.ts,workflows.test.ts}`.
- Modify:
  - `.github/workflows/ci.yml`;
  - `scripts/package.json` (devDependency `yaml`);
  - spec 02 D27 → D28 (the CI split is done).

**Interfaces:**
- Consumes:
  - `scripts/docker-build.mjs` (Task 7) and `scripts/smoke.mjs` (Task 6);
  - the SSM deploy parameters and role names (Task 12);
  - the lanes from Task 14;
  - `scripts/terraform-mirror.mjs` and `scripts/infra-check.mjs` (Task 1).
- Produces:
  - **`scripts/ecs-deploy.mjs`** exports:
    - `renderTaskDefinition(current: object, change: { container: string; image: string; environment?: Record<string, string> }): object` removes `taskDefinitionArn`, `revision`, `status`, `requiresAttributes`, `compatibilities`, `registeredAt` and `registeredBy`; sets the named container's `image`; upserts the `environment` entries (`SENTRY_RELEASE`);
    - `taskOutcome(runTaskOutput: object | null, describeTasksOutput: object, container: string): { ok: boolean; message: string }`. It is ok only when there are no `failures`, exactly one task, and the container `exitCode === 0`. Otherwise the message names the container and the exit code, the `stoppedReason` or the failure reason.
  - **`scripts/ecs-deploy.mjs` subcommands** (each shells out to the `aws` CLI):
    - `image-ref --repo <url> --tag <sha>` resolves `repo@sha256:…` with `aws ecr describe-images`;
    - `register --family <f> --container <c> --image <ref> [--env K=V]` prints the new task definition ARN;
    - `run-task --family-arn <arn> --container <c>` reads `/quad/staging/deploy/{cluster,subnets,security_groups}`, runs `aws ecs run-task` and then `aws ecs wait tasks-stopped`, and exits 1 unless `taskOutcome` is ok;
    - `update-service --service <s> --task-definition <arn>`;
    - `wait-stable --services a,b,…`.
  - **`ci.yml`:**
    - jobs `typecheck`, `lint`, `unit`, `codegen`, `api-integration` (Postgres and Redis service containers plus the roles SQL), `e2e-smoke` and `build`, which are the required checks from spec 17/20 (`pnpm audit` runs inside `unit`);
    - plus `images` (`node scripts/docker-build.mjs all --build-arg NEXT_PUBLIC_APP_ENV=local`, no push) and `parent-build` (`flutter build apk --flavor staging --release --dart-define-from-file=env/staging.json` on Ubuntu with Java 17, debug-signed fallback);
    - the same triggers as today, with `QUAD_REQUIRE_FLUTTER=1` where Flutter runs;
    - `pnpm verify` stays the local gate and its step order is unchanged.
  - **`deploy-staging.yml`:**
    - triggers: `workflow_run` of `CI` (`types: [completed]`, `branches: [main]`) and `workflow_dispatch`;
    - `concurrency: deploy-staging` (no cancel);
    - `permissions: contents: read` at the top and `id-token: write` only on AWS jobs;
    - the AWS jobs use `environment: staging` and check out `github.event.workflow_run.head_sha || github.sha`. Each has `if: ${{ vars.AWS_STAGING_DEPLOY_ROLE_ARN != '' && (github.event_name == 'workflow_dispatch' || github.event.workflow_run.conclusion == 'success') }}`. In order:
      1. `build-push`, matrix over `api`, `staff`, `console` and `clamav`; the web images use `NEXT_PUBLIC_APP_ENV=staging`, `NEXT_PUBLIC_API_URL=https://staging.quad-edu.com` and `NEXT_PUBLIC_SENTRY_DSN=${{ vars.SENTRY_DSN_<APP> }}`;
      2. `migrate` (needs `build-push`): registers and runs `db-bootstrap`, then `migrate`; a failure ends the workflow;
      3. `deploy` (needs `migrate`): registers and updates api, worker, staff, console and clamav with `SENTRY_RELEASE=<sha>`, then `wait-stable`;
      4. `seed` (needs `deploy`);
      5. `smoke` (needs `seed`): `node scripts/smoke.mjs --web https://staging.quad-edu.com --console https://console.staging.quad-edu.com --origin https://origin.staging.quad-edu.com --expect-noindex`.
    - Each AWS job uses `aws-actions/configure-aws-credentials@v4` with `role-to-assume: ${{ vars.AWS_STAGING_DEPLOY_ROLE_ARN }}` and `aws-region: ap-south-1`. `build-push` also uses `aws-actions/amazon-ecr-login@v2`.
    - `parent-ios` (macOS, `if: vars.IOS_UPLOAD_ENABLED == 'true' && (github.event_name == 'workflow_dispatch' || github.event.workflow_run.conclusion == 'success')`) and `parent-android` (the same with `vars.PLAY_UPLOAD_ENABLED`) run the Task 14 lanes with `environment: staging` secrets. They have no `needs`, so they don't depend on the AWS jobs.
  - **`infra.yml`:**
    - triggers: `pull_request` and `push` (branches `main` and `claude/**`), both with `paths: ['infra/**', 'scripts/infra-check.mjs', '.github/workflows/infra.yml']`, plus `workflow_dispatch`;
    - job `checks` (no AWS):
      - `hashicorp/setup-terraform@v3` with `terraform_version` read from `infra/.terraform-version` and `terraform_wrapper: false`;
      - `terraform-linters/setup-tflint@v4` (pinned version, `GITHUB_TOKEN`);
      - `pip install checkov==3.3.25`;
      - `QUAD_REQUIRE_INFRA_TOOLS=1 node scripts/infra-check.mjs`;
    - job `plan`: `if: github.event_name == 'pull_request' && vars.AWS_STAGING_PLAN_ROLE_ARN != ''`. It runs OIDC, `init` with `-backend-config` from vars (`bucket`, `dynamodb_table`, `kms_key_id` = `vars.TF_STATE_KMS_KEY_ARN`, `assume_role` = `vars.TF_STAGING_STATE_READ_ROLE_ARN`), `terraform plan -lock=false -var dns_role_arn=${{ vars.TF_DNS_READ_ROLE_ARN }}`, and posts the plan as a PR comment. The trigger is `pull_request`, never `pull_request_target`;
    - job `apply`: `if: github.event_name == 'push' && github.ref == 'refs/heads/main' && vars.AWS_STAGING_APPLY_ROLE_ARN != ''`, `environment: infra-staging` (required reviewers), `terraform apply` from a fresh plan, with `assume_role` = `vars.TF_STAGING_STATE_RW_ROLE_ARN` and `-var dns_role_arn=${{ vars.TF_STAGING_DNS_WRITE_ROLE_ARN }}`.

Steps:
- [ ] **Step 1: Write failing tests.**
  - `ecs-deploy.test.ts`:
    - `renderTaskDefinition` drops the read-only fields, sets the image on `api` only and upserts `SENTRY_RELEASE` without duplicating it;
    - `taskOutcome` is ok for exit 0;
    - Review Focus #4: exit 1 → not ok with "migrate exited with code 1"; no `exitCode` with `stoppedReason: 'CannotPullContainerError'` → not ok and the reason is named; `failures: [{ reason: 'RESOURCE:MEMORY' }]` → not ok; two tasks → not ok.
  - `workflows.test.ts` parses the three workflow files with `yaml`:
    - Review Focus #5: every job in `deploy-staging.yml` except `parent-*` has an `if` containing `vars.AWS_STAGING_DEPLOY_ROLE_ARN != ''`;
    - `parent-*` jobs check their own `vars.*_UPLOAD_ENABLED`;
    - `infra.yml` `plan`/`apply` have their `vars` conditions;
    - no workflow text contains `secrets.AWS`, and every `role-to-assume` starts with `${{ vars.`;
    - `deploy.needs` includes `migrate` and `migrate.needs` includes `build-push`;
    - `ci.yml` has jobs named `typecheck`, `lint`, `unit`, `codegen`, `api-integration`, `e2e-smoke` and `build`.
- [ ] **Step 2: Run them to see them fail.** Run `pnpm --filter @quad/scripts test`. Expected: FAIL.
- [ ] **Step 3: Implement the script, the composite action and the three workflows.**
- [ ] **Step 4: Validate the workflows.**
  - Run `npx --yes @action-validator/cli@0.6.0 .github/workflows/*.yml .github/actions/setup/action.yml`. Expected: valid.
  - Run `docker run --rm -v $PWD:/repo -w /repo mirror.gcr.io/rhysd/actionlint:1.7.9`. Expected: no errors (shellcheck warnings fixed).
- [ ] **Step 5: Run the checks, push and watch.**
  - Run `pnpm verify`. Expected: PASS.
  - Push the branch and run `gh run list --branch <branch> --limit 5`. Expected:
    - CI green with every named job;
    - `infra.yml` `checks` green, with `plan` skipped;
    - `deploy-staging.yml` doesn't trigger (not `main`).
  - Investigate any red job with `quad-debugging` before moving on.
- [ ] **Step 6: Add to D28.** Add these points:
  - CI is split into the named required checks from spec 17/20, plus `images` and `parent-build`, which closes the D27 deferral;
  - the staging deploy runs from `workflow_run` after CI succeeds on `main`;
  - every AWS job is gated on its role variable, so `main` stays green before the accounts exist;
  - one-off task outcomes are checked by `scripts/ecs-deploy.mjs`.
- [ ] **Step 7: Commit.** Message: `ci: named checks, image builds, staging deploy and infra workflows`.

### Task 16: First-deploy hand-off, decision log and the final gate

**Files:**
- Create: `infra/README.md` and `scripts/github-oidc-subject.sh` (sets the repository OIDC subject template with `gh api`; never run here).
- Modify:
  - `docs/spec/02-architecture.md` (tidy D28, and point the Monorepo layout `infra/` line at `bootstrap` and `envs/global`);
  - `docs/spec/20-infrastructure-operations.md` (the Terraform tree gains `bootstrap/`, `envs/global/` and `observability/`; one sentence on staging RDS Proxy password auth until M12);
  - `docs/spec/18-delivery-plan.md` (Progress: change the M0b line to `- [ ] M0b Infrastructure and staging (written and validated offline; pending first deploy, see infra/README.md)`; do not tick it);
  - `README.md` (one Infrastructure paragraph linking `infra/README.md`).

**Interfaces:**
- Consumes: every earlier task's outputs and recorded gaps.
- Produces `infra/README.md` with these sections:
  1. **Layout and the validation commands:** `pnpm infra:tools`, `eval "$(node scripts/terraform-mirror.mjs --print-env)"`, `pnpm infra:check`.
  2. **First deploy checklist** (ordered, each with the exact command or console path):
     1. Create the AWS Organization with the `tooling` and `staging` accounts; turn on IAM Identity Center; set up the budget alarm.
     2. Prerequisite: set the repository OIDC subject customisation (`include_claim_keys: ["repo","context","ref"]`, `scripts/github-oidc-subject.sh`) before any role is used, because the trust policies match that subject shape. Keep "Send write tokens to workflows from fork pull requests" off, and never run plans from `pull_request_target`.
     3. Bootstrap in tooling, as a break-glass administrator role.
        - Copy each break-glass ARN, path included (`arn:aws:iam::<tooling>:role/aws-reserved/sso.amazonaws.com/<region>/AWSReservedSSO_<set>_<hash>`), from `aws iam get-role --role-name <name> --query Role.Arn`. Do not take it from `aws sts get-caller-identity`, which returns the assumed-role session ARN without the path, so the bucket policy would not match it. If the policy ever locks everyone out of the state objects, the tooling account's root user can still rewrite the bucket policy.
        - The bootstrap root commits a partial S3 backend (`infra/bootstrap/backend.tf`: key `bootstrap/terraform.tfstate`, `encrypt`, `use_lockfile`). The bucket does not exist for the first apply, so create the git-ignored `infra/bootstrap/local_override.tf` with `terraform { backend "local" {} }` first, then: `terraform -chdir=infra/bootstrap init && apply -var 'break_glass_principal_arns=["<tooling admin role>"]' -var 'state_environments={global={plan_principal_arns=["arn:aws:iam::<tooling>:role/quad-tooling-plan"],apply_principal_arns=["<tooling admin role>"]},staging={plan_principal_arns=["arn:aws:iam::<staging>:role/quad-staging-plan"],apply_principal_arns=["arn:aws:iam::<staging>:role/quad-staging-apply"]}}'`. This covers both the tooling AND the staging accounts.
        - Delete `local_override.tf`, then move the local state into the bucket: `terraform -chdir=infra/bootstrap init -migrate-state -backend-config bucket=<state_bucket> -backend-config dynamodb_table=<lock_table> -backend-config kms_key_id=<state_kms_key_arn>`. No `assume_role`: only break-glass roles can reach `bootstrap/terraform.tfstate`. Then delete the local `terraform.tfstate*` files.
     4. Apply `infra/envs/global` in tooling with `-var 'dns_writer_principal_arns={staging=["arn:aws:iam::<staging>:role/quad-staging-apply"]}' -var 'dns_reader_principal_arns=["arn:aws:iam::<staging>:role/quad-staging-plan"]'` and `init -backend-config bucket=<state_bucket> -backend-config dynamodb_table=<lock_table> -backend-config kms_key_id=<state_kms_key_arn> -backend-config 'assume_role={role_arn="<state_rw_role_arns.global>"}'`, run as the break-glass role listed in `state_environments.global.apply_principal_arns`. Copy the four `name_servers` to the registrar for `quad-edu.com` and wait for `dig NS quad-edu.com` to show them.
     5. Create the GitHub environments `staging` (deployment branch `main` only) and `infra-staging` (required reviewers, `main` only).
     6. The first staging apply, before the CI roles exist (they are created by this apply):
        - Add the staging administrator's exact Identity Center role ARN (copied as in step 3) to `state_environments.staging.apply_principal_arns` in bootstrap and to `dns_writer_principal_arns.staging` in global, and apply both roots.
        - As that role: `terraform -chdir=infra/envs/staging init -backend-config bucket=<state_bucket> -backend-config dynamodb_table=<lock_table> -backend-config kms_key_id=<state_kms_key_arn> -backend-config 'assume_role={role_arn="<state_rw_role_arns.staging>"}'`, then `apply -var dns_role_arn=<dns_write_role_arns.staging>` with `app.desired_count=0`.
        - Once `quad-staging-plan` and `quad-staging-apply` exist and CI applies cleanly, remove the administrator ARN from both lists and apply bootstrap and global again.
     7. Put the Sentry DSN and Grafana OTLP headers into `quad-staging/env/SENTRY_DSN` and `…/OTEL_EXPORTER_OTLP_HEADERS` with `aws secretsmanager put-secret-value`.
     8. Set the GitHub variables named in Global Constraints from the Terraform outputs.
     9. Run `deploy-staging.yml` by hand, then apply staging again with `desired_count = 1`.
     10. Re-confirm the SES SNS subscription once the API is up (`aws sns list-subscriptions-by-topic`, then re-subscribe if it is pending).
     11. Send a test email to a mail-tester address and check that SPF, DKIM and DMARC pass.
     12. Run `node dist/sentry-test.js` as a one-off task and check Sentry.
     13. Check traces with `tenant_id` in Grafana (from M1, when requests carry a tenant).
     14. Ask AWS for SES production access before M12.
  3. **Accounts and keys to create:**
     - Firebase projects `quad-dev` and `quad-staging`, with the APNs `.p8` key uploaded to each;
     - Sentry projects `quad-api`, `quad-staff`, `quad-console` and `quad-parent`;
     - the Apple Developer and Google Play organisation accounts (D-U-N-S), two admins each with hardware keys;
     - the `match` certificates repository;
     - the Play upload key;
     - the GitHub `staging` environment secrets used by fastlane.
  4. **What CI does** (the three workflows, and what is skipped until the variables exist).
  5. **Validation gaps:** tflint locally (GitHub releases blocked), the mobile builds locally (no SDKs), anything recorded by Tasks 1–15.
  6. **Open questions:** listed in this plan's hand-off and confirmed by the implementers.

Steps:
- [ ] **Step 1: Write the README, the subject script and the spec edits.** Make D28 one row in the D27 style: a summary sentence plus a `<ul>` of the per-task decisions. Keep it in plain English.
- [ ] **Step 2: Check the docs against the code.** Every command in `infra/README.md` names a file or script that exists, and every GitHub variable it lists appears in a workflow. Check with `rg -o 'vars\.[A-Z_]+' .github/workflows | sort -u` against the README list.
- [ ] **Step 3: Run the final gates.**
  - Run `pnpm verify && pnpm build && node scripts/infra-check.mjs && node scripts/docker-build.mjs all --build-arg NEXT_PUBLIC_APP_ENV=local`. Expected: all PASS.
  - Run the Task 7 local image smoke again. Expected: all ok.
- [ ] **Step 4: Commit and push.**
  - Commit with the message `docs(infra): first-deploy checklist, D28 and M0b status`.
  - Push, then run `gh run list --branch <branch> --limit 5`. Expected: CI and `infra.yml` green; deploy skipped or not triggered.
