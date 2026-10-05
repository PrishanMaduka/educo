# Quad

Quad is a multi-tenant school platform with three apps: a platform console for Quad staff, a staff portal for each school, and a parent mobile app. The full specification is in `docs/spec/` (start with `docs/spec/README.md`). The HTML prototypes in `design/` are the visual and behavioural reference.

## How to work in this repo
- Build milestone by milestone, following `docs/spec/18-delivery-plan.md`. Use `/build-milestone M<n>`. Before writing code, read the spec files the milestone lists and open the matching prototype.
- **Spec wins over prototype.** Where the spec is silent, copy the prototype. If you have to decide something new, add a row to the decision log in `docs/spec/02-architecture.md` in the same change.
- Finish every milestone with `pnpm verify` green, and tick it off in the Progress list of `docs/spec/18-delivery-plan.md`.
- Never edit `design/`, except to fix a prototype bug you were asked to fix. Never import from `design/` into an app.

## Stack (details in docs/spec/02-architecture.md)
pnpm + Turborepo, TypeScript strict, NestJS (Fastify) API, PostgreSQL 16 with Drizzle and row-level security, Redis + BullMQ, Socket.IO, Next.js 15 for `apps/staff` and `apps/console`, Expo for `apps/parent`, Zod contracts in `packages/contracts`, pure business logic in `packages/domain`, tokens in `packages/tokens`, web components in `packages/ui`.

## Commands
- `docker compose up -d` starts Postgres, Redis, MinIO and Mailpit.
- `pnpm dev` runs everything. `pnpm --filter @quad/api dev` runs one app.
- `pnpm db:migrate`, `pnpm db:seed`, `pnpm db:reset`.
- `pnpm api:client` regenerates the typed client after API changes.
- `pnpm test` (unit), `pnpm test:api` (integration, needs Docker), `pnpm e2e` (Playwright), `pnpm e2e:mobile` (Maestro).
- `pnpm verify` is the full quality gate.

## Rules that matter
- **Tenancy:**
  - The tenant comes only from the session or token, never from request input.
  - Every query on tenant tables runs inside `withTenant()`.
  - Every new tenant table needs `tenant_id`, an RLS policy and a cross-tenant test.
- **Permissions:**
  - Guard every route with `@Can(...)` and, where needed, `@Module(...)`.
  - Parent routes check the guardian–student link.
  - Safeguarding and medical data need sensitive keys, and every view is logged.
  - Neither is ever passed to early warning or Ask Quad.
- **Business logic** (timetable, cover, exams, early warning, fees, grading) lives in `packages/domain` as pure functions with unit tests. Do not duplicate it in apps or controllers.
- **Money** is integer minor units with a currency code. Never use floats for money.
- **Year-group labels** come from the school's curriculum. Never hard-code "Grade" or "Year".
- **UI:**
  - Use `packages/tokens` and `packages/ui`. No raw hex colours in components.
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
Platform owner `owner@quad.local`; school admin `prishan.maduka@colombo-intl.local` on `colombo-intl.localhost:3000`; teacher `nadeesha.jayasinghe@colombo-intl.local`; parent phone `+94 77 000 0001`. Local OTP and TOTP codes are `000000`.
