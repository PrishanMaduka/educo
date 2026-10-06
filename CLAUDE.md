# Quad

Quad is a multi-tenant school platform with three apps: a platform console for Quad staff, a staff portal for each school, and a parent mobile app. The full specification is in `docs/spec/` (start with `docs/spec/README.md`). The HTML prototypes in `design/` are the visual and behavioural reference.

## How to work in this repo
- Build milestone by milestone, following `docs/spec/18-delivery-plan.md`. Use `/build-milestone M<n>` (ids like `M0b`, `M1b`, `M9b` are valid). Before writing code, read the spec files the milestone lists and open the matching prototype.
- **Spec wins over prototype.** Where the spec is silent, copy the prototype. If you have to decide something new, add a row to the decision log in `docs/spec/02-architecture.md` in the same change.
- Finish every milestone with `pnpm verify` green, and tick it off in the Progress list of `docs/spec/18-delivery-plan.md`.
- Never edit `design/`, except to fix a prototype bug you were asked to fix. Never import from `design/` into an app.

## Stack (details in docs/spec/02-architecture.md)
pnpm + Turborepo, TypeScript strict, NestJS (Fastify) API, PostgreSQL 16 with Drizzle and row-level security, Redis + BullMQ, Socket.IO, Next.js 15 with **Tailwind CSS v4** for `apps/staff` and `apps/console`, **Flutter** (Dart 3, Riverpod, go_router) for `apps/parent`, Zod contracts in `packages/contracts`, pure business logic in `packages/domain`, tokens in `packages/tokens`, web components in `packages/ui`.

## Commands
- `docker compose up -d` starts Postgres, Redis, MinIO, Mailpit and ClamAV. Versions are pinned (`.nvmrc`, `packageManager`, `.fvmrc`).
- `pnpm dev` runs everything. `pnpm --filter @quad/api dev` runs one app.
- `pnpm db:migrate`, `pnpm db:seed`, `pnpm db:reset`.
- `pnpm api:client` regenerates the typed client after API changes.
- `pnpm parent:run` runs the Flutter app (`flutter run --flavor dev`). Inside `apps/parent`, the usual `flutter analyze`, `flutter test` and `dart run build_runner build` apply.
- `pnpm tokens:build`, `pnpm i18n:build` and `pnpm api:client` regenerate tokens (CSS + Dart), strings (ARB) and API clients (TypeScript + Dart).
- `pnpm test` (unit), `pnpm test:api` (integration, needs Docker), `pnpm e2e` (Playwright), `pnpm e2e:mobile` (integration_test + Maestro).
- `pnpm verify` is the full quality gate. It does not run `pnpm e2e:mobile` (Maestro runs nightly in CI) or `pnpm eval:assistant` (paid, manual).

## Rules that matter
- **Tenancy:**
  - One domain for all schools (`quad-edu.com`, API at `/api/v1`). No per-school subdomains, custom domains or schemas. The only Quad subdomains are `console.`, `staging.`, `mail.` and `status.`.
  - The tenant comes from the session or token (the membership chosen at sign-in). For the tenant-less entry points listed in `docs/spec/02-architecture.md` (signed links, payment webhooks, the enquiry form, sign-in), it comes from a verified signed token or one of the named security-definer lookups. Never from plain request input, the URL or the host.
  - Every query on tenant tables runs inside `withTenant()`. The app connects as `quad_app` (no `BYPASSRLS`); `withPlatform()` is only for `apps/api/src/platform/**` and `apps/api/src/worker/platform-jobs/**`.
  - Every new tenant table, child tables included, needs `tenant_id`, a `(tenant_id, …)` index, `FORCE ROW LEVEL SECURITY` with a policy, and a cross-tenant test.
- **Permissions:**
  - Guard every route with `@Can(...)` and, where needed, `@Module(...)`.
  - Parent routes check the guardian–student link.
  - Safeguarding and medical data need sensitive keys, and every view is logged.
  - Neither is ever passed to early warning or Ask Quad.
- **Business logic** (timetable, cover, exams, early warning, fees, grading) lives in `packages/domain` as pure functions with unit tests. Do not duplicate it in apps or controllers.
- **Money** is integer minor units with a currency code. Never use floats for money.
- **Year-group labels** come from the school's curriculum. Never hard-code "Grade" or "Year".
- **UI:**
  - Web: style only with Tailwind CSS utilities mapped to the tokens, and use `packages/ui`. No raw hex colours, arbitrary colour values, CSS modules or CSS-in-JS.
  - Flutter: colours and type only from the generated tokens (`QuadColors` theme extension). The app displays what the API computes and never re-implements business rules.
  - Forms open in right-side drawers.
  - Pages are story first: a summary sentence and what needs doing, then detail.
  - Everything works at 390 px wide and in dark mode, with labels for screen readers.
- **Copy:**
  - Plain English, written from the user's side.
  - Buttons say what happens.
  - Toasts confirm what happened.
- **Ask Quad:**
  - Uses `@anthropic-ai/sdk` with model `claude-opus-5-5` and read-only, permission-checked tools.
  - Run `/claude-api` before changing assistant code. Never guess SDK method names.
- **Secrets** come from environment variables, validated at boot. Never commit secrets or real personal data.
- **Tests:** every endpoint gets happy-path, validation, permission-denied and cross-tenant tests. Every user journey in `docs/spec/17-testing-quality.md` stays green once added.

## Seeded local accounts
Everything runs on one domain, `quad-edu.com` (locally `localhost:3000`); the school comes from the signed-in person's membership, never from the URL. Platform owner `owner@quad.local` on `localhost:3001`; school admin `prishan.maduka@colombo-intl.local` on `localhost:3000`; `ruwan.mendis@quad.local` belongs to two schools (school picker); teacher `nadeesha.jayasinghe@colombo-intl.local`; parent phone `+94 77 000 0001`. Local OTP and TOTP codes are `000000`.
