---
name: quad-domain-logic
description: How to write business rules in packages/domain for Quad (timetable, cover, exams, early warning, fees and money, grading, greetings) as pure, deterministic, fully tested functions. Use whenever logic decides a value, status, total, score or eligibility.
---

# Business rules in `packages/domain`

Every rule that decides something lives here once, so the API, the web apps and the tests agree. The Flutter app gets the results from the API.

## Rules for this package
- **Pure.** No I/O, no database, no HTTP, no Nest, no React, no `Date.now()`, no `Math.random()` (take `now` and a seeded `rng` as parameters), no environment variables.
- **Depends only on `packages/contracts`** (and tiny pure libs like a date library, approved in the decision log).
- **Plain data in, plain data out.** Inputs are typed objects (often contract types or narrower `Pick`s); outputs are new objects. Never mutate inputs.
- **Explain results.** Where the UI shows a reason ("why this student is flagged", "why this slot clashes"), return the reasons as data (`{ level, reasons: [{ code, values }] }`), and let the apps turn codes into copy.
- **Errors as values for expected outcomes** (`{ ok: false, code: 'clash', conflicts }`); throw only for programmer errors (impossible input).

## Folder per area
```
packages/domain/src/
  money/        allocate, round, sum, format-free arithmetic on minor units
  fees/         invoice totals, discounts (named, percentage, base, who), late fees, instalments
  timetable/    generation, clash checks, cover order
  exams/        exam timetable, clash checks
  grading/      grade boundaries per curriculum
  early-warning/ scores and levels
  greeting/     greetPeriod(now, timeZone)
  index.ts      public API only — other packages import from '@quad/domain', never deep paths
```

## Money
- Integers in minor units with a currency. Rounding follows the spec exactly (spec 13: round half up to whole rupees on invoice totals); cite the rule in a comment next to the code. Where the spec is silent, choose a rule, write it in the decision log, and make splits (a payment across invoices, a total across lines) always sum back to the whole.
- Property-test it: for any inputs, totals are non-negative, parts sum to the whole, and discount ≤ base.

## Time
- Take `now: Date` and `timeZone: string`. Convert to school-local with the shared helper; never use the process time zone.
- Test the edges: midnight, period boundaries, DST changes for schools that have them, term start/end, leap years.

## Tests (co-located `*.test.ts`)
- Table-driven cases with the spec's examples copied in as fixtures, then boundaries, then property tests for invariants.
- Aim for full branch coverage in this package; the Vitest coverage threshold for `@quad/domain` is 100% branches (D23).

## Template
```ts
export interface DiscountRule { name: string; percent: number; base: 'tuition' | 'all'; appliesTo: 'all' | 'siblings' | 'staff' }

/** spec 13 → Billing runs: each discount applies to its own base; totals round half up to whole rupees. */
export function applyDiscounts(lines: readonly InvoiceLine[], rules: readonly DiscountRule[], ctx: { student: StudentFacts }): DiscountResult {
  // …pure computation…
}
```
