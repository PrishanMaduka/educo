---
name: quad-debugging
description: Systematic root-cause debugging for Quad - failing tests, CI failures, RLS and tenancy surprises, Next.js hydration issues, Flutter state bugs, flaky Playwright journeys and job failures. Use whenever something fails or behaves unexpectedly, before changing code.
---

# Debugging in Quad

If Superpowers is installed, follow its `systematic-debugging` skill; this adds Quad-specific places to look. Never fix by guessing, and never fix by skipping a test.

## The four steps
1. **Reproduce** with the narrowest command (one test file, one journey, one request with `curl`). Write down the exact error.
2. **Locate.** Read the full stack trace and logs (Pino, with `requestId`). Bisect: which layer first sees wrong data — contract, controller, service, domain, repository, database, client, UI?
3. **Explain.** State the root cause in one sentence before writing a fix. If you can't, gather more evidence (add a failing test, log the inputs, inspect the DB as `quad_app`).
4. **Fix and prove.** Add a test that fails for this cause, fix, see it pass, run `pnpm verify`. Look for the same bug elsewhere (`rg`).

## Quad-specific suspects

| Symptom | Look at |
|---|---|
| Query returns nothing / 404 for a row that exists | Missing `withTenant`, wrong tenant in ctx, `set_config` not inside the same transaction, policy typo. Inspect with `set role quad_app; select set_config('app.tenant_id', '<id>', true);` in a transaction |
| Insert fails with "new row violates row-level security policy" | `tenant_id` not set on insert, or `WITH CHECK` mismatch, child table missing `tenant_id` |
| Works as owner, fails in API | You tested as `quad_owner`; FORCE RLS applies to the owner too — test as `quad_app` |
| 403 unexpectedly | `@Can` key spelling vs contracts, role matrix, active role preview on the session, plan module guard, suspended school |
| Wrong times | Server time zone used instead of the school's; `now` not injected; UTC vs `HH:mm` mixing |
| Money off by one | Float maths or rounding per total instead of per line; use `packages/domain/money` |
| `codegen:check` fails | Run `pnpm api:client`, `pnpm tokens:build`, `pnpm i18n:build` and commit the output |
| Next.js hydration mismatch | Time/locale/random used during render; client-only values in a server component |
| Flaky Playwright | Waiting on timeouts instead of `expect(locator)` auto-waits, shared seed data mutated by another test, animations (set reduced motion), time-of-day greeting (set the clock) |
| Flutter golden diff | Fonts not loaded in tests, text scale, theme not applied, platform differences — review the diff images before updating |
| Job ran twice / duplicate emails | Missing idempotency key or dedupe on job id |
| Works locally, fails in CI | Pinned versions (`.nvmrc`, `.fvmrc`), env vars missing from CI, test order dependence, time zone of the runner |

## Don'ts
- Don't add retries, sleeps or `try/catch` to hide a failure.
- Don't widen a permission or bypass RLS to make a test pass.
- Don't change several things at once; one hypothesis per change.
