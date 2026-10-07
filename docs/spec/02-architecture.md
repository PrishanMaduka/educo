# 02 Architecture

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Language | TypeScript 5 (strict) everywhere | `"strict": true`, `noUncheckedIndexedAccess` |
| Runtime | Node.js 22 LTS | |
| Monorepo | pnpm workspaces + Turborepo | One lockfile; cached `build`, `lint`, `typecheck`, `test` |
| API | NestJS 11 on the Fastify adapter | Modules map to product areas; REST + OpenAPI 3.1 |
| Validation and contracts | Zod 3, shared in `packages/contracts` | Same schemas validate requests in the API and forms in the apps; OpenAPI generated from them |
| Database | PostgreSQL 16 | One shared schema; `tenant_id` on every school-owned row; row-level security |
| ORM and migrations | Drizzle ORM + drizzle-kit | SQL-first; migrations checked in; RLS policies in migrations |
| Cache, queues, realtime fan-out | Redis 7 | BullMQ for jobs; Socket.IO Redis adapter; rate limits |
| Realtime | Socket.IO (WebSocket) | Rooms per tenant, per user, per class |
| Public site and staff portal | Next.js 15 (App Router), React 19, Tailwind CSS v4 | `apps/staff`, served on **`quad-edu.com`** for every school: the landing page at `/` ([19](19-public-site.md)), `/sign-in`, the signed-in staff portal under `/app`, legal pages under `/legal`, and the `/p/*` app-link fallback pages. No per-school domains or subdomains |
| Platform console | Next.js 15 (App Router), React 19, Tailwind CSS v4 | `apps/console`, served on `console.quad-edu.com` (Quad staff only), separate deploy and cookie |
| Parent app | Flutter (latest stable) and Dart 3 | `apps/parent`; iOS and Android. See [Parent app (Flutter)](#parent-app-flutter) |
| Web styling | **Tailwind CSS v4** for all front-end styling. Tokens from `packages/tokens` are mapped into Tailwind's `@theme`; Radix UI primitives for behaviour; `class-variance-authority` + `tailwind-merge` for component variants | No CSS-in-JS, CSS modules or component-library themes. Components live in `packages/ui` |
| Mobile styling | Flutter `ThemeData` + `ThemeExtension`s generated from `packages/tokens` (Dart file) | |
| Data fetching (web) | TanStack Query 5 + a typed client generated from OpenAPI (`openapi-typescript` + `openapi-fetch`) | `packages/client` |
| Data fetching (mobile) | `dio` + a Dart client generated from the same OpenAPI document (`openapi-generator`, `dart-dio`) | `apps/parent/packages/quad_api` |
| Forms | react-hook-form + Zod resolver | |
| Charts | visx (web), `fl_chart` (mobile) | Follow chart rules in [03](03-design-system.md#charts) |
| Auth | Built in the API (see [05](05-auth-tenancy-rbac.md)); Argon2id; OIDC via `openid-client`; TOTP via `otplib` | |
| Files | S3-compatible storage (AWS S3; MinIO locally); `sharp` for images | Presigned uploads |
| Email / SMS / push | Adapters: Amazon SES (from `mail.quad-edu.com`); Notify.lk for +94 numbers and Twilio elsewhere; Firebase Cloud Messaging (FCM HTTP v1, one Firebase project per environment, APNs through Firebase) | Mailpit and a log sink locally. Provider setup in [20](20-infrastructure-operations.md#providers) (D19) |
| Payments | PayHere (LKR cards and wallets), Stripe (international cards), bank transfer | Adapter per gateway; webhooks. Each school uses its own merchant account; Quad's own accounts are used only for platform billing (D20) |
| AI | Anthropic TypeScript SDK `@anthropic-ai/sdk`, model `claude-opus-5-5` | See [11](11-ask-quad.md) |
| Search | PostgreSQL full-text search + `pg_trgm` | Ctrl K command palette |
| Observability | OpenTelemetry traces, Pino JSON logs, Sentry errors | Exported to Grafana Cloud (or CloudWatch); see [20](20-infrastructure-operations.md#observability) |
| Testing | Vitest (integration tests against the compose services locally and service containers in CI, with a freshly migrated database per test file), Supertest, Playwright (web); `flutter_test`, golden tests, `integration_test` and Maestro (mobile) | See [17](17-testing-quality.md) |
| Hosting | AWS `ap-south-1` (Mumbai): CloudFront + WAF, ALB, ECS Fargate, RDS PostgreSQL + RDS Proxy, ElastiCache Redis, S3 | Terraform in `infra/`; staging in M0b, production in M12. See [20 Infrastructure and operations](20-infrastructure-operations.md) (D18) |

## Monorepo layout

```
quad/
├── apps/
│   ├── api/              # NestJS API, workers (same image, different entrypoint)
│   │   ├── src/modules/  # one folder per area: tenants, auth, users, students, attendance, …
│   │   ├── src/platform/ # console and platform modules (the only API code allowed to use withPlatform)
│   │   ├── src/worker.ts # BullMQ workers and schedulers
│   │   ├── src/worker/platform-jobs/  # cross-tenant jobs (health, billing, retention purge, provisioning)
│   │   └── test/         # API integration tests (*.api.test.ts)
│   ├── staff/            # Next.js staff portal
│   ├── console/          # Next.js platform console
│   └── parent/           # Flutter parent app (Dart; not a pnpm package, wrapped by package.json scripts so Turborepo can run it)
│       ├── lib/          # app code: features/, ui/, theme/ (tokens.g.dart), l10n/, router.dart
│       ├── packages/quad_api/  # generated Dart API client (do not edit by hand)
│       ├── test/         # unit, widget and golden tests
│       └── integration_test/
├── packages/
│   ├── tokens/           # Design tokens: TS source, generated Tailwind @theme CSS, generated Dart (apps/parent/lib/theme/tokens.g.dart), logo SVGs
│   ├── ui/               # Shared React web components (Button, Drawer, Dropdown, Table, …)
│   ├── contracts/        # Zod schemas, enums, permission keys, event names shared by API and apps
│   ├── client/           # Generated typed API client + TanStack Query hooks
│   ├── db/               # Drizzle schema, migrations, RLS policies, seed scripts
│   ├── domain/           # Pure business logic with no I/O: timetable builder, early-warning scoring, fee maths, exam clash checks, grading
│   └── config/           # Shared tsconfig, ESLint, Prettier, Vitest presets
├── scripts/              # @quad/scripts: codegen, the verify gate, the Flutter wrapper, and their tests
├── design/               # HTML prototypes (reference only; never imported by apps)
├── docs/spec/            # This specification
├── infra/                # Terraform: modules network, data, app, edge, dns; envs staging, production (see 20)
├── docker-compose.yml    # Postgres, Redis, MinIO, Mailpit, ClamAV
├── .env.example          # every variable, names and comments only
├── .nvmrc  .fvmrc        # pinned Node and Flutter versions
├── turbo.json
└── CLAUDE.md
```

Rules:
- `packages/domain` holds every algorithm that has rules (timetable generation, clash checks, early-warning scores, invoice totals, grading). It is pure and fully unit-tested, so the logic is never duplicated between the API and the apps.
- Apps never import from another app. Shared code goes in `packages/`.
- The API is the only thing that talks to the database.
- The Flutter app cannot import `packages/domain` (Dart cannot use TypeScript), so **every rule-based calculation runs on the server** and the API returns results ready to show: fee totals, early-warning levels, grades, summaries and sentences. The app only formats dates, numbers and money for display.
- Generated code (`packages/client`, `quad_api`, `tokens.g.dart`, ARB files) is regenerated by scripts and never edited by hand. CI fails if a regeneration produces a diff.

## Parent app (Flutter)

| Concern | Package or approach |
|---|---|
| State and dependency injection | `flutter_riverpod` with `riverpod_generator` |
| Routing and deep links | `go_router` (`quad://moments/{id}`, `quad://pay/{invoiceId}`, and universal links / App Links on `https://quad-edu.com/p/...`, which open the app when installed and otherwise show a "Get the Quad app" page). `apps/staff` serves `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` covering only `/p/*`, so staff links under `/app` always stay in the browser (D14). The full deep-link table is in [09](09-parent-app.md) |
| API | Generated `quad_api` (dio) with an auth interceptor for token refresh; models with `freezed` and `json_serializable` |
| Secure storage | `flutter_secure_storage` (refresh token) |
| Biometrics | `local_auth` (Face ID, fingerprint, device passcode fallback) |
| Push | `firebase_messaging` + `flutter_local_notifications` (foreground banners) |
| Realtime | `socket_io_client` |
| Offline cache | `drift` (SQLite) for Home, timetable, moments, messages and invoices, encrypted with `sqlcipher_flutter_libs` (key in secure storage); wiped on sign-out and on switching school |
| App config and force update | On start the app calls `GET /api/v1/app/config`; if its version is below `min_version` it shows a full-screen "Update Quad" page with a store link |
| Images | `cached_network_image` |
| SVG and logo | `flutter_svg` with the files from `design/brand/` |
| Charts | `fl_chart` |
| Maps (bus) | `flutter_map` (OpenStreetMap tiles) behind an interface, so Google Maps can replace it |
| QR (pickup pass) | `qr_flutter` |
| Payments | PayHere Flutter SDK (`payhere_mobilesdk_flutter`) and `flutter_stripe` |
| Localisation | `flutter_localizations` + `intl` with ARB files generated from `packages/contracts/i18n/en.json` |
| Fonts | Figtree bundled as assets |
| Lint | `very_good_analysis` |
| Builds | One Quad app for every school, store name "Quad – School & Family" (D13). Flavors `dev`, `staging`, `prod` with bundle ids `com.quadedu.parent.dev`, `com.quadedu.parent.staging`, `com.quadedu.parent`, each with its own `API_URL`, socket URL and Firebase config. The splash and sign-in are Quad-branded; after sign-in (and on later launches, from the remembered school) the app applies the school's logo, colour and name. CI builds with GitHub Actions + `fastlane` (macOS runner for iOS); store publishing in [20](20-infrastructure-operations.md#app-store-publishing) |

Folder layout in `apps/parent/lib`: `features/<area>/` (screens, widgets, providers per feature: home, moments, children, payments, messages, school_life, more, auth, assistant), `ui/` (shared widgets that mirror `packages/ui`), `theme/`, `l10n/`, `core/` (API, storage, push, realtime).

## Tenancy

- Shared database and schema. Every school-owned table, including child tables (`terms`, `year_groups`, `attendance_marks`, `invoice_lines`, `journal_lines` and every other table under a **[T]** heading in [04](04-data-model.md)), has `tenant_id uuid not null`, a composite index starting with `tenant_id`, and a row-level security policy `tenant_id = current_setting('app.tenant_id')::uuid`. Child tables never rely on their parent row for isolation.
- The API opens a transaction per request and runs `select set_config('app.tenant_id', $1, true)` before any query. A Drizzle wrapper (`withTenant(tenantId, fn)`) enforces this; a lint rule bans the raw client outside `packages/db`.
- Platform tables (tenants, plans, curricula templates, platform users, platform audit, platform leads) have no `tenant_id` and are only reachable from console routes and platform jobs.
- **One domain for every school.** Creating a school in the console creates a tenant row and its settings; it does not create a domain, subdomain or database schema. Every school's staff sign in at `quad-edu.com`, and every parent uses the same Quad parent app (D13).

### Database roles and RLS (D17)

| Role | Used by | Rights |
|---|---|---|
| `quad_owner` | Migrations only (`pnpm db:migrate`, the deploy migration task) | Owns the schema; creates tables, policies and functions |
| `quad_app` | The API and worker for all school work | `NOBYPASSRLS`; DML on tables; execute on the named security-definer functions. Every [T] table has `ENABLE ROW LEVEL SECURITY` **and** `FORCE ROW LEVEL SECURITY`, so even the owner is filtered when it queries |
| `quad_platform` | `withPlatform(fn)` on a separate, small pool | `BYPASSRLS`. Only for console routes and cross-tenant jobs (health snapshots, platform billing, retention purge, provisioning, tenant deletion) |

- `withPlatform()` may be imported only in `apps/api/src/platform/**` and `apps/api/src/worker/platform-jobs/**`; an ESLint rule fails the build anywhere else. Every `withPlatform` write is recorded in `platform_audit`.
- A migration test fails if any [T] table lacks `tenant_id`, its `(tenant_id, …)` index, `FORCE ROW LEVEL SECURITY` or a policy, or if `quad_app` has `BYPASSRLS`.

### Where the tenant comes from

- A person has one global **account** (email and/or phone, password, two-step) and one **membership** (`users` row) per school they belong to. See [04](04-data-model.md#identity-tenant-scoped-unless-noted).
- Staff portal: the person signs in at `quad-edu.com`. The API looks up the account's active memberships. One membership opens that school straight away; several show **Choose a school** (logo, name, role). The chosen `tenant_id` is stored on the server-side session. The school's branding (logo, colour, name) is applied after sign-in.
- Switching school: the profile menu lists the other memberships; switching rotates the session and reloads `/app`.
- Links in emails and notifications are `quad-edu.com/app/...` (staff) or `quad-edu.com/p/...` (parents) and may carry `?school={tenantId}` as a hint. The hint only selects among the person's own memberships; it is never trusted as the tenant.
- Parent app: the same model. After OTP sign-in the API returns the guardian's memberships; the app shows the school picker only if there is more than one, and the access token carries the chosen `tid`.
- API: the tenant comes from the session or token, never from a request body, path, query or host. Console routes that act on a school take `/:tenantId` and require a platform role.

### Tenant-less entry points (D16)

These are the only ways to find a tenant without a session or token. Each has a cross-tenant test.

| Entry point | How the tenant is found |
|---|---|
| Sign-in | `auth_memberships(account_id)`, a `SECURITY DEFINER` function that returns only tenant id, tenant name, logo, colour, membership kind and role names for active memberships of active tenants |
| Signed links: password reset, staff invite, guardian invite code, relative invite, support session, email deep links | A signed token (HMAC-SHA256 with `LINK_SIGNING_SECRET`) carrying `{purpose, tid, sub, exp, nonce}`, verified on the server; single use where the flow says so (the nonce is stored on use). The tenant comes from the verified token, never from plain URL parameters |
| Payment webhooks (PayHere, Stripe) | Verify the gateway signature first, then `tenant_by_gateway_account(provider, account_id)` maps the school's own merchant account to its tenant (D20) |
| Public admissions enquiry form | `embed_key` → `tenant_by_embed_key(key)` |
| Demo requests from the landing page | No tenant: written to the platform table `platform_leads` ([19](19-public-site.md#demo-requests)) |

No other code reads across tenants. The security-definer functions are owned by `quad_owner`, set `search_path`, and return the minimum columns.

- Each tenant has `region` (`ap-south`, `me-central`, `ap-southeast`). v1 deploys one region (`ap-south-1`) and stores the field for later (D21).
- Plan limits (student seats, modules) are enforced in the API by a `PlanGuard` (see [05](05-auth-tenancy-rbac.md#plan-and-module-guard)).

## Environments

| Env | Hosts | Data |
|---|---|---|
| local | `localhost:3000` (landing, sign-in and staff portal; `/api/v1` proxied to the API on :4000), `localhost:3001` (console), the Flutter app on a simulator or device | Docker Compose, seeded sample schools |
| staging | `staging.quad-edu.com` (with `/api/v1`), `console.staging.quad-edu.com` | Seeded sample schools only (no copies of real data). Built in M0b; deployed on every merge to `main` |
| production | `quad-edu.com` (landing, sign-in, staff portal, the API at `/api/v1`), `console.quad-edu.com` | Real. Built in M12; deployed from a release tag with approval |

There are no pull-request preview environments in v1 (D18): CI runs every test against Docker services instead.

### Paths on `quad-edu.com` (D14, D15)

| Path | Served by | What |
|---|---|---|
| `/` | `apps/staff` | Landing page ([19](19-public-site.md)) |
| `/sign-in` | `apps/staff` | Sign-in page (the same flow as the landing dialog) |
| `/app/*` | `apps/staff` | Signed-in staff portal |
| `/p/*` | `apps/staff` | Parent-app universal links: open the app when installed, otherwise a "Get the Quad app" page |
| `/legal/*` | `apps/staff` | Terms, privacy, DPA, sub-processors |
| `/.well-known/apple-app-site-association`, `/.well-known/assetlinks.json` | `apps/staff` | App-link files covering only `/p/*` |
| `/api/v1/*` | `apps/api` | REST API; OpenAPI at `/api/v1/openapi.json`. Routes in [06](06-api-and-events.md) are written relative to `/api/v1` |
| `/socket.io/*` | `apps/api` | Realtime (`wss://quad-edu.com/socket.io`) |

The console is on `console.quad-edu.com`; its API is `https://console.quad-edu.com/api/v1/platform/*`. Serving the API on the same origin keeps the session cookie first-party and removes CORS for the web apps. The parent app calls `https://quad-edu.com/api/v1`. `www.quad-edu.com` redirects to `quad-edu.com`. Edge routing, TLS and DNS are in [20](20-infrastructure-operations.md#edge-and-routing).

Configuration comes only from environment variables, validated at boot with Zod (`apps/api/src/config.ts`; the web apps validate their own public variables at build). See [Repository bootstrap → Environment variables](#environment-variables).

## Local development

Prerequisites (versions in [Repository bootstrap](#versions)): Node 22 LTS (`nvm use` reads `.nvmrc`), pnpm 9 through Corepack (`corepack enable`), Docker Desktop (or Colima), Flutter through FVM (`fvm install` reads `.fvmrc`; check with `fvm flutter doctor`), Java 17 (for `openapi-generator`), Xcode for iOS, Android Studio for Android, and a Firebase project for push (optional locally).

```
corepack enable && pnpm install
cp .env.example .env            # fill ANTHROPIC_API_KEY, gateway sandbox keys (optional)
docker compose up -d            # postgres:16, redis:7, minio, mailpit, clamav
pnpm db:migrate && pnpm db:seed # sample platform + Colombo International School (Cambridge) + Kandy Hill Academy (Sri Lankan)
pnpm dev                        # api :4000, worker, staff :3000, console :3001
pnpm parent:run                 # flutter run --flavor dev (simulator or device); API_URL points at your machine
```

On an Android emulator the API is at `http://10.0.2.2:4000/api/v1`; on a physical device use your machine's LAN address (`--dart-define=API_URL=…`).

Seeded sign-ins (local only): `owner@quad.local` (platform owner, console; email, password and TOTP because `CONSOLE_PASSWORD_LOGIN=true` locally, D22), `prishan.maduka@colombo-intl.local` (school admin), `nadeesha.jayasinghe@colombo-intl.local` (class teacher, Year 4 – Emerald), `ruwan.mendis@quad.local` (teacher at both seeded schools), parent phone `+94 77 000 0001` (Dilhani Perera, children Amaya and Kavindu). Seeded passwords come from `SEED_PASSWORD` in `.env`. Local one-time passwords, OTPs and TOTP codes are always `000000` (`DEV_FIXED_OTP`, refused at boot outside local and staging) and are printed to the API log.

Open `http://localhost:3000`, sign in as a seeded user, and the API picks the school from your memberships. `ruwan.mendis@quad.local` belongs to both seeded schools, so it shows **Choose a school**.

## Repository bootstrap

Built in M0. Infrastructure and deploys are in [20 Infrastructure and operations](20-infrastructure-operations.md).

### Versions

| Tool | Policy |
|---|---|
| Node.js | 22 LTS, pinned in `.nvmrc`; `"engines": {"node": ">=22 <23"}` in the root `package.json` |
| pnpm | `"packageManager": "pnpm@9.x.y"` (exact version) in the root `package.json`, used through Corepack |
| Flutter and Dart | Exact stable version pinned in `.fvmrc` (FVM); CI reads the same file. Upgrades are a deliberate pull request |
| Java | 17 (Temurin), only for `openapi-generator` (Dart client) |
| Docker images | Pinned to a minor tag in `docker-compose.yml` and the Dockerfiles; Renovate opens upgrade pull requests |
| npm and pub packages | Exact versions in lockfiles (`pnpm-lock.yaml`, `pubspec.lock`); Renovate groups updates weekly |

### Root scripts (`package.json`)

| Script | Runs |
|---|---|
| `dev` | `turbo run dev --filter=!@quad/parent`: API on :4000 (watch), worker, staff on :3000, console on :3001 |
| `build` | `turbo run build`: every app and package (Next.js production builds, API `dist`, Docker-ready output) |
| `typecheck`, `lint`, `format` | `turbo run typecheck` / `turbo run lint` (ESLint, and `flutter analyze` through `apps/parent/package.json`) / Prettier and `dart format` |
| `db:migrate` | `pnpm --filter @quad/db migrate`: applies Drizzle migrations as `quad_owner` (`DATABASE_OWNER_URL`) |
| `db:generate` | `drizzle-kit generate`: writes a new migration from schema changes |
| `db:seed` | `pnpm --filter @quad/db seed`: the deterministic sample platform ([17](17-testing-quality.md#fixtures)) |
| `db:reset` | Drops the local database, then `db:migrate` and `db:seed`. Refuses unless `APP_ENV=local` |
| `api:client` | Builds the API's OpenAPI document without starting a server, writes `packages/contracts/openapi.json`, then runs `openapi-typescript` into `packages/client` and `openapi-generator` (`dart-dio`) into `apps/parent/packages/quad_api` |
| `tokens:build` | `pnpm --filter @quad/tokens build`: Tailwind `@theme` CSS, `tokens.css` and `apps/parent/lib/theme/tokens.g.dart` |
| `i18n:build` | Validates `packages/contracts/i18n/en.json` (ICU syntax, no unused keys) and writes `apps/parent/lib/l10n/app_en.arb` |
| `codegen:check` | Runs `api:client`, `tokens:build` and `i18n:build`, then fails if `git diff` is not empty |
| `parent:run` | `cd apps/parent && fvm flutter run --flavor dev --dart-define-from-file=env/dev.json` |
| `test` | `turbo run test`: Vitest unit tests and `flutter test` (unit, widget, golden) |
| `test:api` | Integration tests against Postgres 16 and Redis 7 from Docker Compose locally or CI service containers, each test file on its own freshly migrated database; needs Docker |
| `e2e` | Playwright journeys for completed milestones against a production build of staff and console and the local API |
| `e2e:mobile` | `integration_test` against the local API, then Maestro flows on a booted simulator or emulator |
| `eval:assistant` | The Ask Quad evaluation runner ([11](11-ask-quad.md#evaluation-m10)); calls the paid API, so it runs only by hand |
| `verify` | The quality gate ([17](17-testing-quality.md#quality-gate-pnpm-verify)): `typecheck`, `lint`, `test`, `codegen:check`, `test:api`, `e2e` smoke, `pnpm audit --prod --audit-level high`, in that order, stopping at the first failure (`scripts/verify.mjs`). Excludes `e2e:mobile` (Maestro runs nightly) and `eval:assistant` |

### Turborepo pipeline (`turbo.json`)

| Task | Depends on | Outputs and caching |
|---|---|---|
| `build` | `^build`, `tokens:build` | `dist/**`, `.next/**` (excluding `.next/cache`) |
| `dev` | `^build` | Not cached; persistent |
| `typecheck` | `^build` | Cached; no outputs |
| `lint` | – | Cached; no outputs |
| `test` | `^build` | Cached; `coverage/**` |
| `test:api` | `^build` | Not cached (uses containers) |
| `e2e` | `build` | Not cached; `playwright-report/**` |
| `tokens:build` | – | `packages/tokens/dist/**`, `apps/parent/lib/theme/tokens.g.dart` |
| `i18n:build` | – | `apps/parent/lib/l10n/*.arb` |

`globalDependencies` includes `.env.example`, `.nvmrc` and `.fvmrc`; `globalEnv` lists `APP_ENV` and `NODE_ENV` so cached outputs never cross environments. `globalPassThroughEnv` passes `CI` and `QUAD_REQUIRE_FLUTTER` to tasks without hashing them.

`apps/parent/turbo.json` overrides `lint`, `typecheck` and `test` for the Flutter app: they also hash `CI` and `QUAD_REQUIRE_FLUTTER` and take `scripts/flutter.mjs` as an input. `scripts/flutter.mjs` skips Flutter checks only when neither is set, so a cached skip can never replay in CI or with `QUAD_REQUIRE_FLUTTER=1` (D27).

### Docker Compose services

| Service | Image | Ports | Notes |
|---|---|---|---|
| `postgres` | `postgres:16` | 5432 | Init script creates `quad_owner`, `quad_app` and `quad_platform` and the `pg_trgm` and `citext` extensions |
| `redis` | `redis:7` | 6379 | Queues, sessions cache, Socket.IO adapter, rate limits |
| `minio` | `minio/minio` | 9000 (S3 API), 9001 (console) | Buckets `quad-private` and `quad-public` created on start |
| `mailpit` | `axllent/mailpit` | 1025 (SMTP), 8025 (web UI) | Catches every email |
| `clamav` | `clamav/clamav` | 3310 | Virus scanning for uploads (`scan-file` job) |

### Environment variables

`.env.example` lists every variable with a one-line comment and no values. The API refuses to boot if a required variable is missing or malformed, and refuses local-only flags in production.

| Area | Variables |
|---|---|
| General | `APP_ENV` (`local`, `staging`, `production`); `NODE_ENV`; `LOG_LEVEL`; `PUBLIC_WEB_URL` (the `quad-edu.com` origin); `CONSOLE_URL`; `API_PORT`; `TRUST_PROXY_HOPS` (how many proxies in front of the API are trusted for `X-Forwarded-For`: 2 on AWS, CloudFront and the ALB; 0 locally) |
| Database | `DATABASE_URL` (connects as `quad_app`); `DATABASE_PLATFORM_URL` (as `quad_platform`, for `withPlatform`); `DATABASE_OWNER_URL` (as `quad_owner`, migrations only); `DATABASE_POOL_MAX` |
| Redis | `REDIS_URL` |
| Sessions and tokens | `SESSION_SECRET` (cookie signing); `LINK_SIGNING_SECRET` (HMAC for signed links, D16); `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` (parent access tokens); `FIELD_ENCRYPTION_KEY` (local) or `KMS_KEY_ID` (AWS) for field-level encryption |
| Staff SSO | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`; `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` |
| Console sign-in | `CONSOLE_GOOGLE_CLIENT_ID`, `CONSOLE_GOOGLE_CLIENT_SECRET`; `CONSOLE_GOOGLE_HD` (allowed Workspace domain, `quad-edu.com`); `CONSOLE_PASSWORD_LOGIN` (email + password + TOTP for seeded platform users; refused in production, D22) |
| Local and test helpers | `DEV_FIXED_OTP` (`000000`; refused in production); `SEED_PASSWORD` (password for seeded accounts); `STORE_REVIEW_PHONE` (the one number that accepts a fixed OTP in production, linked only to the app-review demo school) |
| Files | `S3_ENDPOINT` (MinIO locally, empty on AWS); `S3_REGION`; `S3_BUCKET_PRIVATE`; `S3_BUCKET_PUBLIC`; `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (local only; task roles on AWS); `CDN_URL`; `CLOUDFRONT_KEY_PAIR_ID`, `CLOUDFRONT_PRIVATE_KEY` (signed download URLs); `CLAMAV_HOST`, `CLAMAV_PORT` |
| Email | `EMAIL_PROVIDER` (`smtp` or `ses`); `SMTP_URL` (Mailpit); `SES_REGION`; `SES_CONFIGURATION_SET` (bounce and complaint events); `EMAIL_FROM_DOMAIN` (`mail.quad-edu.com`); `SUPPORT_INBOX` (`support@quad-edu.com`); `SALES_INBOX` (`sales@quad-edu.com`) |
| SMS | `SMS_PROVIDER` (`log` or `live`); `NOTIFYLK_USER_ID`, `NOTIFYLK_API_KEY`, `NOTIFYLK_DEFAULT_SENDER` (`QUAD`); `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID` |
| Push | `PUSH_PROVIDER` (`log` or `fcm`); `FCM_PROJECT_ID`; `FCM_SERVICE_ACCOUNT_JSON` |
| Platform billing (Quad's own accounts, D20) | `PLATFORM_PAYHERE_MERCHANT_ID`, `PLATFORM_PAYHERE_MERCHANT_SECRET`; `PLATFORM_STRIPE_SECRET_KEY`, `PLATFORM_STRIPE_WEBHOOK_SECRET`; `PAYMENTS_SANDBOX` (use gateway sandboxes). School gateway credentials are stored encrypted per school, not in env |
| Public site | `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` (demo request captcha); `PLAUSIBLE_DOMAIN` (analytics, empty to turn off) |
| Ask Quad | `ANTHROPIC_API_KEY`; `ASSISTANT_MODEL` (`claude-opus-5-5`); `ASSISTANT_ENABLED` (platform kill switch) |
| Parent app config | `MIN_APP_VERSION_IOS`, `MIN_APP_VERSION_ANDROID` (returned by `GET /app/config` for force update) |
| Observability | `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`, `OTEL_SERVICE_NAME`; `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE` |
| Web public (build time) | `NEXT_PUBLIC_APP_ENV`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` |

The Flutter app does not read `.env`. Each flavor has `apps/parent/env/<flavor>.json` (`API_URL`, `SOCKET_URL`, `SENTRY_DSN`, `APP_ENV`) passed with `--dart-define-from-file`, plus its own Firebase files (`google-services.json`, `GoogleService-Info.plist`), which are not committed for staging and production.

## Cross-app data flows (formerly localStorage in the prototypes)

The prototypes pass data between apps through `localStorage` keys. In production each becomes an API resource with realtime events:

| Prototype key | Becomes | Realtime event |
|---|---|---|
| `quad-school` (branding, curriculum) | `tenants`, `tenant_branding`, `academic_structure` | `tenant.branding.updated`, `academic.structure.updated` |
| `quad-reports` | `report_cycles` publish state | `report.published` |
| `quad-pe`, `quad-pe-book` | `events`, `event_slots`, `event_bookings` | `event.booking.created/cancelled` |
| `quad-forms`, `quad-form-replies` | `forms`, `form_responses` | `form.response.created` |
| `quad-exams` | `exam_series` published | `exam.series.published` |
| `quad-payments` | `payment_settings` | `payments.settings.updated` |
| `quad-moments`, `quad-moment-reacts` | `moments`, `moment_reactions` | `moment.created`, `moment.reaction.created` |
| `quad-parent-moments-seen` | `moment_reads` | – |

## Decision log

Record every decision that changes this spec. Newest last.

| # | Date | Decision | Why |
|---|---|---|---|
| D1 | 2026-10-05 | TypeScript for the API and web apps; NestJS API; Next.js web apps | Shared Zod contracts between API and web, strong hiring market, Claude Code works well with it |
| D2 | 2026-10-05 | Shared Postgres schema with `tenant_id` + row-level security, not schema-per-tenant | Simpler migrations and analytics; RLS gives defence in depth |
| D3 | 2026-10-05 | Console is a separate Next.js app and deploy | Different audience, stronger isolation, separate cookie domain |
| D4 | 2026-10-05 | Build auth in the API instead of a hosted identity service | Parents sign in by phone OTP across schools; schools need SSO; data must stay in region |
| D5 | 2026-10-05 | Ask Quad uses the Claude API with read-only, tenant-scoped tools (not text-to-SQL) | Safety, permission checks per tool, explainable sources |
| D6 | 2026-10-05 | Palette A (indigo, coral, lilac), Figtree type, four-tile logo | Chosen by the product owner |
| D7 | 2026-10-05 | English only in v1, built for localisation | Product owner removed Sinhala and Tamil greetings; i18n framework kept |
| D8 | 2026-10-05 | Quad Circle ships as Moments inside the existing apps (superseded by D11) | Product owner chose the simplest version |
| D9 | 2026-10-06 | Tailwind CSS v4 for all web front-end styling | Product owner decision |
| D10 | 2026-10-06 | The parent app is built with Flutter (not Expo / React Native) | Product owner decision. Consequences: the OpenAPI document is the contract for mobile; business logic stays on the server; tokens and strings are generated to Dart; push uses FCM directly |
| D11 | 2026-10-06 | Replaces D8: the full Quad Circle ships inside the parent app and staff portal (Circle tab, Home day ring, My teaching cards, Family connection), with relatives as a separate `kind: relative` token limited to moments | Product owner asked for the full Circle concept in the parent app. A separate token kind keeps relatives out of every other `/family` route by default instead of relying on per-route checks |
| D12 | 2026-10-06 | One domain, `quad-edu.com`, for every school. The school is chosen from the signed-in person's memberships, not from the host. Global accounts with per-school memberships. API on the same origin under `/api`. No subdomains or custom domains per school | Product owner decision. Simpler DNS, TLS and onboarding (creating a school is only a database operation); one public landing page with sign-in. Consequences: identifier-first sign-in, a school picker for people in several schools, and a narrow cross-tenant lookup at sign-in |
| D13 | 2026-10-06 | One Quad parent app for every school, not white-label builds. Store name "Quad – School & Family"; bundle ids `com.quadedu.parent` (+ `.dev`, `.staging`). Splash and first-run sign-in are Quad-branded; after sign-in, and on later launches from the remembered school, the app applies the school's logo, colour and name. `tenant_branding.app_store_name` and the wizard's app-listing step are removed | One store listing to review and maintain; parents at two schools need one app; matches D12 |
| D14 | 2026-10-06 | Paths on `quad-edu.com`: `/` landing, `/sign-in`, `/app/*` staff portal, `/p/*` parent-app universal links (app when installed, otherwise "Get the Quad app"), `/api/v1/*`, `/socket.io/*`, `/legal/*`. The app-link files are served by `apps/staff` and cover only `/p/*` | Staff links under `/app` must never open the parent app on a phone that has it installed |
| D15 | 2026-10-06 | API base path `https://quad-edu.com/api/v1` (OpenAPI at `/api/v1/openapi.json`); routes in 06 are relative to it. Console API at `https://console.quad-edu.com/api/v1/platform/*`. Socket.IO at `wss://quad-edu.com/socket.io` | Versioned API for the mobile app, which cannot be updated in step with the server |
| D16 | 2026-10-06 | The only tenant-less entry points are: sign-in (`auth_memberships`), signed links (HMAC-SHA256 token with purpose, tid, subject, expiry and nonce), payment webhooks (signature first, then `tenant_by_gateway_account`), the public enquiry form (`tenant_by_embed_key`) and demo requests (platform-level, no tenant) | Every way of finding a tenant without a session is named, narrow and tested; nothing trusts plain URL input |
| D17 | 2026-10-06 | Migrations run as `quad_owner`; the API and worker connect as `quad_app` (no `BYPASSRLS`); every [T] table has `ENABLE` and `FORCE ROW LEVEL SECURITY`. Console code and cross-tenant jobs use `withPlatform()` on a `quad_platform` pool (`BYPASSRLS`), allowed only in `apps/api/src/platform/**` and `apps/api/src/worker/platform-jobs/**` (lint-enforced). Every [T] table, child tables included, carries `tenant_id` with a composite index | RLS only protects if the app role cannot bypass it and every row carries the tenant; a named, linted escape hatch keeps platform work possible |
| D18 | 2026-10-06 | AWS `ap-south-1`: Route 53, ACM, CloudFront + WAF in front of an ALB, ECS Fargate (api, worker, staff, console, clamav), RDS PostgreSQL 16 Multi-AZ + RDS Proxy, ElastiCache Redis 7, S3, Secrets Manager, OpenTelemetry to Grafana Cloud (or CloudWatch), Sentry; Terraform in `infra/`. Migrations as a one-off ECS task, expand/contract only. Staging and CI deploys in new milestone M0b; production in M12. No pull-request preview environments in v1 | Deploying from the start finds problems early; previews cost more than they return at this size |
| D19 | 2026-10-06 | Providers: Amazon SES from `mail.quad-edu.com` (SPF, DKIM, DMARC `p=quarantine`; the apex keeps Google Workspace), From "School Name via Quad", Reply-To the school office; Notify.lk for +94 and Twilio elsewhere, SMS cost passed to schools on the platform invoice; FCM HTTP v1 with one Firebase project per environment; fastlane in GitHub Actions; Anthropic API | Settles the open "or" choices so the adapters and setup can be built once |
| D20 | 2026-10-06 | School fees go through each school's own gateway account (PayHere merchant or Stripe account), entered by the school admin in Fees → Online payments (encrypted, test or live mode); money settles to the school and Quad never holds school fees. Quad bills schools through its own PayHere and Stripe accounts and bank transfer, with platform invoices generated by Quad | Keeps Quad out of handling client money; schools keep their banking relationships |
| D21 | 2026-10-06 | School data is stored and processed in `ap-south-1`. Named sub-processors handle limited data outside the region (Anthropic for Ask Quad prompts, Google Firebase for push, Sentry with PII scrubbing, SES, Notify.lk and Twilio for delivery); the privacy policy, DPA and sub-processor list say so, and schools can turn Ask Quad off | Honest residency promise that matches how the system actually works |
| D22 | 2026-10-06 | Console sign-in in production is Google Workspace SSO (`@quad-edu.com`) + TOTP; local, dev and staging also allow email + password + TOTP for seeded platform users (`CONSOLE_PASSWORD_LOGIN=true`, refused in production). Support "sign in as" always requires a reason (spec wins over prototype) | Developers and CI can sign in to the console without a Workspace account; production stays SSO-only |
| D23 | 2026-10-06 | Engineering conventions live as Claude Code skills in `.claude/skills/quad-*` (architecture, reuse, coding standards, TDD, recipes for endpoints, tenant tables, domain logic, web and Flutter screens, debugging, review), alongside the Superpowers plugin. Added conventions: composite `(tenant_id, id)` foreign keys between tenant tables where practical; `@quad/domain` has a 100% branch coverage threshold with `fast-check` property tests for money and scheduling invariants; other packages import `@quad/domain` only through its index | One place for how we build, loaded automatically when relevant, so every milestone follows the same patterns |
| D24 | 2026-10-06 | Database foundations (M0): ids are UUID v7 generated in TypeScript (`uuidv7()` in `@quad/db`), with `gen_random_uuid()` as the column default only as a fallback for hand-written SQL until Postgres has a native v7. The first migration carries its own bootstrap (`citext`, `pg_trgm`, `USAGE` on `public`, default privileges for `quad_owner`'s tables, no default `EXECUTE` on functions for `PUBLIC`) because default privileges are per database and per schema. `quad_app` gets table privileges only through `tenantRlsSql` (explicit grants per tenant table), never by default; only `quad_platform` has default DML on new tables. So `tenants` and every later platform table are closed to `quad_app` (reached through `withPlatform` or the D16 security-definer functions), and the migration test reports any `quad_app` privilege on a platform table, any tenant table missing `quad_app` DML, and any permissive policy other than the exact tenant match; school-context reads of a school's own settings will go through a named function or a tenant table, not a grant. Policies use `nullif(current_setting('app.tenant_id', true), '')::uuid`, so a query with no school sees no rows instead of failing. `tenants.health_override` uses the `school_health_level` enum. Seed data is written as `quad_owner`, not through `withPlatform`. The platform pool is only reachable through `createPlatformDb` / `withPlatform`, both lint-restricted to the platform folders (`createDb` is split into `createTenantDb` and `createPlatformDb`, so a tenant-side handle never carries platform access) | A fresh test database, a reset and production all get the same grants from the migrations; `quad_app` cannot list every school |
| D25 | 2026-10-06 | API foundations (M0): NestJS 11 on Fastify (a root `pnpm.overrides` entry `@nestjs/platform-fastify>fastify` lifts Fastify to 5.12.5 because `@nestjs/platform-fastify` 11.2.7 pins 5.11.3, which has security advisories; drop it once Nest ships a newer pin). The API is bundled with tsup (SWC, for the decorator metadata Nest's injection needs) into CommonJS `dist/main.js`, `dist/worker.js` and `dist/openapi-export.js`, with the `@quad/*` workspace packages bundled in (they ship TypeScript source) and every npm package left external, including the ones the workspace packages use (`pg`, `drizzle-orm` are apps/api dependencies for that reason; `scripts/check-dist.mjs` fails the build if any npm source is inlined); Vitest uses `unplugin-swc` for the same reason. `main.ts` and `worker.ts` load the root `.env` only when `APP_ENV` is unset or `local`, validate config, start OpenTelemetry (off when `OTEL_EXPORTER_OTLP_ENDPOINT` is empty), then `import()` the rest so the HTTP, Fastify (`@fastify/otel`), pg and ioredis instrumentations apply. Logging is plain pino (not `nestjs-pino`): a mixin adds `requestId`, `tenantId` and `userId` from one AsyncLocalStorage request context, and the request log records the route template, never the raw URL (signed-link tokens live in paths). Errors: typed `AppError` subclasses and a global filter; anything unexpected is a 500 with the new error code `internal`, logged without its message reaching the client; a `statusCode` is trusted only on Nest `HttpException`s and Fastify (`FST_`) errors. `TRUST_PROXY_HOPS` (new variable) sets how many proxies are trusted for `X-Forwarded-For`, counted from the socket, because Fastify 5.12 no longer accepts a bare hop count; this relies on the API being reachable only through those proxies. `/health/ready` reuses its result for 2 s and shares one check between concurrent callers, so probes cannot multiply database and Redis connections. OpenAPI routes are declared next to each controller (`<area>.routes.ts`) and listed explicitly in `src/openapi/document.ts`, so the document builds without starting the server. `.env.example` carries placeholder `SESSION_SECRET` and `LINK_SIGNING_SECRET` values so a plain copy boots locally; the API refuses those values, secrets under 32 characters, equal session and link secrets, and the compose database passwords outside local | One build and test path that keeps Nest's injection working with workspace packages in TypeScript; one source for log context; no undocumented route can be added without a failing test, and `cp .env.example .env` is enough to run locally without weakening staging or production |
| D26 | 2026-10-07 | Parent app foundations (M0): `apps/parent` is a Flutter shell with Riverpod (`riverpod_generator`, generated `*.g.dart` committed), a `go_router` `StatefulShellRoute` for the five tabs, and `ThemeData` from the generated `QuadColors` with Figtree bundled (static 400–800 TTFs, OFL). Flavors `dev`/`staging`/`prod` are Android product flavors and iOS `<Mode>-<flavor>` configurations with one xcconfig each and a shared scheme per flavor; `dev` is the default flavor; launcher names "Quad Dev", "Quad Staging" and "Quad" for `prod` (spec 09; the store listing name stays "Quad – School & Family"). `env/<flavor>.json` uses the API's `APP_ENV` values (`local`, `staging`, `production`) and is checked at launch (http(s)/ws(s) URLs, TLS outside `local`). Until `GET /family/home` exists (M6) the Home greeting comes from the device clock with the `packages/domain` bands mirrored in `lib/core/greeting.dart` (spec 03's offline fallback). `pnpm api:client` also runs `build_runner` in `packages/quad_api` and commits its `*.g.dart`, using a pinned pubspec template (`scripts/openapi-templates/dart-dio`); `i18n:build` writes a plural's `#` as `{arg}` because Flutter gen-l10n has no `#`; the gen-l10n Dart output is not committed (`flutter pub get` regenerates it). Flutter commands in package scripts go through `scripts/flutter.mjs` (FVM, else `flutter` on PATH, else a skip outside CI) | One parent app that builds per environment from git alone, with codegen that is reproducible and checked, and tests that run on machines without FVM |
| D27 | 2026-10-07 | Repository and CI foundations (M0): Flutter is pinned in `.fvmrc` (3.47.6) and CI reads the same file; CI sets `QUAD_REQUIRE_FLUTTER=1` so the parent app's checks fail rather than skip. `docker-compose.yml` images take an optional `QUAD_IMAGE_REGISTRY` prefix for registry mirrors. The staff `/` route is a placeholder until the public landing page (M1b). A root `pnpm.overrides` entry `next>postcss` lifts PostCSS to 8.5.29 because Next 15.5.27 pins 8.4.31, which has high-severity advisories that fail `pnpm audit --prod --audit-level high`; drop it once Next ships a newer pin. The migration test's `PLATFORM_TABLES` allowlist names the tables without `tenant_id`; every other table must pass the tenant checks. Contrast (AA): filled brand surfaces (the staff portal's active rail item, the parent app's active tab pill and label) use a new `brand-fill` token, because the default brand `#DD4A42` is 4.09:1 with white and `brand-fill` `#D0463E` is 4.54:1; `ink-3` is only for icons and large text (small text uses `ink-2`), and status tone fills become a tint with ink text and a ring. Deferred: a CSP nonce or hash for the inline theme bootstrap script (M9), the academic-year picker (M1/M3, once year data exists) and the floating Ask Quad pill (M10). CI (`.github/workflows/ci.yml`) runs on pull requests, on pushes to `main`, `develop` and `claude/**` (working branches are pushed without a pull request) and by hand (`workflow_dispatch`); in M0 it is one required check, "Verify and build" (`pnpm verify`, then `pnpm build`); the API production bundle and `scripts/check-dist.mjs` run in that Build step (`pnpm build`), not in `pnpm verify`, and splitting it into the named checks in [17](17-testing-quality.md#ci-github-actions) and [20](20-infrastructure-operations.md) is deferred to M0b. Compose publishes every port on `127.0.0.1` only; M6 needs a bind-address override so a physical phone can reach MinIO. `scripts/` is the `@quad/scripts` workspace package, so turbo's `lint`, `typecheck` (strict `checkJs` over the `.mjs` files), `test` and `test:api` cover the repository scripts. `pnpm verify` waits for Postgres and Redis (`scripts/check-services.mjs`, host and port from `DATABASE_URL` and `REDIS_URL`) before `test:api`. `@quad/domain`'s `test` runs with coverage, so the D23 threshold fails the run. `.only` fails in Vitest and Playwright everywhere, not only in CI; Playwright's `webServer` only runs `next start` on turbo's build and never reuses a running server. `quad/no-arbitrary-colour` (react config) flags Tailwind arbitrary colours and literal colours in `style`. `i18n:build` fails on an unused `en.json` key: a key is used when web sources quote it, a template prefix covers it (`` `theme.${choice}` ``) or `apps/parent/lib` calls its camel-cased getter; keys kept on purpose are listed with a reason in `UNUSED_ON_PURPOSE` (`packages/contracts/src/i18n/cli.ts`). The parent app's `SOCKET_URL` is a bare origin in every flavor; the client sets the Socket.IO path. M0 follow-ups: <ul><li>a `GreetingPeriod` type in `@quad/contracts` so `packages/ui` drops `@quad/domain`, and the API returning the greeting (M1)</li><li>one gated `.env` loader shared by the API and the db scripts (M1)</li><li>RTL unit tests for `Kpi`, `Pill`, `Tabs`, `Checkbox`, `Field` and `Textarea` (M1)</li><li>connection reset also running `pg_advisory_unlock_all()` and `DISCARD TEMP` after `RESET ALL` (M1)</li><li>the platform-table check covering column grants and sequences (M1)</li><li>scrubbing pg error details from logs (M1)</li><li>format rules for `FIELD_ENCRYPTION_KEY` and the JWT keys (M2/M7)</li><li>a `trustHops` test with 2 hops and `TRUST_PROXY_HOPS=2` for CloudFront plus the ALB (M0b)</li><li>MinIO and ClamAV compose healthchecks (M4)</li><li>a WebKit project for drawer focus (M1)</li></ul> | The gate runs the same everywhere, prototype colours that miss 4.5:1 are corrected once in the tokens, and the gaps left in M0 have a named milestone |
