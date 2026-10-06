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
| Staff portal | Next.js 15 (App Router), React 19, Tailwind CSS v4 | `apps/staff`, served on `{school}.quad.school` |
| Platform console | Next.js 15 (App Router), React 19, Tailwind CSS v4 | `apps/console`, served on `console.quad.school`, separate deploy and cookie domain |
| Parent app | Flutter (latest stable) and Dart 3 | `apps/parent`; iOS and Android. See [Parent app (Flutter)](#parent-app-flutter) |
| Web styling | **Tailwind CSS v4** for all front-end styling. Tokens from `packages/tokens` are mapped into Tailwind's `@theme`; Radix UI primitives for behaviour; `class-variance-authority` + `tailwind-merge` for component variants | No CSS-in-JS, CSS modules or component-library themes. Components live in `packages/ui` |
| Mobile styling | Flutter `ThemeData` + `ThemeExtension`s generated from `packages/tokens` (Dart file) | |
| Data fetching (web) | TanStack Query 5 + a typed client generated from OpenAPI (`openapi-typescript` + `openapi-fetch`) | `packages/client` |
| Data fetching (mobile) | `dio` + a Dart client generated from the same OpenAPI document (`openapi-generator`, `dart-dio`) | `apps/parent/packages/quad_api` |
| Forms | react-hook-form + Zod resolver | |
| Charts | visx (web), `fl_chart` (mobile) | Follow chart rules in [03](03-design-system.md#charts) |
| Auth | Built in the API (see [05](05-auth-tenancy-rbac.md)); Argon2id; OIDC via `openid-client`; TOTP via `otplib` | |
| Files | S3-compatible storage (AWS S3; MinIO locally); `sharp` for images | Presigned uploads |
| Email / SMS / push | Adapters: Resend or Amazon SES; Notify.lk or Twilio; Firebase Cloud Messaging (FCM HTTP v1, with APNs for iOS through Firebase) | Mailpit and a log sink locally |
| Payments | PayHere (LKR cards and wallets), Stripe (international cards), bank transfer | Adapter per gateway; webhooks |
| AI | Anthropic TypeScript SDK `@anthropic-ai/sdk`, model `claude-opus-5-5` | See [11](11-ask-quad.md) |
| Search | PostgreSQL full-text search + `pg_trgm` | Ctrl K command palette |
| Observability | OpenTelemetry traces, Pino JSON logs, Sentry errors | |
| Testing | Vitest, Testcontainers (Postgres, Redis), Supertest, Playwright (web); `flutter_test`, golden tests, `integration_test` and Maestro (mobile) | See [17](17-testing-quality.md) |
| Hosting | AWS `ap-south-1` (Mumbai): ECS Fargate, RDS PostgreSQL, ElastiCache Redis, S3 + CloudFront | Terraform in `infra/` (milestone M12) |

## Monorepo layout

```
quad/
├── apps/
│   ├── api/              # NestJS API, workers (same image, different entrypoint)
│   │   ├── src/modules/  # one folder per area: tenants, auth, users, students, attendance, …
│   │   ├── src/worker.ts # BullMQ workers and schedulers
│   │   └── test/         # API integration tests (Testcontainers)
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
├── design/               # HTML prototypes (reference only; never imported by apps)
├── docs/spec/            # This specification
├── infra/                # Terraform (M12)
├── docker-compose.yml    # Postgres, Redis, MinIO, Mailpit
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
| Routing and deep links | `go_router` (`quad://moments/{id}`, `quad://pay/{invoiceId}`, universal links on `{school}.quad.school/app/...`) |
| API | Generated `quad_api` (dio) with an auth interceptor for token refresh; models with `freezed` and `json_serializable` |
| Secure storage | `flutter_secure_storage` (refresh token) |
| Biometrics | `local_auth` (Face ID, fingerprint, device passcode fallback) |
| Push | `firebase_messaging` + `flutter_local_notifications` (foreground banners) |
| Realtime | `socket_io_client` |
| Offline cache | `drift` (SQLite) for Home, timetable, moments, messages and invoices |
| Images | `cached_network_image` |
| SVG and logo | `flutter_svg` with the files from `design/brand/` |
| Charts | `fl_chart` |
| Maps (bus) | `flutter_map` (OpenStreetMap tiles) behind an interface, so Google Maps can replace it |
| QR (pickup pass) | `qr_flutter` |
| Payments | PayHere Flutter SDK (`payhere_mobilesdk_flutter`) and `flutter_stripe` |
| Localisation | `flutter_localizations` + `intl` with ARB files generated from `packages/contracts/i18n/en.json` |
| Fonts | Figtree bundled as assets |
| Lint | `very_good_analysis` |
| Builds | Flavors `dev`, `staging`, `prod`; one white-label build per school uses a config file (name, bundle id, icon, colour). CI builds with GitHub Actions + `fastlane` (or Codemagic) |

Folder layout in `apps/parent/lib`: `features/<area>/` (screens, widgets, providers per feature: home, moments, children, payments, messages, school_life, more, auth, assistant), `ui/` (shared widgets that mirror `packages/ui`), `theme/`, `l10n/`, `core/` (API, storage, push, realtime).

## Tenancy

- Shared database and schema. Every school-owned table has `tenant_id uuid not null` and a row-level security policy `tenant_id = current_setting('app.tenant_id')::uuid`.
- The API opens a transaction per request and runs `select set_config('app.tenant_id', $1, true)` before any query. A Drizzle wrapper (`withTenant(tenantId, fn)`) enforces this; a lint rule bans the raw client outside `packages/db`.
- Platform tables (tenants, plans, curricula templates, platform users, platform audit) have no `tenant_id` and are only reachable from console routes.
- Tenant resolution:
  - Staff portal: from the host (`colombo-intl.quad.school` → subdomain `colombo-intl`), or a verified custom domain.
  - Parent app: a guardian belongs to one or more tenants. After sign-in, the API returns the guardian's memberships. The app shows the school picker only if there is more than one.
  - API: tenant comes from the session or token, never from a request body. Console routes that act on a school take `/:tenantId` and require a platform role.
- Each tenant has `region` (`ap-south`, `me-central`, `ap-southeast`). v1 deploys one region and stores the field for later.
- Plan limits (student seats, modules) are enforced in the API by a `PlanGuard` (see [05](05-auth-tenancy-rbac.md#plan-and-module-guard)).

## Environments

| Env | Hosts | Data |
|---|---|---|
| local | `*.localhost:3000` (staff), `console.localhost:3001`, `api.localhost:4000`, the Flutter app on a simulator or device | Docker Compose, seeded sample school |
| preview | One per pull request (staff, console, api), seeded | Ephemeral |
| staging | `*.staging.quad.school` | Anonymised copy plus sample schools |
| production | `*.quad.school`, `console.quad.school`, `api.quad.school` | Real |

Configuration comes only from environment variables, validated at boot with Zod (`apps/api/src/config.ts`). See `.env.example`.

## Local development

Prerequisites: Node 22, pnpm 9, Docker Desktop (or Colima), Flutter (latest stable; check with `flutter doctor`), Xcode for iOS, Android Studio for Android, and a Firebase project for push (optional locally).

```
pnpm install
cp .env.example .env            # fill ANTHROPIC_API_KEY, gateway sandbox keys (optional)
docker compose up -d            # postgres:16, redis:7, minio, mailpit
pnpm db:migrate && pnpm db:seed # sample platform + Colombo International School (Cambridge) + Kandy Hill Academy (Sri Lankan)
pnpm dev                        # api :4000, worker, staff :3000, console :3001
pnpm parent:run                 # flutter run --flavor dev (simulator or device); API_URL points at your machine
```

On an Android emulator the API is at `http://10.0.2.2:4000`; on a physical device use your machine's LAN address (`--dart-define=API_URL=…`).

Seeded sign-ins (local only): `owner@quad.local` (platform owner), `prishan.maduka@colombo-intl.local` (school admin), `nadeesha.jayasinghe@colombo-intl.local` (class teacher, Year 4 – Emerald), parent phone `+94 77 000 0001` (Dilhani Perera, children Amaya and Kavindu). Local one-time passwords and OTPs are always `000000` and are printed to the API log.

`*.localhost` subdomains resolve to 127.0.0.1 in modern browsers. The staff portal reads the tenant from the subdomain (`colombo-intl.localhost:3000`).

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
| D8 | 2026-10-05 | Quad Circle ships as Moments inside the existing apps | Product owner chose the simplest version |
| D9 | 2026-10-06 | Tailwind CSS v4 for all web front-end styling | Product owner decision |
| D10 | 2026-10-06 | The parent app is built with Flutter (not Expo / React Native) | Product owner decision. Consequences: the OpenAPI document is the contract for mobile; business logic stays on the server; tokens and strings are generated to Dart; push uses FCM directly |
