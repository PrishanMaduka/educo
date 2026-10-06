# 18 Delivery plan

Build in this order. Each milestone ends with `pnpm verify` green, its journeys passing, screenshots in the pull request, and the README and this plan updated (tick the box).

To run a milestone in Claude Code, type `/build-milestone M3`, or paste the milestone's prompt. Start each milestone in a fresh session (or `/clear`) so the context is clean. For large milestones, ask Claude Code to plan first (plan mode, Shift+Tab) and approve the plan before it writes code.

---

## M0 Foundations
**Read:** 02, 03, 17.
**Scope:**
- The pnpm + Turborepo monorepo, shaped as in [02](02-architecture.md#monorepo-layout).
- Shared configs: tsconfig, ESLint, Prettier, Vitest.
- `docker-compose.yml` with postgres:16, redis:7, minio and mailpit.
- `.env.example` and Zod config validation in the API.
- `packages/tokens` (with `pnpm tokens:build` generating the Tailwind `@theme` CSS and the Dart tokens):
  - all colour, type, radius and shadow tokens for light, dark and console;
  - a generated `tokens.css`;
  - logo components made from `design/brand/*.svg`.
- `packages/ui` primitives:
  - Button, IconButton, Input, Select, Dropdown filter, Segmented, Switch, Chip, Pill, Card, KPI, Table;
  - Drawer with Stepper, Toast, Tooltip, Tabs, Avatar, Empty state;
  - Morning scene, Sparkline, Petal burst, Command palette shell.
- `apps/staff` and `apps/console` shells (side bar, top bar, theme toggle, routing, a 404 page) and a placeholder home.
- `apps/parent` Flutter shell: flavors, `go_router` tab bar, theme from the generated `tokens.g.dart`, Figtree fonts, the generated `quad_api` client, and a `package.json` wrapper so Turborepo runs `flutter analyze` and `flutter test`.
- `apps/api` NestJS app with health checks, OpenAPI, the Pino logger and OpenTelemetry. `packages/client` generation.
- `packages/db` with Drizzle set up, the `tenants` table, `withTenant()` and an RLS helper.
- GitHub Actions CI.
- A `/design` route in `apps/staff` showing every component in both themes (living style guide).

**Accept:**
- `pnpm dev` starts everything.
- The style guide matches the prototype look (compare screenshots with `design/admin.html`).
- CI is green.

**Prompt:**
> Build milestone M0 from docs/spec/18-delivery-plan.md. Read docs/spec/02, 03 and 17 first, and open design/admin.html, design/parent.html and design/platform.html to match the look. Set up the monorepo, tooling, Docker Compose, tokens, UI primitives, the three app shells, the API skeleton and CI exactly as specified. Add the /design style-guide page with every component in light and dark. Run pnpm verify and show me screenshots of the style guide and each shell at 1440 and 390 widths.

## M1 Auth, tenancy and permissions
**Read:** 04 (Platform, Identity), 05, 06 (Me and auth), 16.
**Scope:**
- Identity tables and RLS policies on every tenant table, with a migration test that fails if any `[T]` table lacks a policy.
- Staff sign-in:
  - password, TOTP, Google and Microsoft OIDC (mocked in tests), forgot password, lockout;
  - branded sign-in pages.
- Console sign-in (Google + TOTP).
- Parent OTP sign-in, JWT + refresh rotation, biometric unlock (Flutter, `local_auth`).
- Roles, the permission matrix, sensitive keys, `@Can` and `@Module` guards, `/me/permissions`.
- Audit log and platform audit.
- Support sessions with the banner.
- Seed: platform owner, two schools, the users listed in [02](02-architecture.md#local-development).

**Accept:**
- Sign-in works in all three apps.
- Cross-tenant and wrong-role tests fail with 403/404.
- The support banner shows in support view.
- Safeguarding routes refuse support sessions.

**Prompt:**
> Build milestone M1 from docs/spec/18-delivery-plan.md (read 04, 05, 06 and 16). Implement every sign-in flow, sessions, RBAC with the permission matrix, plan and module guards, RLS on all tenant tables, the audit logs and support access. Write API integration tests for every flow, including cross-tenant and wrong-role denials. Run pnpm verify.

## M2 Platform console
**Read:** 07, 10 (Schools), 05 (support access).
**Scope:**
- Overview (without Ask Quad).
- Schools gallery and list.
- The six-step new-school wizard with the stages editor, logo colour extraction, live previews and streamed provisioning.
- School pages and all their tabs, including the user profile page and the role builder page.
- Curricula, with apply-to-schools.
- Plans & billing, with the New and Edit plan drawers.
- Audit log.
- Branding publish with live re-theming.
- Early warning for schools: the health job, the page, the overview panel and the check-in drawer.

**Accept:**
- Journeys 1 and 2 in [17](17-testing-quality.md#cross-app-journeys-must-stay-green-from-the-milestone-that-introduces-them).
- Wizard validation matches the prototype.
- The console works at 390 px.

**Prompt:**
> Build milestone M2 (docs/spec/07 and the Schools part of docs/spec/10). Match design/platform.html screen by screen. Implement the wizard and provisioning job, the stages editor, curricula, plans, school pages, branding publish over realtime, and early warning for schools. Add Playwright journeys 1 and 2. Run pnpm verify and attach screenshots of each console page in light and dark.

## M3 Academic structure and staffing
**Read:** 14 (curriculum, staffing), 04 (Academic structure).
**Scope:**
- Structure API and screens: stages, year groups, classes, subjects per year group, the bell-times editor per stage, rooms.
- Teachers & classes (teachers, classes, sections) with load.
- Academic years, terms and holidays (including Poya days for Sri Lankan schools).
- Year-group labels used everywhere.
- The filter dropdown component used across toolbars.

**Accept:**
- A school on the Sri Lankan curriculum shows "Grade" labels everywhere, and a Cambridge school shows "Year".
- Subject and bell validation works as specified.

**Prompt:**
> Build milestone M3 (docs/spec/14 sections "The curriculum drives everything" and "Teachers & classes", plus the matching tables in 04). Match the Subjects and Bell times drawers and the Teachers & classes page in design/admin.html. Unit-test stage kind inference and the periods check. Run pnpm verify.

## M4 Students, admissions, CRM, attendance
**Read:** 08 (Admissions, CRM, Students, Attendance), 04.
**Scope:**
- Students directory and profile, CSV import with a dry run, guardians and invites.
- The admissions kanban (drag and keyboard), the applicant drawer, New application, enrol.
- CRM: leads, campaigns, enquiry forms, and the public enquiry endpoint.
- Registers, the school attendance view, absence reports, and the 09:00 absence notification job (SMS and email adapters with local sinks).
- Command palette search.

**Accept:**
- Journeys 3 and 4 (the push part arrives in M6; check the notification record for now).

**Prompt:**
> Build milestone M4 (docs/spec/08 sections Admissions pipeline, CRM & leads, Students, Attendance; and Search in 15). Match design/admin.html. Add journeys 3 and 4. Run pnpm verify.

## M5 Timetable, My teaching, cover
**Read:** 14 (Timetable, My teaching, Staff cover).
**Scope:**
- `packages/domain/timetable` generator and repair pass, with property tests (no hard-constraint violations on generated schools of 300, 800 and 1,500 students).
- Timetable page: Rearrange, Week A/B, publish.
- My teaching, the cover board, auto-assign and publish.

**Accept:**
- Journey 10.
- Generation stays within the performance budget.

**Prompt:**
> Build milestone M5 (docs/spec/14 Timetable, My teaching, Staff cover). Implement the school-wide timetable generator in packages/domain with property-based tests, then the pages from design/admin.html. Add journey 10. Run pnpm verify.

## M6 Parent app core, messaging and notifications
**Read:** 09, 12 (Messages, Broadcasts, Notifications).
**Scope:**
- Parent app:
  - start-up, lock and sign-in;
  - Home (without moments, heads-up and Ask Quad) from `/family/home`;
  - child switcher with swipe;
  - Attendance, Timetable, Homework, Results, Rewards, Children profile;
  - Messages, More, notification settings, offline cache.
- Staff side: the Inbox and Broadcasts.
- FCM push with deep links (`go_router`) and the in-app notification list. Realtime connection in all apps.

**Accept:**
- Journey 4 (push).
- The parent app passes Maestro and `integration_test` flows for sign-in, Home, switching child, and sending a message.
- Golden tests pass at text scale 2.0.

**Prompt:**
> Build milestone M6 (docs/spec/09 except Moments, Payments and School life; docs/spec/12 Messages, Broadcasts, Notifications). Match design/parent.html screen by screen; the side panel in the prototype is not part of the app. Build it in Flutter (apps/parent) as described in docs/spec/02 "Parent app (Flutter)". Add widget, golden, integration_test and Maestro flows. Run pnpm verify.

## M7 Fees, payments and finance
**Read:** 13.
**Scope:**
- Fee items, structures and discounts.
- The billing run drawer and job, invoices, the preview drawer, reminders.
- Online payment settings, PayHere and Stripe adapters with sandbox webhooks.
- Parent Payments, the pay sheet (slide to pay with Face ID), instalments and part payments.
- Canteen wallet (manual purchases).
- Accounting: chart of accounts, journal entries with the balance check, automatic postings, dashboard, budgets.
- Platform billing for schools.

**Accept:**
- Journey 6.
- Fee maths unit tests cover discounts, instalments and rounding.
- Webhooks are idempotent.

**Prompt:**
> Build milestone M7 (docs/spec/13). Put all money calculations in packages/domain/fees with exhaustive unit tests. Implement the billing run, invoices, gateways with sandbox webhooks, the parent pay sheet and accounting. Add journey 6. Run pnpm verify.

## M8 Pastoral, learning, exams, reports, evenings and forms
**Read:** 08 (Pastoral, Evenings & forms), 14 (Courses, Exams, Reports), 09 (School life).
**Scope:**
- Behaviour, medical, sick bay, safeguarding (with view logging and encryption).
- Courses, assignments, the weighted gradebook.
- Exam series, the generator, the clash check, publishing.
- Report cycles, the workflow, PDFs, the parent report.
- Parents' evenings (grid and parent booking), forms (parent signing, fee to Payments), trips.

**Accept:**
- Journeys 7, 8 and 9.
- Safeguarding access tests pass.

**Prompt:**
> Build milestone M8 (docs/spec/08 Pastoral and Evenings & forms, 14 Courses, Exams, Reports, and 09 School life). Match design/admin.html and design/parent.html. Add journeys 7, 8 and 9 and the safeguarding access tests. Run pnpm verify.

## M9 Moments, early warning and the story-first homes
**Read:** 10, 12 (Moments), 08 (Dashboard), 09 (Home).
**Scope:**
- Moments: staff drawer with the photo consent check, parent Moments tab, Home latest moment, reactions, thank-you messages, realtime, push.
- Early warning:
  - the `compute-signals` job and domain scoring;
  - the Early warning page, cards, plan drawer, How this works, review reminders;
  - the student profile banner;
  - the parent heads-up card and the "How is my child doing" screen;
  - the sharing setting.
- Staff dashboard "the school today": Needs you today, Good news (with Send wishes), and the greeting summary.
- The parent Home story card.

**Accept:**
- Journeys 5 and 11.
- Scoring unit tests cover every rule in [10](10-early-warning.md).

**Prompt:**
> Build milestone M9 (docs/spec/10, 12 Moments, 08 Dashboard, 09 Home). Implement the early-warning scoring in packages/domain with a unit test per rule, Moments end to end with realtime, and the story-first home pages. Add journeys 5 and 11. Run pnpm verify.

## M9b Quad Circle
**Read:** 12 (Quad Circle to Good relationships by design), 09 (Circle tab, Home day ring, Day, recap), 08 (Family connection, Communications quiet hours, student profile), 14 (My teaching), 05 (Relatives), 16.
**Scope:**
- `packages/domain/circle`: day-ring events from registers, gate scans, moments, canteen and bus; family pulse; connection figures; weekly recap; quiet-hours delivery time. Unit tests first.
- Moments: skill tags, photo-consent scopes in the share drawer and the feed, quiet-hours scheduling (`deliver_at` with a BullMQ delayed job).
- This week in class: staff card and drawer, parent Learning segment, We tried it, term skill tally.
- Parent Circle tab (Moments · People · Learning), person screen, Home day ring and Day screen, weekly recap job (Friday 15:00 school time) and push.
- Family circle: invite, OTP sign-in with `kind: relative` tokens, the reduced relative app (Moments only), removal with token revocation.
- Staff: Family pulse, Family connection view, Quiet hours setting, student profile Circle lines.

**Accept:**
- Journeys 14, 15 and 16.
- Relative tokens get 403 on every `/family` route except the moments routes (a generated test walks the route list).
- Golden tests for the Circle tab segments and the Home day ring, light and dark.

**Prompt:**
> Build milestone M9b (docs/spec/12 Quad Circle sections, 09 Circle tab and Home day ring, 08 Family connection and quiet hours, 05 Relatives). Match design/parent.html (Circle tab, Day, recap) and design/admin.html (My teaching Family pulse and This week in class, Family connection, Communications quiet hours). Put the Circle maths in packages/domain/circle with unit tests. Add journeys 14, 15 and 16 and the relative-token route test. Run pnpm verify.

## M10 Ask Quad
**Read:** 11. In Claude Code, run `/claude-api` first for current SDK usage.
**Scope:**
- The assistant module, SSE transport, and the tools for all three apps with permission checks.
- System prompts, caching, refusal handling, conversation storage, feedback, rate limits, the school setting.
- The panels in all three apps, with suggestion chips, actions and sources.
- The evaluation set and runner.

**Accept:**
- Journey 12 with a mocked model.
- The evaluation shows at least 95% fact accuracy and zero leaks (run manually; add the result to the PR).

**Prompt:**
> Build milestone M10 (docs/spec/11). First run /claude-api to load current Anthropic SDK guidance for TypeScript, then implement Ask Quad exactly as specified: read-only permission-checked tools, streaming over SSE, caching, refusal fallback, and the three UI panels. Add journey 12 with a mocked Anthropic client and the eval runner (do not run the paid eval in CI). Run pnpm verify.

## M11 Transport, wallet, stories, calendar, year rollover
**Read:** 09 (Bus, Pickup pass, Calendar), 14 (Academic year), 08 (News and stories).
**Scope:**
- Routes, stops, a provider adapter with a simulator, the parent live bus map with push alerts.
- Rotating pickup pass with a staff scanner view.
- News and stories (staff publishing, parent viewer).
- Calendar.
- Academic year, pre-rollover checks, the rollover job.

**Accept:**
- Journey 13.
- The bus simulator drives the map and push alerts.

**Prompt:**
> Build milestone M11 (docs/spec/09 Bus, Pickup pass, Calendar; 14 Academic year and rollover; 08 News and stories). Add journey 13. Run pnpm verify.

## M12 Hardening and launch
**Read:** 15, 16, 17.
**Scope:**
- Performance work to meet the budgets, and a load test (k6) on the main endpoints.
- Security review, CSP, a dependency audit, and the pen-test fixes.
- Observability dashboards and alerts.
- Terraform for AWS in `infra/`, backups, restore drill scripts.
- Runbooks (incident, restore, onboarding a school, rotating keys).
- Accessibility audit fixes.
- App store builds with Flutter flavors and fastlane (or Codemagic), and store listings with school white-label names.

**Accept:**
- Every budget in [15](15-cross-cutting.md#performance-budgets) is met.
- No high or critical security findings remain.
- A restore drill succeeds.
- Staging passes every journey.

**Prompt:**
> Build milestone M12 (docs/spec/15, 16, 17). Measure against the performance budgets, fix what fails, add the Terraform, dashboards, alerts and runbooks, and produce signed Flutter release builds for iOS and Android. Report every budget with its measured value.

---

## Progress
- [ ] M0 Foundations
- [ ] M1 Auth, tenancy and permissions
- [ ] M2 Platform console
- [ ] M3 Academic structure and staffing
- [ ] M4 Students, admissions, CRM, attendance
- [ ] M5 Timetable, My teaching, cover
- [ ] M6 Parent app core, messaging and notifications
- [ ] M7 Fees, payments and finance
- [ ] M8 Pastoral, learning, exams, reports, evenings and forms
- [ ] M9 Moments, early warning and the story-first homes
- [ ] M9b Quad Circle
- [ ] M10 Ask Quad
- [ ] M11 Transport, wallet, stories, calendar, year rollover
- [ ] M12 Hardening and launch
