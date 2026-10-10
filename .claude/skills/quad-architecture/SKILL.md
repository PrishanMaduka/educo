---
name: quad-architecture
description: Where code belongs in the Quad monorepo and which way dependencies may point. Use before creating any new file, module, package, table, endpoint or screen, and whenever you are unsure which layer a piece of logic belongs in.
---

# Quad architecture

The spec is the source of truth: `docs/spec/02-architecture.md` (layout, tenancy, decision log), `04` (data model), `05` (auth and permissions), `06` (API conventions). This skill is the short version you apply while coding.

## The layers

```
packages/contracts   Zod schemas, enums, permission keys, event names, i18n keys   (depends on nothing)
packages/domain      pure business rules: no I/O, no Date.now(), no DB, no Nest   (depends on contracts)
packages/db          Drizzle schema, migrations, RLS, withTenant/withPlatform, seed (depends on contracts)
packages/tokens      design tokens -> Tailwind @theme CSS + Dart                   (depends on nothing)
packages/ui          React components for staff and console                       (depends on tokens, contracts)
packages/client      generated TS client + TanStack Query hooks                   (generated, never edit)
apps/api             NestJS: controllers -> services -> repositories               (depends on contracts, domain, db)
apps/staff, console  Next.js 15                                                    (depends on ui, client, contracts, tokens)
apps/parent          Flutter, generated quad_api client, tokens.g.dart             (talks to the API only)
```

`packages/client` also holds hand-written browser helpers (`fetcher.ts`, `query.ts`, `browser.ts`: `createBrowserApi`, `ApiError`, `safeReturnPath`) beside `src/generated/`, which is regenerated with `pnpm api:client` and never edited.

Dependency rules (the ESLint import rules enforce most of them):
- Arrows only point down the list above. `domain` never imports `db`; `ui` never imports `client`; apps never import other apps.
- Only `apps/api` talks to the database. Only `packages/db` touches the raw Drizzle client.
- `withPlatform()` only in `apps/api/src/platform/**` and `apps/api/src/worker/platform-jobs/**`.
- Nothing imports from `design/`.

## Inside the API (`apps/api/src/modules/<area>/`)

```
<area>.module.ts
<area>.controller.ts     HTTP only: route, @Can/@Module guards, parse with the contract schema, call the service, map to the response schema
<area>.service.ts        use cases: orchestration, transactions, audit events, emitting realtime events, queueing jobs
<area>.repository.ts     every query for this area, always inside withTenant(); returns plain typed rows
<area>.mapper.ts         row -> contract DTO (optional, when mapping is more than a spread)
<area>.events.ts         realtime/event names from contracts, payload builders
jobs/<job>.processor.ts  BullMQ processors (idempotent)
```

- **Controllers are thin.** No queries, no business rules, no `if` chains about state. If a controller grows past ~40 lines per route, logic is in the wrong place.
- **Services orchestrate, `packages/domain` decides.** If a function decides something (a total, a clash, a score, a grade, a status transition, an eligibility), it is a pure function in `packages/domain` and the service calls it with data the repository loaded.
- **Repositories never decide.** They load and save. One repository per aggregate; no cross-area queries except through the other area's service.
- **The tenant is never a parameter from input.** The service reads it from the request context (session or token); repositories get it through `withTenant()`.
- Cross-area work goes service → service (injected), or through an event/job when it can be asynchronous. Never import another module's repository.

## Inside the web apps (`apps/staff`, `apps/console`)

```
app/(app)/<area>/page.tsx            server component: fetch, then render the story + sections
app/(app)/<area>/_components/*.tsx   components used only by this route
app/(app)/<area>/_drawers/*.tsx      right-side form drawers for this area
lib/                                 app-wide helpers (session, api fetchers, formatters)
```
- A component used by two routes moves to the app's `components/`; used by both web apps, it moves to `packages/ui`.
- Data fetching goes through `packages/client` hooks or typed server fetchers. No hand-written `fetch('/api/...')` with untyped JSON.
- Display formatting (dates, money, plurals) uses the shared formatters, never ad-hoc `toFixed` or string concatenation.

## Inside the parent app (`apps/parent/lib`)

`features/<area>/{screens,widgets,providers}`, `ui/` (shared Quad widgets), `core/` (api, storage, push, realtime), `theme/`, `l10n/`. The app displays what the API computed; it never re-implements a rule from `packages/domain`. If a screen needs a number the API does not return, add it to the API.

## Before adding something new

1. Search for an existing piece that does it (see the `quad-reuse` skill).
2. Pick the layer from the rules above. If two layers seem right, choose the lower one (more reusable, easier to test).
3. If the spec is silent and the choice matters later (a new table, a new public endpoint shape, a new dependency, a new pattern), add a row to the decision log in `docs/spec/02-architecture.md` in the same change.

## Smells that mean "wrong layer"

- A calculation appears in a controller, a React component or a Flutter widget.
- The same `where` clause appears in two repositories.
- A service takes `tenantId` as an argument from a controller.
- A React component formats money itself, or a Flutter widget sums invoice lines.
- A new dependency is added to `packages/domain` (it should have none besides contracts).
- A file passes ~300 lines or a function ~50 lines: split by responsibility, not by line count alone.
