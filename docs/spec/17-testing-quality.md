# 17 Testing and quality

## Test pyramid
| Level | Tool | What | Where |
|---|---|---|---|
| Unit | Vitest | `packages/domain` algorithms (timetable, cover order, exam clashes, early-warning scores, fee maths, grading), Zod contracts, UI component logic | `*.test.ts` next to the code |
| API integration | Vitest + Supertest + Testcontainers (Postgres 16, Redis 7) | Every endpoint: happy path, validation, permission denied, cross-tenant denied, parent-not-linked denied | `apps/api/test/**` |
| Web end-to-end | Playwright (Chromium, WebKit) at 1440×900 and 390×844, light and dark | Key journeys per milestone, plus an axe check per page | `apps/staff/e2e`, `apps/console/e2e` |
| Mobile unit and widget | `flutter_test` with Riverpod overrides and a mocked `quad_api` | Providers, formatting, every screen's states (loading, empty, error, data) | `apps/parent/test` |
| Mobile golden | Golden image tests at 390×844, light and dark, text scale 1.0 and 2.0 | Home, Moments, pay sheet, child screens | `apps/parent/test/goldens` |
| Mobile end-to-end | `integration_test` against the local API, plus Maestro flows on iOS and Android builds | Parent journeys | `apps/parent/integration_test`, `apps/parent/maestro` |
| Visual | Playwright screenshots compared with approved baselines (threshold 0.2%) | Home pages, drawers, early warning, parent Home | `**/e2e/visual` |
| Assistant eval | Custom runner (see [11](11-ask-quad.md#evaluation-m10)) | Facts, sources, no leaks | `apps/api/test/assistant/eval` (manual) |

## Fixtures
- `pnpm db:seed` builds the sample platform: 12 schools (seed tenants copied from the prototype list, with their plans, countries and health) and two fully populated schools:
  - **Colombo International School:** Cambridge; about 1,248 students; staff, classes, a published timetable, invoices, attendance history, pastoral entries, moments, events and forms.
  - **Kandy Hill Academy:** Sri Lankan national curriculum.
- The seed is deterministic (seeded random), so test expectations are stable. The sample people match the prototypes: Dilhani Perera with children Amaya (Year 4 – Emerald) and Kavindu (Year 9 – Sapphire), Nadeesha Jayasinghe, and Ruwan Mendis.
- Factories (`packages/db/test/factories.ts`) for every table.

## Cross-app journeys (must stay green from the milestone that introduces them)
1. Console creates a school with the wizard; the first admin signs in to the staff portal, which shows the school's branding.
2. A brand colour published in the console re-themes the open staff portal and parent app live.
3. Admissions: new application → interview → offer → enrol; the student appears in Students and the guardian can sign in to the parent app.
4. A teacher takes a register with an absence; the parent gets a push at 09:00 and the absence shows in Attendance.
5. A teacher shares a moment; it appears on the parent's Home and Moments live; the parent's heart and thank-you show on the teacher's Moments card and in Messages.
6. A billing run creates drafts, they are sent, the parent pays with the PayHere sandbox, the invoice becomes paid, and journal lines are posted.
7. A parents' evening opens; the parent books a slot; the grid updates live; a second parent cannot take the same slot.
8. A form with a fee: the parent signs yes, and the fee is added to Payments.
9. Exams: generate, introduce a clash, Publish is blocked, fix the clash, publish, and the parent sees the exam timetable.
10. Cover: report an absence, auto-assign, publish, and the cover appears in the cover teacher's My teaching.
11. Early warning: the signal appears, a plan is started with "tell parents", and the parent sees the heads-up row in Needs you, which opens the heads-up card on How {child} is doing.
12. Ask Quad, with a mocked model: "Who needs attention in Year 9?" calls `list_early_warning`, the answer cites sources, and the action button navigates.
13. Year rollover: preview, then run; students are promoted and the final year graduates.
14. Circle learning: a teacher posts this week's learning; the parent sees it in Circle → Learning, taps We tried it with a note, and the teacher's card shows the try and the note live.
15. Photo consent: the parent sets "Family only" for Amaya; the teacher's share drawer says only Amaya's family will see the photo, and a parent of another child in the class does not get it. With "No photos", Photo is disabled for Amaya.
16. Family circle: a parent invites a grandparent, who signs in with OTP and sees only Moments (hearts work; every other route is refused); the parent removes them and their session ends.

## Quality gate (`pnpm verify`)
`turbo run typecheck lint test` (Turborepo runs `flutter analyze` and `flutter test` through `apps/parent/package.json`) → a check that generated code (API clients, tokens, ARB) is up to date → API integration tests → Playwright smoke (the journeys for completed milestones) → `pnpm audit --prod` (no high or critical issues). A milestone is accepted only when `pnpm verify` passes and its own journeys pass.

## CI (GitHub Actions)
- On pull requests: install with cache, `pnpm verify`, build every app, deploy preview environments, and post the preview links.
- On `main`: the same, then deploy to staging; production deploys from a release tag with manual approval.
- Required checks: typecheck, lint, unit, api-integration, e2e-smoke, and build.

## Coding standards
- ESLint (typescript-eslint strict, react, react-hooks, jsx-a11y, import order, Tailwind class rules) and Prettier for TypeScript; `dart format` and `very_good_analysis` for Dart (`flutter analyze` must report no issues).
- No `any`; use `unknown` and narrow it. Exhaustive `switch` statements on enums.
- Domain logic only in `packages/domain`. Controllers stay thin and call services. Services never take a tenant id from input.
- Components: one per file, props typed, no inline styles except token CSS variables, every interactive element labelled.
- Commits follow Conventional Commits. Each milestone is one pull request (or a few) with screenshots.
