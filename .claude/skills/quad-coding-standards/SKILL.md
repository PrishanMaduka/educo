---
name: quad-coding-standards
description: Quad's coding standards for TypeScript (NestJS, Next.js, React), SQL/Drizzle and Dart/Flutter - naming, types, errors, money, time, i18n, logging and comments. Use whenever writing or reviewing code in this repo.
---

# Coding standards

The lint config (ESLint strict + Prettier, `very_good_analysis` + `dart format`) enforces formatting. This file covers what lint cannot. Base rules are in `docs/spec/17-testing-quality.md#coding-standards`.

## TypeScript

- `strict` everywhere. No `any`, no `as` casts to silence errors, no `!` non-null assertions outside tests. Use `unknown` and narrow with Zod or type guards.
- Parse, don't validate: every external input (HTTP body, query, env, job payload, webhook, file import) is parsed with its Zod schema at the boundary; inside, trust the types.
- Types come from contracts: `type Invoice = z.infer<typeof InvoiceSchema>`. Never hand-write a duplicate interface.
- Exhaustive `switch` on unions/enums with an `assertNever(x)` default.
- Prefer `const`, pure functions, early returns. Max ~3 levels of nesting.
- `async` functions always awaited or explicitly returned; no floating promises (lint enforces).
- Named exports only (except Next.js route files that need default exports).

### Naming
- Files `kebab-case.ts`; React components `PascalCase.tsx`; one component per file.
- Functions are verbs (`computeInvoiceTotal`, `listStudents`); booleans read as questions (`isOverdue`, `hasConsent`, `canEdit`).
- Use the domain words from the spec and prototypes (guardian, membership, year group, moment, circle, cover), not synonyms.
- Never hard-code "Grade" or "Year": year-group labels come from the school's curriculum.

### Errors
- Throw typed domain errors (`new BusinessRuleError('slot_taken', …)`) from services; a global filter maps them to `{ code, message, fields? }` with the status in spec 06. Never return `200` with an error inside.
- Error `code`s are stable `snake_case` strings from contracts; messages are plain English from the user's side.
- Never swallow errors. `catch` only to add context, translate, or handle a specific expected case.

### Money, time and numbers
- Money is `{ amountMinor: number (integer), currency: 'LKR' | … }`. No floats, no `toFixed` maths. Rounding and allocation rules live in `packages/domain/money`.
- Store and send instants as UTC ISO 8601. School-local times (`HH:mm`) are interpreted in the school's time zone. Never use the server's local time zone. Pass `now` into domain functions.
- Percentages and scores: compute in domain functions with explicit rounding.

### Logging and data
- Pino structured logs with `requestId`, `tenantId`, `userId`. Never log personal data (names, phones, emails, medical or safeguarding content), tokens or secrets.
- Audit events (spec 05 → Audit) are separate from logs and are written by services, not controllers.

### Comments
- Code says what; comments say why (a rule's source, a non-obvious constraint, a spec reference like `// spec 13: totals round half up to whole rupees`).
- No commented-out code, no TODO without an issue or milestone id (`// TODO(M7): …`).

## React / Next.js

- Server components by default; add `'use client'` only for interactivity, at the smallest component that needs it.
- Style only with Tailwind utilities mapped to tokens, variants with `cva`, merge with `cn()`. No raw hex, arbitrary colour values, inline styles (except CSS variables), CSS modules or CSS-in-JS.
- Every string from `en.json` via i18next. ICU plurals, never `count + ' students'`.
- Every interactive element has an accessible name; icons are `aria-hidden` unless they are the only content.
- Forms: React Hook Form + the contract's Zod schema (`zodResolver`), inside a right-side Drawer from `packages/ui`.
- Buttons say what happens ("Send reminder", not "Submit"); toasts confirm what happened ("Reminder sent to 12 families").

## NestJS

- One module per area. Constructor injection only. No `static` state, no service locators.
- Every route: `@Can('<module>.<action>')`, plus `@Module('<planModule>')` when it belongs to a plan module. `/family` routes check the guardian–student link.
- DTOs are the contract schemas (via `nestjs-zod` or the shared pipe). OpenAPI comes from them.
- Config only through the validated config service; no `process.env` outside `config.ts`.

## SQL / Drizzle

- Tables `snake_case` plural, columns `snake_case`, TS properties `camelCase` (Drizzle mapping).
- Every tenant table: `tenant_id uuid not null`, `(tenant_id, …)` index, RLS + FORCE + policy (use the `quad-tenant-table` skill).
- `id uuid` (v7) primary keys; `created_at`, `updated_at` `timestamptz`; soft delete with `deleted_at` only where the spec says so.
- No `select *` in repositories that serve the API; select the columns the contract needs.
- Avoid N+1: load related rows with joins or `inArray` batches.

## Dart / Flutter

- Riverpod (`riverpod_generator`) for state, `go_router` for navigation, `freezed` models from `quad_api`.
- Colours, type and radii only from `Theme.of(context).extension<QuadColors>()` and the generated tokens. No `Color(0xFF…)` in features.
- Strings only from the ARB (`AppLocalizations`). Format money/dates with the shared formatters.
- Widgets small and `const` where possible; no business rules (sums, statuses, eligibility) in widgets or providers.
- Every screen handles loading, empty, error and data states.
