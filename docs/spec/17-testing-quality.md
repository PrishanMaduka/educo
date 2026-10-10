# 17 Testing and quality

## Test pyramid
| Level | Tool | What | Where |
|---|---|---|---|
| Unit | Vitest | `packages/domain` algorithms (timetable, cover order, exam clashes, early-warning scores, fee maths, grading), Zod contracts, UI component logic | `*.test.ts` next to the code |
| API integration | Vitest + Supertest against Postgres 16 and Redis 7 (Docker Compose locally, service containers in CI), a freshly migrated database per test file | Every endpoint: happy path, validation, permission denied, cross-tenant denied, parent-not-linked denied | `apps/api/test/**` |
| Web end-to-end | Playwright (Chromium, WebKit) at 1440×900 and 390×844, light and dark | Key journeys per milestone, plus an axe check per page | `apps/staff/e2e`, `apps/console/e2e` |
| Mobile unit and widget | `flutter_test` with Riverpod overrides and a mocked `quad_api` | Providers, formatting, every screen's states (loading, empty, error, data) | `apps/parent/test` |
| Mobile golden | Golden image tests at 390×844, light and dark, text scale 1.0 and 2.0 | Home, Circle tab (Moments, People, Learning), pay sheet, child screens | `apps/parent/test/goldens` |
| Mobile end-to-end | `integration_test` against the local API, plus Maestro flows on iOS and Android builds (`pnpm e2e:mobile`; nightly in CI on simulators, not part of `pnpm verify`) | Parent journeys | `apps/parent/integration_test`, `apps/parent/maestro` |
| Visual | Playwright screenshots compared with approved baselines (threshold 0.2%) | Landing page, home pages, drawers, early warning | `**/e2e/visual` |
| Public site budget | Lighthouse CI (mobile, 4G) | Landing route against the budget in [19](19-public-site.md#performance-budget) | `apps/staff/lighthouserc.json` |
| Security (DAST) | OWASP ZAP | Baseline scan of staging nightly from M12; full authenticated scan before launch | CI nightly job |
| Assistant eval | Custom runner (see [11](11-ask-quad.md#evaluation-m10)), `pnpm eval:assistant` | Facts, sources, no leaks | `apps/api/test/assistant/eval` (manual) |

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
5. A teacher shares a moment; it appears live in the parent's Circle tab (Moments); the parent's heart and thank-you show on the teacher's Moments card and in Messages.
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
17. Sign-in, one school (M1): `prishan.maduka@colombo-intl.local` starts from the landing's **Sign in** (via `/app` → `/sign-in` until M1b's sign-in dialog), enters email, password and the code `000000`, and lands in `/app` with Colombo International School's logo and colour.
18. Sign-in, two schools (M1): `ruwan.mendis@quad.local` signs in, sees **Choose a school** with both schools and his role in each, picks Kandy Hill Academy and sees its branding; Switch school in the profile menu rotates the session and opens Colombo International School.
19. Users & roles invite (M1): the school admin invites a teacher in Settings → Users & roles; the invite email arrives in Mailpit; the signed link sets a password and two-step; the teacher signs in with the Teacher role; the admin changes the role and the teacher's menu changes; deactivating the teacher ends their session.
20. Demo request (M1b; the console step from M2): a visitor submits the landing demo form; a `platform_leads` row is created, the sales email arrives in Mailpit and the visitor sees the thank-you; in the console Leads view the lead is New, is set to Contacted, and **Convert to school** opens the wizard prefilled.
21. Role builder (M2): in the console a custom role is built from Teacher with an extra module and the medical sensitive switch; it is assigned to a user, who then sees that module; deleting the role is refused while it is assigned.
22. Bulk user actions (M2): in a school's Users tab three staff are selected and **Require two-step** is applied; the next sign-in of one of them asks to set up two-step; bulk **Deactivate** ends their sessions; both actions are in the audit log.
23. Suspend and delete a school (M2): the platform owner suspends a school with a reason (typing the name); its staff see the reason at sign-in and its parents see a notice; reactivating restores access; scheduling deletion shows the date and **Cancel deletion** removes it.
24. Curricula apply (M2): editing a curriculum template's stage name and choosing **Apply to schools** updates the structure of schools on that template; an open staff portal of one of them shows the new name live.
25. Plan editor (M2): lowering a plan's student limit below a school's seats blocks saving; a price change set to "at next renewal" shows the impact panel (schools, revenue change) and saves; a plan with no schools can be archived and deleted.
26. School check-in (M2): from Early warning for schools, **Plan a check-in** (with, when, how, notes, calendar invite) saves; it appears on the school's page and the overview, and the invite email arrives in Mailpit.
27. CRM (M4): a new lead is added, a call is logged as an activity, and **Convert to application** puts the applicant in the admissions pipeline with the lead's details.
28. Onboarding import with rollback (M4): download the student template, upload a file with one bad row, see the error in the dry run, fix and re-upload, commit, see the students in Students, then roll back the batch and they are gone ([21](21-onboarding-import.md#journeys)).
29. Timetable generate and publish (M5): generate the timetable for the whole school with no clashes; a drag-to-swap that would double-book a teacher is refused; publish; the lessons show in My teaching and in the parent app's Timetable.
30. Parent first sign-in with an invite code (M6): the school sends a guardian invite; the parent opens the `/p/invite/…` link (or taps "I have an invite code" and scans the QR code or pastes the invite link), confirms the name, signs in with the OTP, sees "You're signed in. We found 2 children" and lands on Home.
31. Broadcasts (M6): a broadcast to Year 4 parents shows a preview and the SMS cost estimate; on send, parents get a push and the broadcast in Messages; the stats show delivered and read counts.
32. Notification preferences (M6): the parent turns Rewards push off; a merit for their child does not push but appears in the in-app list; with SMS backup on, an absence alert also goes to the SMS log sink.
33. Gradebook publish (M8): a teacher enters marks, the weighted average updates as they type, **Publish to parents** makes the results appear in the parent's Results, and Export CSV downloads the gradebook.
34. Reports publish (M8): marks and comments are completed; the section head sends one report back with a note; the teacher fixes it; the section head approves; publishing shows "report is ready" in the parent app with the PDF; unpublishing removes it.
35. Quiet hours (M9b): with quiet hours 18:00–07:00, a parent's message at 19:30 is accepted with "It reaches Ms. Jayasinghe at 07:00", and the teacher's notification arrives at 07:00 (fake clock); an urgent broadcast during quiet hours goes through at once.
36. Family connection note (M9b): a leader opens Family connection, picks a family with nothing positive in two weeks and sends **a note from the office**; the parent receives it in Messages; after a moment is shared about the child, the family leaves the follow-up list.
37. Relative-token route test (M9b): a generated test walks every `/family` route with a `kind: relative` token; every route except the moments routes returns 403.
38. Parent Ask Quad (M10, mocked model): "How is Amaya doing in maths?" calls a tool scoped to Dilhani's linked children and cites sources; a question about a child not linked to her is refused; "What do I owe?" shows **Pay now**, which opens the pay sheet.
39. News and stories (M11): staff publish a news article and a story; the parent sees the story on Home and the article in News; the parent hearts the story and staff see the count.
40. Parent pickup end to end (M11): the parent adds a pickup person, who shows as waiting for approval until the school approves it in "Changes from parents"; the parent shows the pickup pass (QR rotating every 5 minutes); the staff pickup scanner accepts it, records a gate event on the child's day ring, and the parent gets the scan notice; a shared pass works only today; an expired code is refused.
41. Wallet top-up (M11): the parent tops up the canteen wallet through the school's PayHere sandbox and sets a daily limit; a staff canteen purchase reduces the balance live; a purchase over the daily limit is refused.
42. Console sign-in (M1): `owner@quad.local` signs in to the console with email, password and TOTP, the same in every environment; there is no Google or Microsoft button (D37); a wrong TOTP code is refused; an email that is not an active platform user gets the same answer as a wrong password.
43. Tenant-less entry points (M1, webhooks from M7): a valid password-reset link works once and is refused the second time; a forged, expired, wrong-purpose or tampered token is refused without revealing the school; a payment webhook with a bad signature is refused before any lookup; a signed webhook resolves its school through `tenant_by_gateway_account` and a mismatched account id is refused; an enquiry with an unknown `embed_key` is refused.
44. Dashboard (M9): the school admin's dashboard loads from one `GET /dashboard` request with the greeting summary, Needs you today, Good news with a birthday and **Send wishes** (the guardians receive the message), the early-warning strip, The numbers and My tasks; ticking a task keeps it done after reload.
45. Contact change approval (M6): a parent changes their phone number in Profile; the school sees it in "Changes from parents", approves it, and the parent's next OTP goes to the new number; a rejected change keeps the old number and tells the parent why.
46. 10-minute chat (M9): from the heads-up card the parent books a 10-minute chat in the teacher's office hours; the slot disappears for other parents; the teacher sees it in My teaching; cancelling frees the slot.
47. Lead to school (M2): a lead from the demo form is converted to a school; the wizard opens prefilled; after provisioning the lead is Won and linked to the new school, and the first admin can sign in.
48. Refund end to end (M7): a paid invoice is refunded in part through the PayHere sandbox; the refund webhook marks the payment refunded, the invoice balance and the parent's Payments update, and the reversing journal lines are posted.
49. Platform dunning to suspension (M7, fake clock): a school's platform invoice fails; reminder emails go at 3, 7 and 14 days; at day 21 past due the school is suspended automatically and its staff see the reason at sign-in; paying the invoice reactivates it.
50. Preview a role (M1): the school admin previews Finance officer; the menu shows only Dashboard, Communications, Students, Fees & invoicing and Accounting; Students is View only; opening Timetable shows the no-access page; a write during the preview returns 403 `preview_read_only`; Back to my view restores the admin's menu; the audit log has the start and end.

## Quality gate (`pnpm verify`)
`format:check` (Prettier; the parent app uses `dart format`) → `turbo run typecheck lint test` (Turborepo runs `flutter analyze` and `flutter test` through `apps/parent/package.json`) → `codegen:check` (API clients, tokens, ARB are up to date) → API integration tests → Playwright smoke (the web journeys for completed milestones, and Lighthouse CI on the landing route from M1b) → `pnpm audit --prod` (no high or critical issues). `pnpm verify` does **not** run Maestro or `integration_test` (`pnpm e2e:mobile`), which need simulators: CI runs them nightly on iOS and Android simulators, and a milestone that adds mobile journeys must show a green nightly run (or a local `pnpm e2e:mobile` run) in its pull request. It also does not run `pnpm eval:assistant`. A milestone is accepted only when `pnpm verify` passes and its own journeys pass.

## CI (GitHub Actions)
- On pull requests: install with cache, `pnpm verify` against Docker services, and build every app and image. There are no preview environments in v1 (D18).
- On `main`: the same, then the migrate task and a deploy to staging, smoke journeys against staging, and parent `staging` builds to TestFlight and the Play internal track (from M0b).
- Production deploys from a release tag with manual approval (from M12).
- Nightly: Maestro and `integration_test` on iOS and Android simulators, dependency and image scans, and the OWASP ZAP baseline scan of staging (from M12).
- Required checks: typecheck, lint, unit, codegen, api-integration, e2e-smoke, and build.
- Details in [20 → CI/CD](20-infrastructure-operations.md#cicd-github-actions).

## Coding standards
- ESLint (typescript-eslint strict, react, react-hooks, jsx-a11y, import order, Tailwind class rules) and Prettier for TypeScript; `dart format` and `very_good_analysis` for Dart (`flutter analyze` must report no issues).
- No `any`; use `unknown` and narrow it. Exhaustive `switch` statements on enums.
- Domain logic only in `packages/domain`. Controllers stay thin and call services. Services never take a tenant id from input.
- Components: one per file, props typed, no inline styles except token CSS variables, every interactive element labelled.
- The detailed rules and recipes are the `quad-*` skills in `.claude/skills/` (D23); run `quad-review` on every diff before committing.
- Commits follow Conventional Commits. Each milestone is one pull request (or a few) with screenshots.
