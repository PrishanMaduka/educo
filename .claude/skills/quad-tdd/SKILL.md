---
name: quad-tdd
description: Test-first workflow and the required test matrix for Quad (domain unit tests, API integration tests with cross-tenant checks, Playwright journeys, Flutter widget and golden tests). Use when implementing any feature, endpoint, rule or bug fix.
---

# Test-driven development in Quad

If the Superpowers plugin is installed, its `test-driven-development` skill describes the red-green-refactor loop. This skill adds what Quad requires on top. The full pyramid is in `docs/spec/17-testing-quality.md`.

## The loop

1. **Red.** Write the smallest test that describes the next behaviour, run it, and watch it fail for the right reason (not an import error).
2. **Green.** Write the least code that passes it.
3. **Refactor.** Clean up with the tests green: names, duplication, layer placement (`quad-architecture`).
4. Repeat. Commit at green.

Run tests narrowly while looping: `pnpm --filter @quad/domain test -- fees`, `pnpm --filter @quad/api test:api -- invoices`, `flutter test test/features/home`.

## What every change needs

| You changed | Tests required |
|---|---|
| A rule in `packages/domain` | Unit tests first: normal cases, every boundary (dates at midnight, term edges, zero, max), invalid input. Table-driven (`it.each`). Property tests (`fast-check`) for money allocation, rounding, and timetable/clash invariants |
| A Zod contract | Accepts a valid example, rejects each invalid field with the right path |
| An API endpoint | Integration tests in `apps/api/test/<area>/`: **happy path**, **validation (400)**, **permission denied (403)**, **cross-tenant denied** (a user of school B gets 404 for school A's id, and lists never include A's rows), **parent not linked** for `/family` routes, **module not in plan** when `@Module` applies, plus 409/422 cases the spec names |
| A new tenant table | The migration test covers it automatically; add one repository test that proves RLS hides another tenant's rows |
| A background job | Idempotency (running twice changes nothing), retry-safe, runs in the school's time zone |
| A web screen | Component tests for logic-bearing components; Playwright for the milestone's journeys at 1440×900 and 390×844, light and dark, with an axe check |
| A Flutter screen | Widget tests for loading, empty, error and data states with Riverpod overrides; goldens at 390×844 light and dark, text scale 1.0 and 2.0 for the screens listed in spec 17 |
| A bug fix | A failing test that reproduces the bug **before** the fix |

## Good tests in this repo

- Arrange with factories from `packages/db/test/factories.ts` and the deterministic seed; never depend on wall-clock time (inject `now`) or test order.
- One behaviour per test; the name says the behaviour: `it('refuses a second booking for a taken slot with 409 slot_taken')`.
- Assert on contract shapes and stable error `code`s, not on message wording.
- Cross-tenant tests use two real tenants through the real `quad_app` role (Testcontainers), never mocks of `withTenant`.
- Don't mock what you own inside the API; mock only the edges (payment gateways, SMS, email, push, Anthropic) with the fakes in `apps/api/test/fakes`.
- Never skip, `.only`, loosen an assertion, or raise a snapshot threshold to get green. Fix the cause.

## Done means

`pnpm verify` is green, the milestone's journeys in spec 17 pass, and you have seen the new tests fail before they passed.
