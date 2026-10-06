# 18 Delivery plan

Build in this order. Each milestone ends with `pnpm verify` green, its journeys passing, screenshots in the pull request, and the README and this plan updated (tick the box).

To run a milestone in Claude Code, type `/build-milestone M3` (ids with a letter, such as `M0b`, `M1b` and `M9b`, work the same way), or paste the milestone's prompt. Start each milestone in a fresh session (or `/clear`) so the context is clean. For large milestones, ask Claude Code to plan first (plan mode, Shift+Tab) and approve the plan before it writes code.

---

## M0 Foundations
**Read:** 02 (including Repository bootstrap), 03, 15 (Localisation), 17.
**Scope:**
- The pnpm + Turborepo monorepo, shaped as in [02](02-architecture.md#monorepo-layout), with the bootstrap in [02 → Repository bootstrap](02-architecture.md#repository-bootstrap):
  - versions pinned: `.nvmrc` (Node 22 LTS), `packageManager: pnpm@9.x.y`, `.fvmrc` (Flutter), Java 17 noted for `openapi-generator`;
  - every root script (`dev`, `build`, `typecheck`, `lint`, `format`, `db:migrate`, `db:generate`, `db:seed`, `db:reset`, `api:client`, `tokens:build`, `i18n:build`, `codegen:check`, `parent:run`, `test`, `test:api`, `e2e`, `e2e:mobile`, `eval:assistant` as a stub, `verify`);
  - the `turbo.json` pipeline.
- Shared configs: tsconfig, ESLint (including the rules that ban the raw database client and `withPlatform` outside the allowed folders), Prettier, Vitest.
- `docker-compose.yml` with postgres:16 (init script creating `quad_owner`, `quad_app`, `quad_platform`), redis:7, minio, mailpit and clamav.
- `.env.example` with every variable from [02](02-architecture.md#environment-variables), and Zod config validation in the API that refuses local-only flags in production.
- `packages/tokens` (with `pnpm tokens:build` generating the Tailwind `@theme` CSS and the Dart tokens):
  - all colour, type, radius and shadow tokens for light, dark and console, plus the public-site tokens (accent font, band colours) from [19](19-public-site.md#design-tokens-to-add);
  - a generated `tokens.css`;
  - logo components made from `design/brand/*.svg`.
- `packages/contracts/i18n/en.json` and `pnpm i18n:build` generating the ARB file; `i18next` set up in the web apps.
- `packages/ui` primitives:
  - Button, IconButton, Input, Select, Dropdown filter, Segmented, Switch, Chip, Pill, Card, KPI, Table;
  - Drawer with Stepper, Toast, Tooltip, Tabs, Avatar, Empty state;
  - Morning scene, Sparkline, Petal burst, Command palette shell.
- `apps/staff` and `apps/console` shells (side bar, top bar, theme toggle, routing, a 404 page) and a placeholder home.
- `apps/parent` Flutter shell: flavors `dev`, `staging`, `prod` with their bundle ids and `env/<flavor>.json`, `go_router` tab bar, theme from the generated `tokens.g.dart`, Figtree fonts, the generated `quad_api` client, and a `package.json` wrapper so Turborepo runs `flutter analyze` and `flutter test`.
- `apps/api` NestJS app under the `/api/v1` prefix with health checks (`/api/v1/health/live`, `/ready`), OpenAPI at `/api/v1/openapi.json`, the Pino logger and OpenTelemetry. `packages/client` generation.
- `packages/db` with Drizzle set up, the three database roles, the `tenants` table, `withTenant()`, `withPlatform()`, an RLS helper that adds `ENABLE` + `FORCE ROW LEVEL SECURITY` and the policy, and the migration test from [02](02-architecture.md#database-roles-and-rls-d17).
- GitHub Actions CI for pull requests (`pnpm verify` against Docker services).
- A `/design` route in `apps/staff` showing every component in both themes (living style guide).

**Accept:**
- A fresh clone runs with the commands in [02 → Local development](02-architecture.md#local-development); `pnpm dev` starts everything.
- `pnpm codegen:check` passes, and the API refuses to boot with a missing variable.
- The migration test fails on a [T] table without `FORCE ROW LEVEL SECURITY` (proved with a throwaway test table).
- The style guide matches the prototype look (compare screenshots with `design/admin.html`).
- CI is green.

**Prompt:**
> Build milestone M0 from docs/spec/18-delivery-plan.md. Read docs/spec/02 (especially Repository bootstrap), 03, 15 Localisation and 17 first, and open design/admin.html, design/parent.html and design/platform.html to match the look. Set up the monorepo with pinned versions, every root script, turbo.json, Docker Compose (with the three Postgres roles and ClamAV), the full .env.example with Zod validation, tokens (including the public-site tokens), i18n:build, UI primitives, the three app shells, the API skeleton under /api/v1, withTenant/withPlatform with FORCE RLS and the lint rules, and CI. Add the /design style-guide page with every component in light and dark. Run pnpm verify and show me screenshots of the style guide and each shell at 1440 and 390 widths.

## M0b Infrastructure and staging
**Read:** 20, 02 (Environments, Paths, Environment variables), 16 (Operational security).
**Scope:**
- `infra/` Terraform with the modules `network`, `data`, `app`, `edge`, `dns` and the `staging` environment; remote state in S3 with a DynamoDB lock; separate AWS accounts for tooling and staging.
- Route 53 zone for `quad-edu.com`, ACM certificates, CloudFront + WAF + ALB with the path routing from D14 (`/api/v1/*` and `/socket.io/*` to the API, sticky `/socket.io`, everything else to staff; `console.staging.quad-edu.com` to the console), the origin secret header.
- ECS Fargate services `api`, `worker`, `staff`, `console`, `clamav` at staging sizes; RDS PostgreSQL 16 + RDS Proxy; ElastiCache Redis 7; private and public S3 buckets; Secrets Manager and KMS; GitHub OIDC deploy roles.
- CI on `main`: build images, push to ECR, run the migrate task, deploy staging, seed sample schools, run smoke journeys against staging. `terraform plan` on pull requests that touch `infra/`.
- SES domain identity for `mail.quad-edu.com` (SPF, DKIM, DMARC `p=quarantine`, MAIL FROM) in the SES sandbox; the bounce and complaint webhook.
- Firebase projects `quad-dev` and `quad-staging` with the APNs key; fastlane lanes that build the `staging` flavor and upload to TestFlight and the Play internal track (once the developer accounts exist; otherwise build the signed artifacts and record the gap).
- Sentry projects and OpenTelemetry export to Grafana Cloud (or CloudWatch) from staging; one starter dashboard.
- Staging sends `X-Robots-Tag: noindex`.

**Accept:**
- A merge to `main` deploys staging with no manual steps; a failing migration stops the deploy.
- `https://staging.quad-edu.com/api/v1/health/ready` is green; `/`, `/app` and `console.staging.quad-edu.com` serve the shells; a WebSocket connects through CloudFront.
- The ALB refuses requests without the CloudFront origin header; no secret is in the repo or in GitHub except deploy role ARNs.
- A test email from staging passes SPF, DKIM and DMARC; a staging build installs from TestFlight or the Play internal track.
- Traces from staging appear with `tenant_id`, and Sentry receives a test error.

**Prompt:**
> Build milestone M0b from docs/spec/18-delivery-plan.md. Read docs/spec/20 and the Environments, Paths and Environment variables parts of docs/spec/02. Write the Terraform in infra/ (modules network, data, app, edge, dns; env staging), the CloudFront/WAF/ALB path routing, ECS services, RDS with RDS Proxy, Redis, S3, Secrets Manager, GitHub OIDC, and the GitHub Actions workflow that builds, runs the migrate task and deploys staging on every merge to main. Set up SES for mail.quad-edu.com, Firebase per environment, Sentry and OpenTelemetry export, and the fastlane staging lanes. Show me terraform plan, a green staging deploy, and the health check.

## M1 Auth, tenancy and permissions
**Read:** 04 (Platform, Identity), 05, 06 (Me and auth), 08 (Users & roles, School settings), 16, 02 (Tenancy).
**Scope:**
- Global `accounts` and per-school memberships (`users`), the `auth_memberships` security-definer function, and RLS policies with `FORCE ROW LEVEL SECURITY` on every tenant table, with the migration test from M0 covering them all.
- The tenant-less entry point framework (D16): signed-link tokens (HMAC-SHA256, purpose, tid, subject, expiry, nonce, single use) used by password reset and staff invites; `tenant_by_embed_key` and `tenant_by_gateway_account` stubs with tests.
- Staff sign-in:
  - identifier-first sign-in at `quad-edu.com` (`/sign-in` page and a placeholder landing with **Sign in**; the full landing page is M1b), password, TOTP, Google and Microsoft OIDC (mocked in tests), forgot password, lockout;
  - **Choose a school** for accounts with several memberships, Switch school in the profile menu, and the school's branding applied after sign-in.
- Console sign-in: Google Workspace + TOTP, and email + password + TOTP when `CONSOLE_PASSWORD_LOGIN=true` (local and staging only, D22).
- Parent OTP sign-in, JWT + refresh rotation, biometric unlock (Flutter, `local_auth`).
- Roles, the permission matrix, sensitive keys, `@Can` and `@Module` guards, `/me/permissions`, and **Preview a role** (read-only role preview for school admins).
- School side: **Settings → Users & roles** (invite by email, change role, remind two-step, reset password, sign out everywhere, deactivate; no "sign in as", which is console-only), the **School settings** screen with its General and Sign-in sections and the `school_settings` table (other sections arrive with their features), and **Settings → Audit** (`GET /audit`, filterable).
- Audit log and platform audit.
- Support sessions with the banner (reason always required).
- Seed: platform owner, two schools, the users listed in [02](02-architecture.md#local-development).

**Accept:**
- Journeys 17, 18, 19, 42, 43 and 50 (signed links and the enquiry key; the webhook part from M7) in [17](17-testing-quality.md#cross-app-journeys-must-stay-green-from-the-milestone-that-introduces-them).
- Sign-in works in all three apps, all from one domain.
- `/auth/identify` returns the same response for unknown emails; `select-school` refuses a tenant the account is not a member of; a tampered or reused signed link is refused.
- Cross-tenant and wrong-role tests fail with 403/404; the app role cannot read another tenant's rows even with a raw query.
- The support banner shows in support view; safeguarding routes refuse support sessions.
- `CONSOLE_PASSWORD_LOGIN=true` is refused at boot when `APP_ENV=production`.

**Prompt:**
> Build milestone M1 from docs/spec/18-delivery-plan.md (read 02 Tenancy, 04, 05, 06, 08 Users & roles and School settings, and 16). Implement every sign-in flow, sessions, signed-link tokens, RBAC with the permission matrix, plan and module guards, FORCE RLS on all tenant tables, Settings → Users & roles, the School settings screen shell, the Audit view, the audit logs and support access. Write API integration tests for every flow, including cross-tenant and wrong-role denials, and add journeys 17, 18, 19, 42 and 43. Run pnpm verify.

## M1b Public site
**Read:** 19, 05 (Staff portal sign-in), 08 (Public landing page), 03 (public-site tokens), 16 (Data residency).
**Scope:**
- The landing page at `/` from `design/landing.html`, section by section as in [19](19-public-site.md#page-structure): top bar, hero with the orbit and ticker, strip, Circle day band, leaders heatmap, Why Quad, modules, Inside Quad with light and dark screenshots, privacy, demo form, footer.
- The sign-in dialog on the landing page (the M1 flow), `/#signin`, and **Open {school}** for signed-in visitors.
- Demo requests: `POST /api/v1/public/demo-requests` with Turnstile, a 5 per hour per IP limit and a honeypot; `platform_leads`; the sales email and the requester's confirmation.
- Legal pages `/legal/terms`, `/legal/privacy`, `/legal/dpa`, `/legal/subprocessors` (the D21 list), `/legal/cookies`.
- The `/p/*` "Get the Quad app" fallback page and the `/.well-known` app-link files covering only `/p/*`.
- SEO (titles, meta, OG image, `sitemap.xml`, `robots.txt`, canonical, JSON-LD), Plausible analytics behind its variable, the Lighthouse CI budget, and the landing visual test.

**Accept:**
- Journey 20 up to the sales email (the console Leads step is added in M2).
- The landing route meets the budget in [19](19-public-site.md#performance-budget) (LCP < 2.5 s on 4G, JS < 150 KB) and axe reports no serious issues; it matches the prototype at 1440 and 390 in light and dark.
- The demo endpoint passes happy-path, validation, captcha and rate-limit tests.

**Prompt:**
> Build milestone M1b from docs/spec/18-delivery-plan.md. Read docs/spec/19 and the sign-in part of 05, and open design/landing.html. Build the public landing page in apps/staff section by section with Tailwind and the public-site tokens (no raw hex), the sign-in dialog using the M1 flow, the demo request endpoint with Turnstile and rate limits writing platform_leads, the legal pages with the sub-processor list, the /p/* fallback and app-link files, SEO and analytics. Add journey 20 (to the sales email), the Lighthouse budget check and the visual test. Run pnpm verify.

## M2 Platform console
**Read:** 07, 10 (Schools), 05 (support access, platform roles), 19 (Demo requests), 20 (Support intake, Failed jobs).
**Scope:**
- Overview (without Ask Quad), with pinned (up to 6) and recent (4) schools in the nav, stored per platform user.
- Schools gallery and list, console search (`/platform/search`) and CSV exports (schools, audit).
- The six-step new-school wizard with the stages editor, logo colour extraction, live previews and streamed provisioning (no app-listing step, D13), ending with the optional **Import the school's data** follow-up link ([21](21-onboarding-import.md)).
- School pages and all their tabs, including the user profile page, the role builder page and bulk user actions; the danger zone with a suspend reason shown to the school, reactivate, schedule deletion and cancel scheduled deletion.
- Curricula, with apply-to-schools.
- Plans & billing, with the New and Edit plan drawers: impact panel, when a price change applies (next renewal, or now with proration), archive and delete (`DELETE /platform/plans/:id`).
- **Leads** (from demo requests: list, status, owner, notes, convert to school).
- **Platform users** (owner only), **Support tickets** (with the `support@quad-edu.com` email intake and the staff portal Help drawer) and **System → Jobs** (failed jobs with retry).
- Audit log.
- Feature flags (`feature_flags`, cached in Redis), set per school from the school page.
- Branding publish with live re-theming.
- Early warning for schools: the health job, the page, the overview panel and the check-in drawer (with, when, how, notes, calendar invite; `school_checkins`).

**Accept:**
- Journeys 1, 2, 20 (console step), 21, 22, 23, 24, 25, 26 and 47 in [17](17-testing-quality.md#cross-app-journeys-must-stay-green-from-the-milestone-that-introduces-them).
- Wizard validation matches the prototype.
- The console works at 390 px.
- `withPlatform` is used only under `apps/api/src/platform/**` and `apps/api/src/worker/platform-jobs/**` (lint passes).

**Prompt:**
> Build milestone M2 (docs/spec/07, the Schools part of docs/spec/10, the Demo requests part of 19 and Support intake and Failed jobs in 20). Match design/platform.html screen by screen. Implement the wizard and provisioning job, the stages editor, curricula, plans with the impact panel, school pages with bulk user actions and the danger zone, Leads, Platform users, Support tickets, System → Jobs, search and exports, branding publish over realtime, and early warning for schools with check-ins. Add journeys 1, 2, 20 (console step), 21–26 and 47. Run pnpm verify and attach screenshots of each console page in light and dark.

## M3 Academic structure and staffing
**Read:** 14 (curriculum, staffing), 04 (Academic structure).
**Scope:**
- Structure API and screens: stages, year groups, classes, subjects per year group (with copy to other year groups), the bell-times editor per stage, rooms.
- Teachers & classes (teachers, classes, sections) with load, teacher unavailability (input to the timetable generator), and staff office hours (`staff_office_hours`, used by the 10-minute chat in M9).
- Academic years, terms and holidays (including Poya days for Sri Lankan schools).
- Year-group labels used everywhere.
- The filter dropdown component used across toolbars.

**Accept:**
- A school on the Sri Lankan curriculum shows "Grade" labels everywhere, and a Cambridge school shows "Year".
- Subject and bell validation works as specified.

**Prompt:**
> Build milestone M3 (docs/spec/14 sections "The curriculum drives everything" and "Teachers & classes", plus the matching tables in 04). Match the Subjects and Bell times drawers and the Teachers & classes page in design/admin.html. Include rooms and teacher unavailability. Unit-test stage kind inference and the periods check. Run pnpm verify.

## M4 Students, admissions, CRM, attendance, import
**Read:** 08 (Admissions, CRM, Students, Attendance), 04, 21.
**Scope:**
- Students directory and profile, guardians and guardian invites (QR code and signed link); bulk message, export and move class.
- The admissions kanban (drag and keyboard), the applicant drawer, New application, enrol, plus: recommendation (offer, waitlist, decline), the waitlist stage, request missing documents, book an assessment with scores, offers (letter template, deposit), the fees tab, and Export.
- CRM: leads, activities (call, email, note), campaigns, enquiry forms, and the public enquiry endpoint (`tenant_by_embed_key`).
- **Onboarding import framework** ([21](21-onboarding-import.md)): templates, column and value mapping, the Classe365 preset, dry run, account deduplication, batches with 7-day rollback, invites; entities staff, classes, students, guardians and links, enrolments. It replaces the earlier student CSV import. Settings → Import data in the staff portal.
- Registers, the school attendance view, absence reports, and the 09:00 absence notification job (SMS and email adapters with local sinks).
- Command palette search (`GET /search`).

**Accept:**
- Journeys 3, 4 (the push part arrives in M6; check the notification record for now), 27 and 28.
- Import of 5,000 students with guardians: dry run under 15 s, commit under 60 s.

**Prompt:**
> Build milestone M4 (docs/spec/08 sections Admissions pipeline, CRM & leads, Students, Attendance; docs/spec/21 for import; and Search in 15). Match design/admin.html. Build the import framework in a reusable way (later milestones add opening balances and historic data), with deduplication into accounts and memberships and rollback. Add journeys 3, 4, 27 and 28. Run pnpm verify.

## M5 Timetable, My teaching, cover
**Read:** 14 (Timetable, My teaching, Staff cover).
**Scope:**
- `packages/domain/timetable` generator and repair pass (respecting teacher unavailability and rooms), with property tests (no hard-constraint violations on generated schools of 300, 800 and 1,500 students).
- Timetable page: Rearrange, Week A/B, publish.
- My teaching (including the "Working on with {child}" teaching notes), the cover board, auto-assign, publish, accept and decline a cover request, and "Back in school" (cancel an absence).

**Accept:**
- Journeys 10 and 29.
- Generation stays within the performance budget.

**Prompt:**
> Build milestone M5 (docs/spec/14 Timetable, My teaching, Staff cover). Implement the school-wide timetable generator in packages/domain with property-based tests, then the pages from design/admin.html. Add journeys 10 and 29. Run pnpm verify.

## M6 Parent app core, messaging and notifications
**Read:** 09, 12 (Messages, Broadcasts, Notifications), 05 (Parent app sign-in, invite codes), 02 (Parent app (Flutter)), 20 (App store publishing).
**Scope:**
- Parent app:
  - start-up, lock and sign-in: welcome screen, phone with country code, "Use email instead", "I have an invite code" (scan the invite QR code or paste the signed invite link; there is no short-code lookup), the "You're signed in, we found {n} children" step, the school picker and Switch school for parents at several schools, biometric re-lock after 5 minutes in the background;
  - Home (without the day ring, heads-up row and Ask Quad) from `/family/home`;
  - child switcher with swipe;
  - Attendance (with Report an absence), Timetable, Homework, Results, Rewards, Children profile;
  - Messages (with mark read, archive and mute), More, staff directory, contact-details change (with the staff review queue), notification settings (seven categories and the SMS backup flag), Help;
  - offline cache encrypted and wiped on sign-out and school switch; `GET /app/config` with force update; the full deep-link table on `quad://` and `https://quad-edu.com/p/…`.
- Staff side: the Inbox (with reply templates, `message_templates`), Broadcasts (preview, SMS cost estimate, urgent flag), and the "Changes from parents" queue (contact changes now; pickup approvals join it in M11).
- FCM push with deep links (`go_router`) and the in-app notification list. Realtime connection in all apps.

**Accept:**
- Journeys 4 (push), 30, 31, 32 and 45.
- The parent app passes Maestro and `integration_test` flows for sign-in, Home, switching child, and sending a message (nightly run green).
- Golden tests pass at text scale 2.0.
- A `/p/…` link opens the app on a device with it installed and the "Get the Quad app" page otherwise; an `/app/…` link never opens the app.

**Prompt:**
> Build milestone M6 (docs/spec/09 except Circle, Payments and School life; docs/spec/12 Messages, Broadcasts, Notifications; the parent part of 05). Match design/parent.html screen by screen; the side panel in the prototype is not part of the app. Build it in Flutter (apps/parent) as described in docs/spec/02 "Parent app (Flutter)", including invite codes, deep links, the encrypted cache, force update and biometric re-lock. Add widget, golden, integration_test and Maestro flows and journeys 30, 31, 32 and 45. Run pnpm verify and pnpm e2e:mobile.

## M7 Fees, payments and finance
**Read:** 13, 21 (Opening balances), 20 (Providers).
**Scope:**
- Fee items, structures and discounts (percentages 1–100 in steps of 0.5).
- The billing run drawer and job, invoices, the preview drawer, reminders, refunds.
- Online payments per school (D20): the school admin enters its own PayHere or Stripe credentials (encrypted, test or live mode, with **Test connection**) in Fees → Online payments; webhooks resolved with `tenant_by_gateway_account`; refund webhooks; settlement reconciliation.
- Parent Payments, the pay sheet (slide to pay with Face ID), instalments and part payments; the payment handshake (PayHere hash computed on the server with `payhere_mobilesdk_flutter`; Stripe PaymentIntent and PaymentSheet; Apple Pay and Google Pay merchant ids).
- **Opening balances import** on the M4 framework.
- Accounting: chart of accounts, journal entries with the balance check, automatic postings, dashboard, budgets.
- Platform billing for schools (Quad's own accounts): invoice PDFs, tax per country, card update, billing contact, proration, trial end, dunning at 3, 7 and 14 days, automatic suspension at day 21 past due (reactivated on payment), and the SMS usage line.

**Accept:**
- Journeys 6, 43 (webhook part), 48 and 49.
- Fee maths unit tests cover discounts, instalments, rounding and opening balances.
- Webhooks are idempotent and refuse unsigned or mismatched-account requests.

**Prompt:**
> Build milestone M7 (docs/spec/13 and Opening balances in 21). Put all money calculations in packages/domain/fees with exhaustive unit tests. Implement the billing run, invoices, refunds, per-school gateways with sandbox webhooks, the parent pay sheet, opening balances import, accounting and platform billing. The canteen wallet is M11. Add journeys 6, 48 and 49 and the webhook part of 43. Run pnpm verify.

## M8 Pastoral, learning, exams, reports, evenings, forms and trips
**Read:** 08 (Pastoral, Evenings & forms), 14 (Courses, Exams, Reports), 09 (School life, child screens), 21 (Historic data).
**Scope:**
- Behaviour (with edit and the school's reasons list), medical, sick bay, safeguarding (with view logging and encryption); the parent Medical screen.
- Courses, assignments, the weighted gradebook with Publish to parents and Export CSV.
- Exam series, the generator, adding and deleting papers, the clash check, publishing; the parent Exams screen.
- Report cycles, the workflow (send back with a note, reopen, unpublish), the comment bank, PDFs, the parent Reports screen.
- Parents' evenings (grid, parent booking, remind unbooked parents, per-teacher PDF), forms (parent signing, fee to Payments, close, export).
- Trips: the staff Trips tab and endpoints, `/family/trips`, consent through forms and payment through invoices.
- **Historic attendance and marks import** (optional) on the M4 framework.

**Accept:**
- Journeys 7, 8, 9, 33 and 34.
- Safeguarding access tests pass.

**Prompt:**
> Build milestone M8 (docs/spec/08 Pastoral and Evenings & forms, 14 Courses, Exams, Reports, 09 School life, and Historic data in 21). Match design/admin.html and design/parent.html. Add journeys 7, 8, 9, 33 and 34 and the safeguarding access tests. Run pnpm verify.

## M9 Moments, early warning and the story-first homes
**Read:** 10, 12 (Moments), 08 (Dashboard), 09 (Home).
**Scope:**
- Moments: staff drawer with the photo consent check, parent Moments in the Circle tab, reactions, thank-you messages, realtime, push.
- Early warning:
  - the `compute-signals` job and domain scoring;
  - the Early warning page, cards, plan drawer, How this works, review reminders;
  - the student profile banner;
  - the parent heads-up row in Needs you and the "How {child} is doing" screen with the heads-up card, **Book a 10-minute chat** (in the teacher's office hours from M3, `chat_requests`) and **Message the teacher**;
  - the sharing setting.
- Staff dashboard "the school today" from one aggregate endpoint (`GET /dashboard`): greeting summary, Needs you today, Good news with birthdays and **Send wishes**, the early-warning strip, **The numbers** (KPIs, fee collection chart, admissions funnel, attendance trend, Today, overdue invoices) and **My tasks** (`tasks`).
- Parent Home: the story-first greeting and Needs you from `/family/home`.

**Accept:**
- Journeys 5, 11, 44 and 46.
- Scoring unit tests cover every rule in [10](10-early-warning.md).
- The dashboard loads from one request within the API read budget.

**Prompt:**
> Build milestone M9 (docs/spec/10, 12 Moments, 08 Dashboard, 09 Home). Implement the early-warning scoring in packages/domain with a unit test per rule, Moments end to end with realtime, the dashboard aggregate with The numbers, tasks and birthdays, the parent heads-up row and How {child} is doing with chat booking, and the story-first home pages. Add journeys 5, 11, 44 and 46. Run pnpm verify.

## M9b Quad Circle
**Read:** 12 (Quad Circle to Good relationships by design), 09 (Circle tab, Home day ring, Day, recap), 08 (Family connection, School settings quiet hours, student profile), 14 (My teaching), 05 (Relatives), 16.
**Scope:**
- `packages/domain/circle`: day-ring events from registers, gate scans (`gate_events`), moments, canteen and bus; family pulse; connection figures; weekly recap; quiet-hours delivery time. Unit tests first.
- Moments: skill tags, photo-consent scopes in the share drawer and the feed, quiet-hours scheduling (`deliver_at` with a BullMQ delayed job).
- This week in class: staff card and drawer, parent Learning segment, We tried it, term skill tally.
- Parent Circle tab (Moments · People · Learning), person screen (Message, Say thanks, Ask for a chat), Home day ring and Day screen, weekly recap job (Friday 15:00 school time, "Last week with {child}") and push.
- Family circle: invite, OTP sign-in with `kind: relative` tokens, the reduced relative app (Moments only), removal with token revocation.
- Staff: Family pulse, Family connection view with **Send a note from the office**, quiet hours in School settings, student profile Circle lines.

**Accept:**
- Journeys 14, 15, 16, 35, 36 and 37.
- Golden tests for the Circle tab segments and the Home day ring, light and dark.

**Prompt:**
> Build milestone M9b (docs/spec/12 Quad Circle sections, 09 Circle tab and Home day ring, 08 Family connection and quiet hours, 05 Relatives). Match design/parent.html (Circle tab, Day, recap) and design/admin.html (My teaching Family pulse and This week in class, Family connection, quiet hours). Put the Circle maths in packages/domain/circle with unit tests. Add journeys 14, 15, 16, 35, 36 and 37 (the relative-token route test). Run pnpm verify.

## M10 Ask Quad
**Read:** 11, 16 (Data residency). In Claude Code, run `/claude-api` first for current SDK usage.
**Scope:**
- The assistant module, SSE transport, and the tools for all three apps with permission checks (parent tools scoped to linked children).
- System prompts, caching, refusal handling, conversation storage, feedback, rate limits, the school setting.
- Cost controls: a monthly token budget per plan, a hard cap, alerts at 80%, a usage view (school settings and console), and the outage message when the API is unavailable.
- The panels in all three apps, with suggestion chips, actions and sources.
- The evaluation set and runner (`pnpm eval:assistant`).

**Accept:**
- Journeys 12 and 38 with a mocked model.
- The evaluation shows at least 95% fact accuracy and zero leaks (run manually; add the result to the PR).

**Prompt:**
> Build milestone M10 (docs/spec/11). First run /claude-api to load current Anthropic SDK guidance for TypeScript, then implement Ask Quad exactly as specified: read-only permission-checked tools, streaming over SSE, caching, refusal fallback, cost controls, and the three UI panels. Add journeys 12 and 38 with a mocked Anthropic client and the eval runner (do not run the paid eval in CI). Run pnpm verify.

## M11 Transport, pickup, wallet, news and stories, calendar, year rollover
**Read:** 09 (Bus, Pickup pass, Canteen, News, Calendar), 08 (Transport, News and stories), 13 (Canteen wallet), 14 (Academic year).
**Scope:**
- Transport: staff Routes screen (routes, stops, students per stop) and endpoints, a provider adapter with a simulator (GPS hardware integration is v2), the parent live bus map with push alerts.
- Pickup: the parent's pickup people (add, approval in "Changes from parents"), the rotating pickup pass and Share pass (valid today only), the staff pickup scanner screen writing `gate_events`, and the parent's scan notice.
- Canteen wallet: top-up through the school's own gateway (D20), daily limit, menu (`canteen_menu`), the staff manual purchase screen, and the parent Ask Quad wallet and menu tool.
- News and stories: staff publishing, the parent news article screen, stories with hearts and replies (`story_reactions`).
- Calendar: filters (Everything, Events, Days off), "Add to phone calendar" (ICS per event) and a subscribe feed.
- Academic year, pre-rollover checks, the rollover wizard with exceptions (repeats the year, leaving) and new intake, and the rollover job.

**Accept:**
- Journeys 13, 39, 40 and 41.
- The bus simulator drives the map and push alerts.

**Prompt:**
> Build milestone M11 (docs/spec/09 Bus, Pickup pass, Canteen, News, Calendar; 08 Transport and News and stories; 13 Canteen wallet; 14 Academic year and rollover). Match design/admin.html and design/parent.html. Add journeys 13, 39, 40 and 41. Run pnpm verify.

## M12 Hardening and launch
**Read:** 15, 16, 17, 20.
**Scope:**
- Production infrastructure: the `production` Terraform environment (separate AWS account, Multi-AZ RDS + Proxy, Redis with failover, three NAT gateways, WAF rules tuned on staging traffic), the release-tag deploy with approval, SES production access, registered SMS sender IDs, the `quad-prod` Firebase project.
- Backups (PITR 35 days, cross-region snapshot copy, monthly snapshots) and a **restore drill**, plus a rehearsed single-school restore; the tenant deletion job verified across Postgres, S3, Redis and search; the retention purge job.
- Observability dashboards, SLOs (99.9% for sign-in, API and parent push within 60 s), alerts, the **on-call** rotation and paging, and the status page at `status.quad-edu.com`.
- Performance work to meet the budgets, and a load test (k6) on the main endpoints.
- Security review, CSP, a dependency audit, **DAST** (OWASP ZAP baseline nightly on staging and a full authenticated scan), and the pen-test fixes.
- Runbooks in `docs/runbooks/` ([20](20-infrastructure-operations.md#runbooks-docsrunbooks-m12)).
- **Accessibility audit** (WCAG 2.2 AA, with screen readers on web, iOS and Android) and fixes.
- **Store submission**: developer accounts, the one "Quad – School & Family" listing, signing, privacy labels and the Play data safety form, the App Review demo school and account, phased release and staged rollout, and force update through `min_version`.

**Accept:**
- Every budget in [15](15-cross-cutting.md#performance-budgets) and [19](19-public-site.md#performance-budget) is met.
- No high or critical security findings remain (pen test and ZAP).
- A restore drill succeeds within the RTO, and the single-school restore is rehearsed on staging.
- Staging passes every journey; production serves `quad-edu.com` from a tagged release.
- The status page, alerts and on-call paging are tested with a drill incident.
- The app is approved in both stores.

**Prompt:**
> Build milestone M12 (docs/spec/15, 16, 17 and 20). Add the production Terraform environment and the release deploy, backups with a restore drill and the single-school restore procedure, the retention purge and tenant deletion jobs, dashboards, SLOs, alerts, on-call and the status page, and the runbooks. Measure against the performance budgets and fix what fails; run the OWASP ZAP scans and fix the findings; do the accessibility audit; and prepare the store submission (signed release builds, privacy labels, data safety, review account, phased rollout). Report every budget with its measured value and every check with its result.

---

## Progress
- [ ] M0 Foundations
- [ ] M0b Infrastructure and staging
- [ ] M1 Auth, tenancy and permissions
- [ ] M1b Public site
- [ ] M2 Platform console
- [ ] M3 Academic structure and staffing
- [ ] M4 Students, admissions, CRM, attendance, import
- [ ] M5 Timetable, My teaching, cover
- [ ] M6 Parent app core, messaging and notifications
- [ ] M7 Fees, payments and finance
- [ ] M8 Pastoral, learning, exams, reports, evenings, forms and trips
- [ ] M9 Moments, early warning and the story-first homes
- [ ] M9b Quad Circle
- [ ] M10 Ask Quad
- [ ] M11 Transport, pickup, wallet, news and stories, calendar, year rollover
- [ ] M12 Hardening and launch
