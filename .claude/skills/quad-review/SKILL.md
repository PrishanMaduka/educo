---
name: quad-review
description: Quad's self-review checklist to run on your own diff before every commit or pull request - tenancy, permissions, sensitive data, layering and reuse, tests, UI rules, copy, performance and generated code. Use before committing, before opening a PR, and when reviewing someone else's change.
---

# Review before you commit

Run `git diff` (and `git diff --stat`) and read your change as a strict reviewer would. Fix what you find, then run `pnpm verify`. For a deeper pass, also run the built-in `/code-review` and `/security-review`.

## Tenancy and security (blocking)
- [ ] Every query on a tenant table runs inside `withTenant()`; no raw client outside `packages/db`.
- [ ] The tenant comes only from the session/token (or a D16 entry point), never from body, path, query or host.
- [ ] `withPlatform()` only in `apps/api/src/platform/**` or `worker/platform-jobs/**`, with `platform_audit` on writes.
- [ ] New tenant tables have `tenant_id`, the composite index, ENABLE + FORCE RLS, a policy and a cross-tenant test.
- [ ] Every new route has `@Can` (and `@Module` where it belongs to a plan module); `/family` routes check the guardian–student link.
- [ ] Safeguarding/medical data needs sensitive keys, is audited on view, and never reaches early warning, Ask Quad, logs or analytics.
- [ ] No secrets, tokens or personal data in code, logs, fixtures or screenshots. Config only via the validated config.
- [ ] Signed links are verified server-side; webhooks verify signatures first and are idempotent.

## Architecture and reuse
- [ ] Logic that decides something is in `packages/domain` with unit tests, not in a controller, component or widget.
- [ ] Controllers are thin; services don't take `tenantId` from callers; repositories don't decide.
- [ ] Nothing duplicated that already exists in `packages/ui`, `domain`, `contracts` or `lib/ui` (`quad-reuse`).
- [ ] No import across apps, from `design/`, or from deep paths of a package.
- [ ] New decisions are recorded in the decision log (spec 02).

## Correctness
- [ ] Money is integer minor units with a currency; no floats.
- [ ] Times are UTC instants or school-local `HH:mm` with the school's time zone; `now` is injected.
- [ ] Error responses use `{ code, message, fields? }` with the status from spec 06.
- [ ] Idempotency keys and `etag`/`If-Match` where the conventions require them.
- [ ] Jobs are idempotent and retry-safe.
- [ ] No N+1 queries; lists are paginated (`cursor`, `limit` ≤ 200).

## Tests
- [ ] Required tests from `quad-tdd` exist (happy, 400, 403, cross-tenant, parent-not-linked, module).
- [ ] A bug fix has a test that failed before the fix.
- [ ] No skipped, `.only`, loosened or deleted tests; no raised snapshot thresholds.

## UI and copy
- [ ] Matches the prototype at 1440 and 390 px, light and dark (screenshots attached to the PR).
- [ ] Tailwind token utilities only; Flutter `QuadColors` only; no raw hex.
- [ ] All strings in `en.json`; ICU plurals; year-group labels from data.
- [ ] Buttons say what happens; toasts confirm what happened; plain English from the user's side.
- [ ] Labels for screen readers, focus states, keyboard paths, 44 px targets, reduced motion.
- [ ] Forms are in right-side drawers; pages are story first.

## Hygiene
- [ ] Generated files regenerated, not hand-edited (`pnpm codegen:check` clean).
- [ ] No dead code, commented-out code, stray `console.log`/`print`, or TODO without a milestone id.
- [ ] Conventional Commit message that says why (`feat(fees): customizable discounts in billing runs`).
- [ ] Milestone progress ticked in spec 18 when a milestone completes.
