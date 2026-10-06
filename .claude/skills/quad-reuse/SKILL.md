---
name: quad-reuse
description: Look before you write. Use before writing any new component, hook, helper, schema, query, formatter, Flutter widget or test factory in Quad, and when you notice the same code in two places.
---

# Reuse first

Duplicate code in Quad usually means a business rule now lives in two places and will drift. Spend a minute searching before writing.

## 1. Search in this order

| You need | Look in first |
|---|---|
| A rule, total, score, clash check, status transition | `packages/domain/src/**` |
| A request or response shape, enum, permission key, event name | `packages/contracts/src/**` |
| A UI piece (button, drawer, table, pill, KPI, empty state, chart) | `packages/ui/src/**`, then the `/design` style guide in `apps/staff` |
| A Flutter widget | `apps/parent/lib/ui/**` |
| A formatter (money, dates, plurals, names, year-group labels) | `packages/ui/src/format/**` (web), `apps/parent/lib/core/format/**` (Flutter) |
| A query or table helper | `packages/db/src/**` and the area's `*.repository.ts` |
| A test builder | `packages/db/test/factories.ts`, `apps/api/test/helpers/**` |
| Copy | `packages/contracts/i18n/en.json` (reuse a key only if the meaning is identical) |

Useful searches: `rg -n "<keyword>" packages apps --type ts`, `rg -n "export (function|const) \w*<Noun>"`, and `rg -n "<Noun>" apps/parent/lib`.

## 2. Decide

- **Exists and fits** → use it.
- **Exists and almost fits** → extend it with a prop, variant (`cva`) or option. Keep the old behaviour as the default and add a test for the new case. Don't fork a copy.
- **Doesn't exist, used once** → write it next to where it is used (`_components/`, the feature folder).
- **Second use appears** → move it to the shared place at that moment (rule of two for UI and helpers). For business rules there is no "rule of two": they go in `packages/domain` from the first use.

## 3. Shapes that make code reusable

- Components take data and callbacks via props, never fetch inside shared components. Wrappers in the app do the fetching.
- Pure functions over classes for logic. Inputs in, result out, no hidden clock (`now` is a parameter).
- Contracts: derive, don't redefine. Use `Schema.pick/omit/extend` and `z.infer` instead of writing a second interface for the same thing.
- One source per fact: enum values in contracts, permission keys in contracts, colours in tokens, copy in `en.json`.
- Generic infrastructure (pagination, `etag`/`If-Match`, `Idempotency-Key`, CSV export, audit) is implemented once as interceptors/decorators/helpers in `apps/api/src/common/**`; endpoints opt in, never re-implement.

## 4. Don't over-abstract

- No generic "base service" or "base repository" with magic. Small explicit helpers beat inheritance.
- Don't build configurability nobody asked for. Extract when the second real use arrives, not in anticipation.
- Three similar lines are fine. Three similar 30-line blocks are not.
