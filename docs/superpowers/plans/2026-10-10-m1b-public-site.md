# M1b Public Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status (2026-10-10): planned, not started; amended the same day with the product owner's answers** (see Open questions: all seven are decided). M1 is complete (D32, D46 to D56). M1b stays unticked in spec 18 until Task 17.

**Goal:** The public site at `quad-edu.com` becomes the real front door. A staff member signs in from a dialog on the landing page, using the M1 flow (`/#signin`), and a signed-in visitor sees **Open {school}**. The school and parent demo forms send to `POST /api/v1/public/demo-requests` (Turnstile, 5 per hour per IP, a honeypot). That writes `platform_leads`, emails the sales inbox and sends the requester a confirmation. The legal set is complete with `/legal/dpa` and `/legal/cookies`. `/p/*` shows "Get the Quad app", and the `.well-known` app-link files cover only `/p/*`. SEO is complete: OG image, JSON-LD, robots and sitemap. Google Analytics (GA4) counts visits, but only after the visitor accepts a cookie banner: nothing from Google loads, and no request goes to Google, before Accept (owner, OQ3). The landing route passes a Lighthouse budget and a visual test. Journey 20 (up to the sales email) is green in `pnpm verify`.

The pre-launch site on GitHub Pages keeps working, unchanged in behaviour, from the same code: Sign in still opens the coming-soon note and the forms still open an email. One build flag, `NEXT_PUBLIC_QUAD_PRELAUNCH`, chooses between the two, and `checkExport` proves that nothing that needs the API reaches the export.

**Already built (do not redo; D30, D31, D33, D41 to D45, D56):**
- **Landing page.** Every section of `/` from `design/landing.html`: top bar, view switch, hero stage, ticker, circle, Wellbeing with the Leo card, modules, kind and safe, demo panel and footer. Also the `site-*` tokens, Bricolage Grotesque, avatars and doodles, the coming-soon note (`SignInEntry`), the Get the app note, and both demo forms with shared Zod checks and `mailto` (`DemoForm`, `_lib/demo-mailto.ts`).
- **Other public pages.** `/about`, `/security`, `/legal/privacy` (version 0.2, with the sub-processor cards, D44) and `/legal/terms`, as story cards (D45) through `ArticlePage`. Plus `company.ts` with `unconfirmedFields()`, the circle-quarters footer (D43), `publicPageMetadata` (title, description, canonical, OG and Twitter `summary`), `sitemap.ts`, and the 404 page.
- **Static export.** `site-export/` (re-exports only), `scripts/build-export.mjs` with `checkExport` (refuses `app`, `sign-in`, `design`, `healthz`), `pages-files/{CNAME,robots.txt}`, `pages.yml`, `e2e:export`, `e2e/landing.spec.ts` and `e2e/public-pages.spec.ts`.
- **From M1.**
  - The `/sign-in` flow (`(auth)/sign-in/_components/SignInFlow.tsx`, `signInReducer`).
  - The `quad_last_school` cookie.
  - `@RateLimit` with HMAC-hashed subjects (fails open on a Redis error, D32).
  - `DeliveryService` email templates through BullMQ to Mailpit.
  - The `POST /public/enquiry/:embedKey` stub (Task 13, unchanged here; M4).
  - The config placeholders `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `PLAUSIBLE_DOMAIN`, `SALES_INBOX`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` (declared but read by nothing).

**Not built yet (what this plan covers):**
- `platform_leads` does not exist: no schema file, no migration, not in `PLATFORM_TABLES`. The next migration is `0022_*`.
- No sign-in dialog. `SignInEntry` links to `/app` when not pre-launch, and the footer's **Sign in** is a plain `/app` link even in the export (it 404s on Pages today).
- No demo endpoint, Turnstile, analytics, cookie banner, OG image, JSON-LD or live `robots.txt` (only the export's static file). No `/p/*`, `.well-known`, DPA or Cookies page, no Lighthouse check and no visual test.

**Architecture:**
- **Database.** Migration `0022_platform_leads` creates the platform table `platform_leads`. It is closed to `quad_app`, like every platform table (D24). A public, anonymous route never gets the BYPASSRLS `quad_platform` pool. It writes through one new security definer, `record_demo_request(...)`, in the same shape as `record_email_suppression` (D16's "named, narrow, tested" pattern). The console's Leads screens (M2) read and change leads with `withPlatform` under `apps/api/src/platform/leads/`.
- **API.**
  - `src/public/demo-requests/` holds the tenant-less controller and service (D16: demo requests are platform-level, no tenant).
  - `src/common/turnstile/` holds the `TurnstileVerifier` interface, a Cloudflare implementation and a local one.
  - Two new email templates.
- **Web, one codebase and two builds.**
  - Code that needs the API on the landing page lives in one folder, `src/app/(public)/_live/`. That is the sign-in dialog, Open {school}, the endpoint form submitter and the Turnstile loader.
  - The pre-launch export aliases `_live` to stubs in `site-export/prelaunch/`, so none of that code is compiled into the export. `checkExport` then scans the output for anything that would call the API.
  - The normal staff build chooses by `NEXT_PUBLIC_QUAD_PRELAUNCH` at render time, so AWS could also serve a pre-launch build if the owner wants.
- **Rules.** No business rules are added to `packages/domain`. The lead upsert rule ("the same email within 24 hours updates the lead") lives in the definer and is tested there. Form validation stays in `packages/contracts` (shared by page and API).

**Tech Stack (new):**
- Web:
  - Cloudflare Turnstile's browser script (`challenges.cloudflare.com/turnstile/v0/api.js`, loaded on first interaction, not an npm package);
  - Google's tag (`https://www.googletagmanager.com/gtag/js?id=<NEXT_PUBLIC_GA_MEASUREMENT_ID>`, not an npm package), injected only after the visitor accepts the cookie banner, and only when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set (Task 13);
  - `lighthouse` (dev dependency, run against Playwright's Chromium) for the budget.
- API: no new dependency. Turnstile siteverify is a `fetch` to `https://challenges.cloudflare.com/turnstile/v0/siteverify`.
- Pin exact versions at install (at least two weeks old) and record them in the D57 row. Each must pass `pnpm audit --prod --audit-level high`.

**Spec:**
- `docs/spec/18-delivery-plan.md`: M1b (Built early, Scope, Accept, Prompt).
- `docs/spec/19-public-site.md`: all of it, especially Where it lives, Pre-launch site, Sign-in, Demo requests, Legal pages, SEO, Analytics, Performance budget, Accessibility and Tests.
- `docs/spec/05-auth-tenancy-rbac.md`: Staff portal sign-in, Tenant-less entry points.
- `docs/spec/04-data-model.md`: Platform (`platform_leads`).
- `docs/spec/06-api-and-events.md`: Public (`POST /public/demo-requests`), Jobs (`demo-request-received`), Rate limits, Errors.
- `docs/spec/02-architecture.md`: Paths (D14), Tenant-less entry points (D16), environment variables, and the decision log, especially D16, D21, D24, D30, D31, D32 (Pre-launch, Sign-in pages), D33, D34, D37, D41 to D46 and D56.
- `docs/spec/16-security-privacy.md`: threats (demo form spam), sub-processors, data residency, data protection.
- `docs/spec/17-testing-quality.md`: journeys 17, 18 and 20, and the quality gate (Lighthouse from M1b).
- `docs/spec/09-parent-app.md`: Deep links (the `/p/*` paths, including `invite/{token}` and `pickup/{passToken}`).
- `docs/spec/08-staff-portal.md`: Public landing page.
- Prototypes:
  - `design/landing.html`: the `dialog.si` sign-in dialog and its script (email → password → code → school → opening), the demo form and its `done` state, and the footer;
  - `design/pages.html`: the legal page layout (In short, On this page, cards) for the DPA and Cookies pages.
- Project rules: `CLAUDE.md` and every `.claude/skills/quad-*` skill (`quad-api-endpoint` for Task 4, `quad-tenant-table` for Task 2 even though the table is a platform table, `quad-web-screen` for Tasks 7 to 13).

## Global Constraints

**Shared checkout.** Other agents may be committing in the same checkout. Before each task, `git pull`/`git log` to see what landed. Take the next free migration number and decision-log id at the time you write them (this plan assumes `0022` and D57). Never rewrite or revert someone else's change.

**Secrets, credentials and repository content**
- Commit no secrets.
  - Cloudflare's published Turnstile **test** keys are allowed only as local defaults, and the API refuses them outside `local`, as D25 did for `SESSION_SECRET`:
    - site keys `1x00000000000000000000AA` (passes) and `2x00000000000000000000AB` (fails);
    - secrets `1x0000000000000000000000000000000AA` (passes) and `2x0000000000000000000000000000000AA` (fails).
  - Real keys are hand-set secrets (infra README).
- Never read `.env`. Use `.env.example` and explicit `-e` flags.
- Write no AI model name or model id into any new file.
- Commits:
  - Conventional Commits, with the two attribution trailer lines the controller supplies;
  - run `quad-review` on the diff before each commit;
  - do not push unless the controller says so.
- Never edit `design/`. Regenerate generated files (`pnpm api:client`, `pnpm i18n:build`); never hand-edit them.
- Migrations are append-only.

**Tenancy and security (blocking in review)**
- The demo endpoint is tenant-less and platform-level (D16). It never opens `withTenant`. It never uses `withPlatform` (that stays in `apps/api/src/platform/**` and `apps/api/src/worker/platform-jobs/**`). It writes only through `record_demo_request`, which is:
  - owned by `quad_owner`;
  - pinned `search_path`;
  - `REVOKE ALL … FROM PUBLIC`, `GRANT EXECUTE … TO quad_app`;
  - returns nothing that identifies an existing lead.
- Nothing from the request picks a tenant. `converted_tenant_id` is written only by the console in M2.
- **No enumeration.** A new lead, an updated lead (the same email within 24 hours) and a honeypot hit all answer `202` with an empty body.
- **No PII in logs, metrics, job ids or analytics.** No email, name or school in logs or job ids (job ids are `demo-request.<leadId>.<sales|confirm>`), and none in Google Analytics: no email, name or school in page paths, page titles or event parameters (Task 13 builds `page_location` itself and types every event). The IP is stored only as an HMAC (`ip_hash`, a key derived from `SESSION_SECRET` with HKDF info `quad lead ip`).
- **No relay for abuse.** The requester's confirmation email echoes no text the requester typed (no name, school or note), so the form cannot be used to send someone else arbitrary text. The confirmation also has a per-email limit (OQ4).
- `/p/*` paths can carry signed tokens (`invite/{token}`, `pickup/{passToken}`, spec 09). The fallback page:
  - never renders, logs or sends the path;
  - gets `Referrer-Policy: no-referrer` and `X-Robots-Tag: noindex`, like the M1 signed-link pages;
  - loads no analytics.
- Analytics loads only on `(public)` pages, never under `/app`, `/sign-in/**` or `/p/**`.
- **Consent first (owner, OQ3).** Google Analytics is the only non-essential cookie. Before the visitor presses **Accept** on the cookie banner, the page loads no `gtag.js`, sets no `_ga` cookie and sends no request to any Google host (`googletagmanager.com`, `google-analytics.com`, `*.google.com`, `doubleclick.net`). **Reject** is final until the visitor changes it through **Cookie settings**. Google Consent Mode v2 defaults are all `denied`; after Accept only `analytics_storage` becomes `granted`, and the three ads signals stay `denied`. Task 13 owns this and its tests.

**The pre-launch site (D30, D32 Pre-launch). It must not regress.**
- `pages.yml` publishes `site-export/out` from `main` with `NEXT_PUBLIC_QUAD_PRELAUNCH=true`. After M1b the export must:
  - still show the coming-soon note for every Sign in, including the footer's (a fix: today the footer links `/app`);
  - still open `mailto:` from both forms;
  - load no Turnstile, no sign-in code and no API call;
  - contain no `/sign-in`, `/app`, `/p/` or `.well-known` routes.
- It gains `/legal/dpa`, `/legal/cookies`, the OG image and JSON-LD, which are all static, and the cookie banner with Google Analytics when the owner sets the Measurement ID for the Pages build (client-only, so it works on Pages).
- **The footer bug ships first.** Today the export's footer **Sign in** is a plain `/app` link that 404s on quad-edu.com. Task 6 Step 0 fixes it in its own commit before anything else in Task 6, and it can be merged on its own.
- Task 6 owns the guard. Every later web task runs `pnpm --filter @quad/staff build:export && pnpm --filter @quad/staff e2e:export` before committing.

**What works where**

| Piece | Pre-launch export (GitHub Pages, flag `true`) | Live build (`next start`/CloudFront, flag unset or `false`) |
|---|---|---|
| Landing, About, Security, Terms, Privacy, **DPA, Cookies** | Yes (static) | Yes (static) |
| Sign in (top bar, menu, hero, footer) | Coming-soon note | Sign-in dialog (`/#signin`); `/sign-in` page |
| Open {school} for a signed-in visitor | Never | Yes (client island, `GET /api/v1/me`) |
| School and parent demo forms | `mailto:support@quad-edu.com` | `POST /api/v1/public/demo-requests` with Turnstile |
| `/p/*`, `/.well-known/*` | Not exported | Yes |
| `sitemap.xml` | The public pages | The public pages and `/sign-in` |
| `robots.txt` | `pages-files/robots.txt` (static) | Route handler: the spec rules in production, disallow-all elsewhere (runtime `APP_ENV`) |
| OG image, JSON-LD, canonical | Yes | Yes |
| Cookie banner and Google Analytics (GA4) | When `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set for the Pages build (a public repository variable in `pages.yml`); GA loads only after Accept | Same: when the variable is set; GA loads only after Accept |
| With no Measurement ID | No banner, no Cookie settings link, no Google code | Same |

**Configuration**
- A new variable goes into the spec 02 table, `.env.example` (same order) and `apps/api/src/config.ts` (or `NOT_READ_BY_THE_API`), in one commit, in the task that first uses it. The parity tests enforce it.
- New and changed variables:
  - `TURNSTILE_SECRET_KEY` becomes required when `APP_ENV` is `staging` or `production`, and a Cloudflare test secret is refused there. Locally, unset selects the offline verifier.
  - `TURNSTILE_SITE_KEY` (API) is dropped from the API's schema and moved to `NOT_READ_BY_THE_API` only if nothing reads it. The API needs only the secret; the web uses `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
  - `TURNSTILE_EXPECTED_HOSTNAME` (new, API) is the hostname siteverify must report (`quad-edu.com`; `staging.quad-edu.com`). Required outside local.
  - `SALES_INBOX` is required outside local. Its value in staging and production is `support@quad-edu.com` (owner, OQ2): a setting, so a sales mailbox can replace it later without code. Spec 02's example value changes from `sales@quad-edu.com` (Task 17).
  - `CONSOLE_URL` (if not already present) is used for the console link in the sales email. Check `config.ts` first and reuse what exists.
  - `PLAUSIBLE_DOMAIN` and `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` are deleted everywhere (spec 02, `.env.example`, `config.ts` and `NOT_READ_BY_THE_API`, `web-env.ts` and its test), because Plausible is not used (owner, OQ3; Task 13).
  - `NEXT_PUBLIC_GA_MEASUREMENT_ID` (new, web, build time, public): the GA4 Measurement ID, `G-` and 4 to 12 upper-case letters or digits. Optional in every environment: unset means no banner and no Google code. It is not a secret (it ships in the page). `pages.yml` reads it from a repository variable (`vars.GA_MEASUREMENT_ID`). Tests use no ID, and the fake `G-TEST000000` for the consent checks (Task 13).
  - `APPLE_TEAM_ID` and `ANDROID_APP_CERT_SHA256` (new, web server run time, read by the `.well-known` route handlers). Optional: when unset, those routes answer 404 (OQ5).

**Decision log (D57)**
- Task 1 adds the D57 row skeleton to `docs/spec/02-architecture.md`: a summary sentence and a `<ul>` per area (Data, API, Turnstile, Build split, Sign-in dialog, Pages, SEO and analytics, Testing).
- Each task appends its bullets in its own commit.
- Task 17 finalises it and edits the specs. The full list is in "Proposed decision-log row" below.

**UI (blocking in review)**
- Tailwind `site-*` utilities only on public pages: no raw hex and no arbitrary colour values. The sign-in dialog's sheet uses the `site-sheet-*` tokens. The M1 sign-in cards inside it keep the app tokens (OQ-T1).
- Copy goes in `packages/contracts/i18n/en.json` under `public.*`, in plain English. Buttons say what happens ("Request a demo →", "Send to my school →", "Sign in"). The thank-you says what happened.
- Everything works at 390 px and in dark mode, axe has no serious or critical issues, and every motion stops with reduced motion.
- Dialogs are a modal `<dialog>`: Escape closes it and focus returns to the opener.
- The JavaScript budget for the landing route is under 150 KB gzip (today about 139 KB). The sign-in dialog, Turnstile and Google's tag must not count before interaction:
  - the dialog is a `next/dynamic` chunk loaded on the first Sign in click or `#signin`;
  - Turnstile loads on the first focus inside a demo form;
  - the cookie banner is small (target under 2 KB gzip, in the main chunk) and is a fixed overlay, so it adds no layout shift;
  - `gtag.js` loads only after Accept, so it is never part of the budget measurement: Lighthouse runs with no stored choice, sees the banner and no Google request (Task 15). D57 states this.
- The cookie banner and its Cookie settings dialog use `site-*` tokens, work at 390 px and in dark mode, and are accessible (a labelled region, keyboard order Accept then Reject then the link, visible focus, no focus trap on the non-blocking banner).

## Review Focus

1. **The export stays API-free.** `checkExport` fails on:
   - any exported file that contains `/api/v1/`, `challenges.cloudflare.com`, `data-signin-dialog` or `href="/sign-in`;
   - a `sitemap.xml` that lists `/sign-in`;
   - a `p/` or `.well-known/` folder.

   Task 6 owns the unit tests. `e2e:export` checks the behaviour.
2. **Demo endpoint abuse.** The checks run in this order: rate limit, then the body, then the honeypot, then Turnstile, then storage.
   - The 6th request in an hour from one IP gets 429 with `Retry-After`.
   - A honeypot hit gets 202 with no row and no email.
   - A failed captcha gets 400 `captcha_failed` with no row and no email.
   - Cloudflare unreachable or slow (5 s timeout) gets 503 `captcha_unavailable`. It fails closed, with no row.
   - A Turnstile token whose `hostname` or `action` does not match is refused as `captcha_failed`.

   Task 4 owns the tests.
3. **No lead enumeration.** A new lead and an update answer byte-identically. The definer returns `(lead_id, created boolean)` to the service only, and the response never depends on `created`. Task 4 owns the test.
4. **Platform table closed.** As `quad_app`, `select`, `insert`, `update` and `delete` on `platform_leads` are refused, and only `record_demo_request` writes it. Task 2 owns the test.
5. **Signed-in hint is only a hint.** Open {school}:
   - shows only after `GET /api/v1/me` answers 200 for the browser's own cookie;
   - reads the school name from that answer, never from `quad_last_school` alone;
   - links only to `/app`.

   Task 8 owns the test.
6. **Token paths stay private.** `/p/invite/abc` renders no part of the path, sends `no-referrer` and `noindex`, and loads no Google tag or banner. Task 11 owns the test.
7. **Cookies page tells the truth.** One typed registry lists every cookie and storage key the site and portal set, including `_ga`, `_ga_<id>` and the consent key. A unit test checks it against the API's cookie names. An e2e cookie audit fails on anything the browser holds that the registry does not name. Task 10 owns both.
8. **Consent first.** With the fake Measurement ID, no request goes to a Google host and no `_ga` cookie exists before Accept, nor ever after Reject; after Accept the tag loads with ads signals denied; withdrawing through Cookie settings deletes the `_ga` cookies and stops the tag. With no ID there is no banner and no Google code. Task 13 owns the tests.

---

## Phase 1: Contracts and data

### Task 1: Demo request contract, cookie-name registry and the D57 skeleton

**Files:**
- Modify:
  - `packages/contracts/src/public/demo-request.ts` and `.test.ts`;
  - `packages/contracts/src/errors.ts` (or wherever error codes live; search first with `quad-reuse`);
  - `packages/contracts/src/index.ts` and the `public` entry;
  - `apps/api/src/common/session/cookies.ts`;
  - `apps/staff/src/lib/session.ts` (where it hard-codes cookie names);
  - `docs/spec/02-architecture.md` (D57 skeleton).
- Create: `packages/contracts/src/web/cookies.ts` and `.test.ts`.

**Behaviour:**
- `DemoRequestBody` is the API body: a discriminated union on `kind`:
  - `kind: 'school'` is `DemoRequestSchema` plus `turnstileToken` (string, 1 to 2048 characters) and `website` (the honeypot: optional string, any value accepted by the schema so that a bot is not told);
  - `kind: 'parent'` is `SchoolIntroRequestSchema` plus the same two fields.
  - The existing `DemoRequestSchema`, `SchoolIntroRequestSchema`, `demoRequestProblem` and `schoolIntroProblem` are unchanged, because the forms keep using them.
- New error codes, each with copy in `en.json`:
  - `captcha_failed` (400): "We couldn't check that you're not a robot. Try again.";
  - `captcha_unavailable` (503): "We couldn't send your request just now. Try again in a minute, or email support@quad-edu.com.".
  - `rate_limited` exists already. Its public copy is "You've sent a few requests already. Try again in an hour, or email support@quad-edu.com.".
- `QUAD_COOKIES` is the one list of cookie names and storage keys, with purpose, lifetime, set-by, the host it lives on and a category (`necessary` or `analytics`). It holds:
  - `quad_sid` / `__Host-quad_sid`, `quad_csrf` / `__Host-quad_csrf`, `quad_trusted` / `__Host-quad_trusted` and `quad_last_school` on `quad-edu.com` (necessary);
  - `quad_console_sid` and `quad_console_csrf` on `console.` (necessary);
  - the local-storage keys `quad-theme` and `quad-site-view` (necessary);
  - the local-storage key `quad-cookie-consent` (necessary: it remembers the banner choice; Task 13);
  - `_ga` and `_ga_<id>` (a name pattern, `/^_ga_[A-Z0-9]+$/`), category `analytics`, set by Google Analytics on the public pages only after Accept, 13 months (Task 13 sets `cookie_expires`).
  - `cookieNames(appEnv)` and `LAST_SCHOOL_COOKIE` in the API, and the staff app's session helpers, read their names from it. This moves the names without changing them, so a refactor test pins every name.
- **D57**: the skeleton.

Steps:
- [ ] **Step 1: Write failing tests.**
  - `DemoRequestBody` accepts both kinds and refuses a missing `turnstileToken`, an unknown `kind` and a 1,001-character note.
  - `website` is accepted when filled (the service, not the schema, drops it).
  - The cookie registry's names equal `cookieNames('production')`, `cookieNames('local')` and `LAST_SCHOOL_COOKIE`, and `THEME_STORAGE_KEY` and `VIEW_STORAGE_KEY`.
  - `matchesRegistry('_ga_ABC123')` is true and `matchesRegistry('_gid')` is false; only the GA entries have category `analytics`.
- [ ] **Step 2: Run them to see them fail.** `pnpm --filter @quad/contracts test`. Expected: FAIL.
- [ ] **Step 3: Implement.** Move the names, keep the behaviour, then `pnpm i18n:build`.
- [ ] **Step 4: Run the checks.** `pnpm --filter @quad/contracts test && pnpm --filter @quad/api test && pnpm --filter @quad/staff test`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(contracts): demo request body, public form errors and one cookie registry`.

### Task 2: `platform_leads` and `record_demo_request`

**Files:**
- Create:
  - `packages/db/src/schema/platform/platform-leads.ts`;
  - `packages/db/migrations/0022_platform_leads.sql` (generated by drizzle-kit, then the hand-written definer appended, as earlier definer migrations did);
  - `packages/db/test/platform-leads.test.ts` (or beside `definers.test.ts`, following the existing pattern).
- Modify:
  - `packages/db/src/schema/platform/index.ts` and `schema/index.ts`;
  - `packages/db/src/platform-tables.ts` (add `platform_leads`);
  - `packages/db/src/definers.ts` (`recordDemoRequest`);
  - `docs/spec/04-data-model.md` (columns, in Task 17).

**Behaviour:**
- Columns. Spec 04, plus four that spec 19 needs (OQ1, OQ-T2):
  - `id uuid` (v7, as elsewhere);
  - `kind lead_kind` (`school_demo`, `parent_intro`);
  - `name`, `email citext`, `school_name`;
  - `students_band` (nullable for parent leads), `curriculum` (nullable), `country` (nullable), `city` (nullable, parent), `note` (nullable, at most 1,000);
  - `source lead_source` (default `landing`), `status lead_status` (default `new`);
  - `owner_platform_user_id` (nullable fk), `notes` (text, nullable; the per-note table `platform_lead_notes` is M2), `converted_tenant_id` (nullable fk);
  - `ip_hash`, `user_agent` (at most 400 characters);
  - `created_at`, `updated_at`.
- Indexes:
  - `(email, kind, created_at desc)` for the 24-hour match;
  - `(status, updated_at desc)` for M2's list;
  - `(updated_at)` for retention.
- It is a platform table: no `tenant_id`, no `quad_app` privileges of any kind (table, column or sequence). The M0/M1 platform-table test picks it up from `PLATFORM_TABLES`.
- `record_demo_request(p_kind, p_name, p_email, p_school, p_students, p_curriculum, p_country, p_city, p_note, p_ip_hash, p_user_agent) returns table(lead_id uuid, created boolean)`:
  - `SECURITY DEFINER`, owned by `quad_owner`, `SET search_path = pg_catalog, public`.
  - If a lead with the same `email` and `kind`, `status = 'new'`, was created in the last 24 hours, it updates that row's fields and `updated_at`. Otherwise it inserts.
  - It takes `pg_advisory_xact_lock(hashtext(lower(p_email)))` first, so two concurrent requests from one email give one lead.
  - `REVOKE ALL … FROM PUBLIC`, then `GRANT EXECUTE … TO quad_app`.
- `definers.recordDemoRequest(input)` in `packages/db` is a typed wrapper.
- **D57 (Data):**
  - the extra columns;
  - writes through a definer, not `withPlatform`, because the route is anonymous and public;
  - the advisory lock;
  - retention left to M2's platform job (OQ-T3).

Steps:
- [ ] **Step 1: Write failing tests** (`pnpm test:api`-style DB tests against compose Postgres):
  - `quad_app` cannot select, insert, update or delete `platform_leads`;
  - the definer inserts, and a second call within 24 hours with the same email (another case) updates the same row and returns `created = false`;
  - after 24 hours (set `created_at` back as the owner) it inserts a new row;
  - a parent lead and a school lead from the same email are two rows;
  - two concurrent calls give one row;
  - the function's owner, `search_path` and grants are as above.
- [ ] **Step 2: Run them to see them fail.** Expected: FAIL.
- [ ] **Step 3: Implement**, then run `pnpm db:migrate` locally.
- [ ] **Step 4: Run the checks.** `pnpm --filter @quad/db test && pnpm --filter @quad/db test:api` (or the package's DB test script). Expected: PASS.
- [ ] **Step 5: Commit.** `feat(db): platform_leads and the record_demo_request definer`.

## Phase 2: API

### Task 3: Turnstile verification, configured and testable offline

**Files:**
- Create:
  - `apps/api/src/common/turnstile/{turnstile.ts,cloudflare-turnstile.ts,local-turnstile.ts,turnstile.module.ts}`;
  - `apps/api/test/turnstile/*.test.ts`;
  - `apps/api/test/fakes/turnstile.ts`.
- Modify:
  - `apps/api/src/config.ts` and `apps/api/test/config.test.ts`;
  - `.env.example`;
  - the spec 02 variables table;
  - `apps/api/src/tokens.ts`.

**Behaviour:**
- The interface: `TurnstileVerifier.verify({ token, remoteIp, action }) → { outcome: 'pass' | 'fail' | 'unavailable' }`.
- `CloudflareTurnstile`:
  - POSTs form data (`secret`, `response`, `remoteip`, `idempotency_key` = a random UUID) to siteverify, with a 5 s `AbortSignal.timeout`;
  - gives `pass` only when `success` is true, `hostname === TURNSTILE_EXPECTED_HOSTNAME` and `action === 'demo-request'`;
  - gives `fail` on `success: false` or a mismatch;
  - gives `unavailable` on a network error, timeout, non-2xx or unparsable JSON;
  - logs the Cloudflare `error-codes` and the outcome, never the token.
  - The siteverify URL is a constant, not configurable, so the secret cannot be sent elsewhere.
- `LocalTurnstile` is used only when `APP_ENV=local` and `TURNSTILE_SECRET_KEY` is unset:
  - `pass` for the Cloudflare dummy token `XXXX.DUMMY.TOKEN.XXXX` (what Cloudflare's test site keys produce in the browser);
  - `fail` for `fail`;
  - `unavailable` for `unavailable`.
  - This lets the e2e stack and integration tests run with no network.
- Boot rules (config `superRefine`):
  - outside `local`, `TURNSTILE_SECRET_KEY` and `TURNSTILE_EXPECTED_HOSTNAME` are required;
  - Cloudflare's test secrets (`1x…AA`, `2x…AA`, `3x…AA`) are refused outside `local`;
  - in `local`, setting a real or test secret uses the Cloudflare verifier (for a developer who wants to try the real widget).
- **D57 (Turnstile):**
  - fail closed on `unavailable`;
  - check the hostname and action;
  - the local verifier;
  - test keys local-only.

Steps:
- [ ] **Step 1: Write failing tests.**
  - The Cloudflare verifier against a fake `fetch`: success, `success:false`, wrong hostname, wrong action, timeout (fake timers), 500, bad JSON. Each request posts `remoteip` and an `idempotency_key`, and nothing logs the token.
  - The local verifier's three tokens.
  - Config: production without the secret fails boot, production with `1x0000000000000000000000000000000AA` fails boot, and local without a secret selects `LocalTurnstile`.
- [ ] **Step 2: Run them to see them fail.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the checks.** `pnpm --filter @quad/api test`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(api): Turnstile verification with an offline local verifier`.

### Task 4: `POST /public/demo-requests`

**Files:**
- Create:
  - `apps/api/src/public/demo-requests/{demo-requests.controller.ts,demo-requests.service.ts,demo-requests.module.ts,demo-requests.routes.ts}`;
  - `apps/api/test/public/demo-requests.api.test.ts`.
- Modify:
  - `apps/api/src/app.module.ts`;
  - `apps/api/src/openapi/document.ts`;
  - the generated clients (`pnpm api:client`).

**Behaviour:**
- `@Controller('public/demo-requests')`, with `@Post()`, `@Public()` and `@HttpCode(202)`.
- Rate limits, top to bottom:
  - `@RateLimit({ limit: 5, windowSeconds: 3600 })` per IP (spec 19 and 06);
  - `@RateLimit({ limit: 3, windowSeconds: 86400, key: (req) => normalisedEmail(req.body) })` per email (hashed by the service; OQ4).
- Body: `ZodValidationPipe(DemoRequestBody)`. Invalid input gets 400 `validation` with `fields`.
- Service order:
  1. If the honeypot `website` is non-empty, return. That gives 202 with nothing stored or sent, and the `demo_request_honeypot` counter goes up.
  2. Turnstile `verify({ token, remoteIp: req.ip, action: 'demo-request' })`. `fail` throws 400 `captcha_failed`. `unavailable` throws 503 `captcha_unavailable` and the `demo_request_captcha_unavailable` counter goes up.
  3. `definers.recordDemoRequest(...)`. It maps `kind` `school`/`parent` to `school_demo`/`parent_intro`, sets `ip_hash` to the HMAC of `req.ip`, and cuts `user_agent` to 400 characters.
  4. Queue the two emails (Task 5) with job ids `demo-request.<leadId>.sales` and `demo-request.<leadId>.confirm`. When the lead was updated rather than created, queue only the sales email, so a repeat does not send a second confirmation.
  5. Return 202 with an empty body, whatever `created` was.
- `req.ip` comes from Fastify `trustProxy` with `TRUST_PROXY_HOPS` (exists). The service never reads `X-Forwarded-For` itself.
- OpenAPI: tag `public`, errors `[400, 429, 503]`. Run `pnpm api:client` (TypeScript and Dart; the Dart client may exclude public routes, as the enquiry route does, so check the subset rule).
- **D57 (API):**
  - check order;
  - honeypot answer;
  - 503 on captcha outage;
  - per-email limit;
  - only the sales email on a repeat;
  - the `demo-request-received` job is realised as two `send-email` jobs (OQ-T4).

Steps:
- [ ] **Step 1: Write failing API tests** (Docker, the fake email sink, `LocalTurnstile`):
  - **Happy path (school):** 202, one row with `source=landing`, `status=new`, `kind=school_demo`, an `ip_hash` without the raw IP, and two emails queued.
  - **Happy path (parent):** 202, `kind=parent_intro`, `city` and `note` stored.
  - **Validation:** a bad email or a missing school gets 400 `validation` with `fields`.
  - **Captcha:** `fail` gets 400 `captcha_failed`, and `unavailable` gets 503 `captcha_unavailable`. Neither leaves a row or a job.
  - **Rate limit:** the 6th request in an hour from one IP gets 429 `rate_limited` with `Retry-After` (fixed clock), and the 4th from one email in a day gets 429.
  - **Honeypot:** 202 with no row and no job.
  - **Repeat within 24 h:** byte-identical 202, one row updated, one more sales job and no second confirmation.
  - **"Cross-tenant" for this platform route:** no tenant context is opened (spy on `withTenant`/`withPlatform`), and a body with `tenantId`, `school_id` or similar extra keys is refused by the strict schema.
  - **Permission-denied equivalent:** the route needs no session, and a request with a staff session behaves identically (no tenant leaks into the lead).
- [ ] **Step 2: Run them to see them fail.** Expected: FAIL.
- [ ] **Step 3: Implement.** Run `quad-api-endpoint`'s checklist.
- [ ] **Step 4: Run the checks.** `pnpm --filter @quad/api test && pnpm --filter @quad/api test:api -- demo-requests && pnpm codegen:check`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(api): demo requests with Turnstile, rate limits and a honeypot`.

### Task 5: The sales email and the requester's confirmation

**Files:**
- Create:
  - `apps/api/src/common/delivery/templates/{demo-request-sales.ts,demo-request-confirmation.ts}`;
  - `apps/api/test/delivery/demo-request-emails.test.ts`.
- Modify:
  - `apps/api/src/common/delivery/templates/index.ts`;
  - `packages/contracts/i18n/en.json` (`email.demoRequest*`);
  - `apps/api/src/config.ts` (`SALES_INBOX` required outside local; the console origin for the link);
  - `.env.example` (local default `SALES_INBOX=sales@quad.local`, which goes to Mailpit).

**Behaviour:**
- **Lead notification ("sales") email.** Sender "Quad", to `SALES_INBOX` (`support@quad-edu.com` in production, OQ2), with Reply-To the requester. Subject "Demo request: {school}" or "From a parent: {school}". A parent request's first line is "From a parent: Quad's team follows up with the school. Nothing has been sent to the school." (OQ1).
- **Nothing is emailed to the school** for a parent request (OQ1). The service has no code path that sends to an address derived from the school name, and a test pins it.
  - Body: one "Label: value" line per filled field. Values are escaped by the template renderer and are plain text, not HTML.
  - Then "Open in the console" linking to `{CONSOLE_ORIGIN}/leads/{leadId}`. The link 404s until M2, so the line says "(the Leads view arrives with the console)" until M2 removes it, or the link is left out until M2 (OQ-T5).
- **Confirmation.** Sender "Quad", to the requester. A fixed text with no requester-typed values:
  - school: "Thanks for asking for a demo of Quad. We'll email you within one working day to find a time.";
  - parent: "Thanks for telling us about your child's school. Our team will get in touch with the school; we never contact other families." (OQ1).
  - The footer names `support@quad-edu.com` and links `/legal/privacy`.
- The suppression list (`email_suppressions`) applies as for every send, so a bounced address is not mailed again.
- **D57:** the template ids, no echo in the confirmation, and Reply-To on the sales email.

Steps:
- [ ] **Step 1: Write failing tests.**
  - Both templates render with no unfilled ICU arguments.
  - The confirmation contains none of the request's name, school or note (property test with random strings).
  - The sales email lists every field and escapes `<script>`; a parent request is labelled "From a parent".
  - A parent request queues exactly two jobs, to `SALES_INBOX` and to the requester, and none to any other address.
  - The SMTP adapter delivers both to Mailpit (api test).
- [ ] **Step 2: Run them to see them fail.** Expected: FAIL.
- [ ] **Step 3: Implement**, then `pnpm i18n:build`.
- [ ] **Step 4: Run the checks.** `pnpm --filter @quad/api test && pnpm --filter @quad/api test:api -- delivery`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(api): sales notification and requester confirmation for demo requests`.

## Phase 3: Web, the build split and the live landing

### Task 6: Keep the live code out of the pre-launch export

**Files:**
- Create:
  - `apps/staff/src/app/(public)/_live/index.ts` (the public surface: `LiveSignIn`, `SignedInHint`, `submitDemoRequest`, `TurnstileField`);
  - `apps/staff/site-export/prelaunch/index.ts` (stubs with the same exports: `LiveSignIn` and `SignedInHint` render `null`, and `submitDemoRequest` and `TurnstileField` throw if ever called).
- Modify:
  - `apps/staff/site-export/next.config.ts` (a webpack `resolve.alias` that maps the `_live` module to the stub);
  - `apps/staff/scripts/build-export.mjs` (`checkExport` scans);
  - `apps/staff/test/build-export.test.ts`;
  - `apps/staff/src/app/(public)/_components/Footer.tsx` (the footer's Sign in becomes a `SignInEntry`, so it opens the coming-soon note in the export).

**Behaviour:**
- Every landing component that needs the API imports only from `(public)/_live`, and nothing else in `(public)` imports `@quad/client`, `@tanstack/react-query`, `(auth)` or `@/lib/api`. An ESLint `no-restricted-imports` override for `src/app/(public)/**`, except `_live/**`, enforces it, with a rule test.
- In the export the alias replaces `_live` before compilation, so its graph (SignInFlow, the API client, Turnstile) is never bundled.
- `checkExport(dir)` also fails on:
  - a `p` or `.well-known` folder;
  - any `.html`, `.js` or `.txt` file under `dir` that contains `/api/v1/`, `challenges.cloudflare.com`, `data-signin-dialog` or `href="/sign-in`;
  - a `sitemap.xml` containing `/sign-in`.
- `REQUIRED` gains `legal/dpa.html`, `legal/cookies.html` and `og/landing.png`. Tasks 10 and 12 create them, so add each entry in the task that creates the file. This task only adds the scans.
- The existing `site-export/next.config.ts` refusal (build only with the flag `true`) stays.
- **D57 (Build split):**
  - the `_live` boundary;
  - the alias;
  - the scans;
  - the footer fix.

Steps:
- [ ] **Step 0: Fix the live footer bug first, in its own commit** (owner: it 404s on quad-edu.com today).
  - Test first: `Footer.test.tsx` renders the footer with `prelaunch` and expects Sign in to be a `SignInEntry` button with `aria-haspopup="dialog"` and no `href="/app"`; an `e2e:export` check clicks the footer's Sign in and sees the coming-soon note.
  - Change only `Footer.tsx` (Sign in becomes a `SignInEntry`); `pnpm --filter @quad/staff test && pnpm --filter @quad/staff build:export && pnpm --filter @quad/staff e2e:export`.
  - Commit `fix(staff): footer Sign in opens the coming-soon note on the pre-launch site`. It is safe to merge to `main` alone, so the live site is fixed before the rest of M1b.
- [ ] **Step 1: Write failing tests.**
  - `checkExport` on fixture folders: one holding a chunk with `/api/v1/public/demo-requests`, one with `challenges.cloudflare.com`, one with `p/index.html`, one with a sitemap listing `/sign-in`. Each is refused with a clear message, and a clean fixture passes.
  - A lint rule test refuses `import … from '@quad/client'` in `(public)/_components/X.tsx` and allows it in `(public)/_live/X.tsx`.
- [ ] **Step 2: Run them to see them fail.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the checks.** `pnpm --filter @quad/staff test && pnpm --filter @quad/staff build:export && pnpm --filter @quad/staff e2e:export`. Expected: PASS; the export's landing looks unchanged (compare with `docs/screenshots/landing/`).
- [ ] **Step 5: Commit.** `build(staff): keep the live landing code out of the pre-launch export`.

### Task 7: The sign-in dialog on the landing page

**Files:**
- Create:
  - `apps/staff/src/app/(public)/_live/SignInDialog.tsx`;
  - `apps/staff/src/app/(public)/_live/LiveSignIn.tsx` (the client entry that loads the dialog on demand);
  - `apps/staff/src/app/(public)/_live/SignInDialog.test.tsx`.
- Modify:
  - `apps/staff/src/app/(public)/_components/SignInEntry.tsx` (the not-pre-launch branch renders `LiveSignIn` instead of the `/app` link; the `TODO(M1b)` goes);
  - `TopBar.tsx`, `PublicMenu.tsx`, `Hero.tsx` and `Footer.tsx` only if their props change;
  - `packages/contracts/i18n/en.json` (`public.signInDialog.*`: "Parents: use the Quad app", the close label);
  - possibly `(auth)/sign-in/_components/SignInFlow.tsx`, only to accept an optional `heading` id for `aria-labelledby`. Search with `quad-reuse` first; do not fork the flow.

**Behaviour:**
- Every Sign in entry (top bar, menu, "Sign in to your school", footer) is a button with `aria-haspopup="dialog"`.
  - The first click loads the `SignInDialog` chunk (`next/dynamic`, `ssr: false`) and opens it with `showModal()`.
  - Opening `/#signin` (on load, or on `hashchange`) does the same.
  - Closing it with Escape, the close button or the backdrop returns focus to the opener (or to the top bar Sign in for `#signin`), and removes `#signin` from the address with `history.replaceState`.
- The dialog is a `<dialog data-signin-dialog>` styled as the prototype's `dialog.si`: `site-sheet-bg`, 28 px radius, the `site-backdrop` blur, the Quad mark with "quad-edu.com" above.
- Inside it, `<Providers>` (QueryClient, the client strings, as the `(auth)` layout does) wraps the M1 `SignInFlow` with:
  - `next="/app"`;
  - `lastSchool` from `quad_last_school`, read in the browser through `lastSchoolFrom`;
  - `onOpen` doing a full page load.
  - The flow's steps, API calls, errors and copy are the M1 ones, unchanged: email, password, two-step, set-up, recovery codes, Choose a school, forgot password, no school and "Opening {school}…".
- Under the email step, the line "Parents: use the Quad app." with the `AppBadges` (coming soon, no store links). The parent view never shows Sign in (spec 19), so the dialog is opened only from school-view entries.
- The prototype's demo hints ("Try prishan.maduka@…") are prototype-only and are not carried over.
- Analytics: `track('sign_in_opened')` on open (Task 13 provides `track`; until then a no-op import). It sends nothing unless the visitor has accepted analytics.
- **D57 (Sign-in dialog):**
  - the lazy chunk;
  - reusing `SignInFlow` with app tokens inside the site sheet (OQ-T1);
  - `#signin` handling;
  - the parents line.

Steps:
- [ ] **Step 1: Write failing tests** (Vitest and Testing Library, with the `@quad/config/vitest/fake-api`):
  - clicking Sign in opens a modal dialog labelled by its heading;
  - email then password calls `POST /auth/password`;
  - `next: done` shows "Opening {school}…" and calls `onOpen('/app')`;
  - `choose_school` lists the schools;
  - Escape closes it and focus returns to the opener;
  - `#signin` opens it on mount;
  - the parent line and badges are present, with no store `href`;
  - with `prelaunch` the coming-soon note still opens instead (regression).
- [ ] **Step 2: Run them to see them fail.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the checks.**
  - `pnpm --filter @quad/staff test && pnpm --filter @quad/staff build` and check the landing route's First Load JS in the build output: the dialog chunk is separate, and the route stays under 150 KB.
  - `pnpm --filter @quad/staff build:export && pnpm --filter @quad/staff e2e:export`.
  - Expected: PASS.
- [ ] **Step 5: Commit.** `feat(staff): sign in from a dialog on the landing page`.

### Task 8: Open {school} for a signed-in visitor

**Files:**
- Create: `apps/staff/src/app/(public)/_live/SignedInHint.tsx` and `.test.tsx`.
- Modify:
  - `SignInEntry.tsx` (receives the hint state);
  - `en.json` (`public.openSchool`: "Open {school}").

**Behaviour:**
- The landing page stays static. A small client island, inside `LiveSignIn`'s context provider at the top of the landing, runs once after hydration:
  - if the readable CSRF cookie (`quad_csrf` / `__Host-quad_csrf`, from `QUAD_COOKIES`) is present, it calls `fetch('/api/v1/me', { credentials: 'same-origin' })`;
  - on 200 it parses the answer with the `Me` contract and switches every school-view Sign in entry to a link **Open {school.name}** → `/app`;
  - on 401 or 403, an error or no cookie, nothing changes.
  - No TanStack Query and no `@quad/client` in the main landing chunk: a plain `fetch` and a Zod parse of the slice it needs.
- A support session or a role preview is still a signed-in visitor, so it shows Open {school}. The API decides what `/app` shows.
- The hint never reads a school from `quad_last_school`. That cookie still only says "Welcome back" inside the sign-in flow.
- **D57 (Sign-in dialog):** the CSRF-cookie gate (it saves a request for every anonymous visitor) and `GET /me` as the authority.

Steps:
- [ ] **Step 1: Write failing tests.**
  - No cookie: no fetch.
  - Cookie with 200: every school-view entry reads "Open Greenfield International School" and links `/app`.
  - Cookie with 401: Sign in stays.
  - A `/me` answer that fails the schema leaves Sign in.
  - The parent view shows no Open link (it has no Sign in).
- [ ] **Step 2: Run them to see them fail.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the checks.** `pnpm --filter @quad/staff test`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(staff): show Open {school} on the landing page when signed in`.

### Task 9: Demo forms send to the endpoint, with Turnstile

**Files:**
- Create:
  - `apps/staff/src/app/(public)/_live/{submitDemoRequest.ts,TurnstileField.tsx,turnstile-loader.ts}` with tests.
- Modify:
  - `apps/staff/src/app/(public)/_components/DemoForm.tsx` and `.test.tsx`;
  - `Demo.tsx`;
  - `_lib/public-labels.ts`;
  - `en.json` (`public.demo.sending`, `public.demo.thanks`, `public.demo.thanksParent`, the error copy from Task 1).

**Behaviour:**
- `DemoForm` takes `mode: 'mailto' | 'endpoint'`. `Demo.tsx` passes `mailto` when pre-launch and `endpoint` otherwise. The `mailto` path is unchanged.
- In `endpoint` mode:
  - **Turnstile.** On the first focus inside the form, `TurnstileField` loads Turnstile's script once (`render=explicit`) and renders an invisible widget with `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `action: 'demo-request'`, `appearance: 'interaction-only'` and the theme following `data-theme`.
    - When the site key is unset in a local build, it renders nothing and supplies the dummy token `XXXX.DUMMY.TOKEN.XXXX`, which the local verifier accepts (Task 3). The e2e stack therefore needs no network.
    - A staging or production web build without the site key fails at build: `parseWebPublicEnv` requires `NEXT_PUBLIC_TURNSTILE_SITE_KEY` when `NEXT_PUBLIC_APP_ENV` is not `local` and the flag is off.
  - **Honeypot.** A visually hidden `website` input (`tabIndex=-1`, `autocomplete="off"`, `aria-hidden`, the label "Leave this empty") sent as is.
  - **Submit.**
    - The client check, then `POST /api/v1/public/demo-requests` (plain `fetch`, JSON, the `DemoRequestBody` shape), with the button showing "Sending…" and disabled (`aria-busy`).
    - **202:** the form is replaced by "Thank you. We'll email you within one working day to find a time." (school) or "Thank you. We'll get in touch with your child's school." (parent), `role="status"`, with **Send another**. Then `track('demo_requested')` for the school form or `track('parent_request_sent')` for the parent form (no parameters, so no form value can reach Google).
    - **400 `validation`:** the fields are marked from `fields`, with the same messages as the client check.
    - **400 `captcha_failed`:** the message, and the widget resets.
    - **429:** the rate-limit message.
    - **503**, a network error or a timeout: the "couldn't send" message with the `mailto` fallback link (the same `buildRequestMailto`), so the visitor never loses the request.
- The privacy line under the form becomes "We'll only use this to arrange a walkthrough. Protected by Cloudflare Turnstile; see our privacy policy." (link `/legal/privacy#website`).
- **D57 (Turnstile, web):**
  - load on first focus;
  - the local dummy token;
  - the build rule;
  - the `mailto` fallback on failure.

Steps:
- [ ] **Step 1: Write failing tests** (fake `fetch`, fake `turnstile` global):
  - a valid school form posts `kind: 'school'` with the token and the honeypot, then shows the thank-you;
  - the parent form posts `kind: 'parent'`;
  - each error code shows its copy, and 503 shows the `mailto` fallback link with the encoded request;
  - the script is not requested before focus;
  - `mailto` mode is unchanged (the existing tests stay green);
  - no form value reaches `track`.
- [ ] **Step 2: Run them to see them fail.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the checks.** `pnpm --filter @quad/staff test && pnpm --filter @quad/contracts test && pnpm --filter @quad/staff build:export && pnpm --filter @quad/staff e2e:export`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(staff): send demo requests to Quad with Turnstile`.

## Phase 4: Pages

### Task 10: The DPA and Cookies pages, the privacy update and the cookie audit

**Files:**
- Create:
  - `apps/staff/content/legal/{dpa.tsx,cookies.tsx}`;
  - `apps/staff/src/app/(public)/legal/{dpa,cookies}/page.tsx`;
  - `apps/staff/site-export/app/(public)/legal/{dpa,cookies}/page.tsx` (re-exports);
  - `apps/staff/e2e/cookie-audit.spec.ts`.
- Modify:
  - `content/legal/privacy.tsx` (version 0.3);
  - `content/legal/subprocessors.tsx` (the Plausible card is replaced by Google Analytics);
  - `_lib/public-pages.ts`;
  - `Footer.tsx` and `Footer.test.tsx` (Legal card: Privacy, Terms, DPA, Cookies);
  - `scripts/build-export.mjs` `REQUIRED`;
  - `e2e/public-pages.spec.ts`.

**Behaviour:**
- **`/legal/dpa`.** An `ArticleContent` (D45 option A), version 0.1, with:
  - the "In short" card (six points);
  - sections: who is who (the school is the controller, Quad the processor); processing instructions; confidentiality of staff; security measures (linking `/security`); sub-processors (linking `/legal/privacy#subprocessors`, 30 days' notice of a change, the right to object); help with rights requests; breach notice within 72 hours; international transfers (residency in `ap-south-1`, D21); deletion and return at the end of the contract (backups age out within 35 days); audits and information; governing law from `company.ts`; contact `support@quad-edu.com`.
  - Sri Lanka PDPA and GDPR-style clauses for EU/UK schools, as spec 19 says.
  - A visible note at the top, "Draft, version 0.1: this needs legal review before launch", and a source comment saying the same, as on the terms (owner, OQ6).
  - It says only what the spec makes true (D41): no certifications, and the penetration test is "planned".
- **`/legal/cookies`.** Version 0.1. The tables are rendered from `QUAD_COOKIES` (Task 1), so the page cannot drift from the code. It has:
  - **Strictly necessary** (no consent needed): name, purpose, how long, and set on `quad-edu.com` or `console.quad-edu.com`;
  - browser storage (`quad-theme`, `quad-site-view`, and `quad-cookie-consent`, which remembers your cookie choice for 12 months);
  - **Analytics, only if you accept**: `_ga` (tells visits apart with a random id; 13 months) and `_ga_<id>` (keeps the state of the current visit; 13 months), set by Google Analytics on the public website only, never in the Quad apps. It says what Google receives (pages viewed, device and browser, approximate location from the IP address, which Google does not store), that Google signals and ads personalisation are off, and that Google keeps the data for 2 months (the minimum);
  - "Cookie settings" (a button that reopens the banner, Task 13) and how to withdraw: "Choose Reject in Cookie settings; we delete the analytics cookies at once.";
  - Turnstile: Cloudflare runs the check in its own frame on `challenges.cloudflare.com`, and the page states what the cookie audit observed (OQ-T6);
  - No advertising cookies.
  - Plausible is not mentioned anywhere.
- **Privacy 0.3.**
  - The "Website and demo requests" text covers both modes truthfully: "the form sends your request to us (before launch, it opened an email instead)", and Turnstile named as checking for bots.
  - Parent requests (OQ1): "When you ask us to tell your school about Quad, our team gets in touch with the school. We don't email the school automatically, and we never contact other families."
  - Website analytics replaces the Plausible paragraph: "If you accept analytics cookies, we use Google Analytics to count visits to this website. We don't send your name or email to Google, and you can change your choice at any time in Cookie settings." Legal basis: consent.
  - "Companies that handle data for us" (D44): the Plausible card is replaced by **Google Analytics** (Google Ireland Limited for visitors in the EEA and UK, Google LLC elsewhere; purpose "Website visit counts, only if you accept analytics cookies"; data "Cookie id, pages viewed, device and browser, approximate location"; location "United States and global"). It is listed under Quad as controller for site visitors, not as a processor of school data.
  - The Cookies section is shortened to a summary that links `/legal/cookies`. It stops calling the theme a `quad_theme` cookie, because it is browser storage, `quad-theme`.
  - The `updated` date and version move.
- **Footer.** The Legal card gets DPA, Cookies and, when a Measurement ID is set, **Cookie settings** (a button, Task 13 wires it), as spec 19's footer row anticipates. The Status link stays out until `status.quad-edu.com` exists.
- **Cookie audit (e2e, live build, e2e stack).** Visit `/`, open the sign-in dialog, sign in as the seeded admin (`000000`), open `/app`, sign out, and submit a demo form. Then:
  - every cookie in `context.cookies()` must be named in `QUAD_COOKIES`;
  - every `localStorage` key on `quad-edu.com` must be listed (Turnstile's iframe storage is on Cloudflare's origin and is not ours);
  - no cookie of category `analytics` is present (the audit runs with no Measurement ID; the consent spec in Task 13 covers the fake ID).
- **D57 (Pages):**
  - DPA and Cookies;
  - the Cookies page rendered from the registry;
  - privacy 0.3;
  - the spec 19 cookie row corrected (`quad-theme` is storage, `quad_trusted` is added, and the GA cookies and consent key are listed as consent-based);
  - Google Analytics replaces Plausible in the privacy policy's sub-processor cards.

Steps:
- [ ] **Step 1: Write failing tests.**
  - `ArticlePage` unit tests for both pages: one `<h1>`, "Last updated" and a version, six "In short" points, and self-linking headings.
  - The cookies page lists every `QUAD_COOKIES` entry, with `_ga` and `_ga_<id>` under "only if you accept".
  - The privacy policy names Google Analytics with Google Ireland Limited and Google LLC, and no page or content file contains "Plausible".
  - The DPA shows "needs legal review before launch".
  - The footer links all four legal pages.
  - `public-pages.spec.ts` covers both pages (title, canonical, 390 px, axe, light and dark).
  - The cookie audit spec.
  - `checkExport` requires the two files.
- [ ] **Step 2: Run them to see them fail.** Expected: FAIL.
- [ ] **Step 3: Implement.** Write the content in plain English and run it past `company.ts` (no new facts outside it).
- [ ] **Step 4: Run the checks.** `pnpm --filter @quad/staff test && pnpm --filter @quad/staff e2e -- public-pages cookie-audit && pnpm --filter @quad/staff build:export && pnpm --filter @quad/staff e2e:export`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(staff): data processing agreement and cookie notice pages`.

### Task 11: `/p/*` "Get the Quad app" and the app-link files

**Files:**
- Create:
  - `apps/staff/src/app/(public)/p/[[...path]]/page.tsx`;
  - `apps/staff/src/app/.well-known/apple-app-site-association/route.ts`;
  - `apps/staff/src/app/.well-known/assetlinks.json/route.ts`;
  - `apps/staff/src/lib/app-links.ts` and `.test.ts`;
  - `apps/staff/e2e/app-links.spec.ts`.
- Modify:
  - `apps/staff/src/middleware.ts` (`/p/` gets `no-referrer` and `noindex`, like `TOKEN_PAGE`);
  - `packages/contracts/src/web-env.ts` (server env: `APPLE_TEAM_ID`, `ANDROID_APP_CERT_SHA256`);
  - `.env.example` and spec 02;
  - `en.json` (`public.getApp.*`).

**Behaviour:**
- **`/p/<anything>`.** One statically rendered page (`dynamic = 'force-static'`, the same HTML for every path). It never reads `params`, so no token reaches the HTML, logs or caches keyed by content. It uses the public layout's header (logo home) and shows:
  - "Get the Quad app";
  - "This link opens in the Quad app for parents. The app isn't in the App Store or Google Play yet. When your school joins Quad, it will send you an invite to download it.";
  - the coming-soon `AppBadges`;
  - "Staff? Sign in at quad-edu.com" (a link to `/#signin`).
  - When the stores go live, the badges become store links (a later milestone).
  - Metadata: `robots: noindex`, no canonical, and no cookie banner or Google tag (Task 13 skips `/p/`).
- **`/.well-known/apple-app-site-association`.** `application/json`:
  - `{ applinks: { details: [{ appIDs: ["<APPLE_TEAM_ID>.com.quadedu.parent"], components: [{ "/": "/p/*" }] }] } }`;
  - plus, per flavour, `.dev` and `.staging` only when `APP_ENV` is not production.
- **`/.well-known/assetlinks.json`.**
  - `[{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: "com.quadedu.parent", sha256_cert_fingerprints: [<ANDROID_APP_CERT_SHA256>] } }]`.
  - Android App Links match by path in the app's manifest, not in this file. The `/p/*`-only rule for Android is the parent app's intent filter (`android:pathPrefix="/p/"`). The Flutter task that wires deep links owns that, and this task adds a note to spec 09.
- Both answer 404 when their variable is unset (OQ5). Both are dynamic at request time (one image serves every environment). Neither is in the export.
- `app-links.ts` builds both documents as pure functions.
- **D57 (Pages):**
  - the static `/p/*` page that never reads its path;
  - the app-link variables;
  - Android path scoping lives in the manifest.

Steps:
- [ ] **Step 1: Write failing tests.**
  - The AASA document covers only `/p/*` and never `/app`, `/sign-in` or `/`.
  - The assetlinks shape.
  - 404 when the variables are unset.
  - e2e: `/p/invite/SECRET123` shows the page, its HTML does not contain `SECRET123`, the response has `referrer-policy: no-referrer` and `x-robots-tag` containing `noindex`, and no `googletagmanager` script or cookie banner is present (with the fake Measurement ID).
  - `/.well-known/apple-app-site-association` is `application/json`.
- [ ] **Step 2: Run them to see them fail.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the checks.** `pnpm --filter @quad/staff test && pnpm --filter @quad/staff e2e -- app-links && pnpm --filter @quad/staff build:export`. Expected: PASS; the export has no `p/` or `.well-known/`.
- [ ] **Step 5: Commit.** `feat(staff): Get the Quad app page and app-link files for /p/*`.

### Task 12: SEO: OG image, social cards, JSON-LD, robots and sitemap

**Files:**
- Create:
  - `apps/staff/src/app/og/landing.png/route.tsx` (`ImageResponse`, `dynamic = 'force-static'`);
  - `apps/staff/site-export/app/og/landing.png/route.tsx` (re-export);
  - `apps/staff/src/app/(public)/_lib/json-ld.ts` and `.test.ts`;
  - `apps/staff/src/app/robots.txt/route.ts`.
- Modify:
  - `_lib/page-meta.ts` (`og:image`, `twitter:card=summary_large_image`);
  - `(public)/page.tsx` (the JSON-LD `<script type="application/ld+json">`);
  - `_lib/public-pages.ts` (`/sign-in` only when not pre-launch);
  - `scripts/build-export.mjs` `REQUIRED` (`og/landing.png`);
  - the `e2e/landing.spec.ts` SEO checks.

**Behaviour:**
- **`/og/landing.png`.** 1200 × 630, built once at build time from the hero in the light theme:
  - the navy ground, the Quad logo, "Every child has a circle." with the lime pill on "circle", and Maya's face with four people of her circle drawn by the same `faceMarkup` as an SVG `<img>`;
  - colours resolved from `publicSite.light` (the token source; no hex in the route);
  - Bricolage Grotesque read from `(public)/_fonts/`.
  - The export writes it as a file.
  - If satori cannot draw some avatar detail (it supports a subset of SVG and CSS), simplify only the OG drawing and say so in D57.
- **Metadata.** `og:image` (absolute URL, width, height and alt text) on every public page, and `twitter:card=summary_large_image`. The title stays "Quad – School management built around the child" and the description stays at 155 characters or fewer (a unit test).
- **JSON-LD.**
  - `Organization`: name, logo URL, and `contactPoint` with `support@quad-edu.com`. Only confirmed `company.ts` fields; `unconfirmedFields()` are left out.
  - `SoftwareApplication`: `applicationCategory: 'EducationalApplication'`, `operatingSystem: 'Web, iOS, Android'`, and no offers or ratings (D41: no claims).
  - Rendered with `JSON.stringify` escaped for `</script>`.
- **`robots.txt` in the live app.** A route handler that reads `APP_ENV` at request time:
  - in `production`, spec 19's rules (allow `/` and `/legal/`; disallow `/app/`, `/api/`, `/p/`) and the sitemap line;
  - otherwise `Disallow: /`.
  - The export keeps `pages-files/robots.txt`.
- **Sitemap.** `PUBLIC_PATHS` adds `/legal/dpa` and `/legal/cookies` (Task 10), and `/sign-in` only when not pre-launch. `checkExport` (Task 6) proves the export's sitemap has no `/sign-in`.
- The `www` redirect is an edge rule (CloudFront; GitHub Pages does it from `CNAME`). It is recorded in infra README (Task 17), not built here.
- **D57 (SEO and analytics):** the OG image route, the JSON-LD fields and the runtime robots.

Steps:
- [ ] **Step 1: Write failing tests.**
  - JSON-LD has both types, no "to be confirmed" text and no `</script>`.
  - The description has 155 characters or fewer.
  - Robots: production gives the rules and other environments give `Disallow: /`.
  - The sitemap lists `/sign-in` only without the flag.
  - e2e: `og:image` resolves to a 1200 × 630 PNG, there is one canonical per page, and `twitter:card` is `summary_large_image`.
- [ ] **Step 2: Run them to see them fail.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the checks.** `pnpm --filter @quad/staff test && pnpm --filter @quad/staff e2e -- landing && pnpm --filter @quad/staff build:export && pnpm --filter @quad/staff e2e:export`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(staff): social image, structured data, robots and sitemap for the public site`.

### Task 13: Google Analytics (GA4) behind a cookie consent banner

The owner chose GA4 over Plausible (OQ3), knowing it sets cookies and needs a banner. The rule is consent first: before Accept, nothing from Google loads and no request goes to Google. The simplest compliant shape is used: Consent Mode v2 defaults all `denied`, and `gtag.js` is injected only after Accept. Everything is client-only, so it works the same on the GitHub Pages export and the live site.

**Files:**
- Create:
  - `apps/staff/src/app/(public)/_components/consent/{CookieBanner.tsx,CookieSettingsButton.tsx,ConsentProvider.tsx}` and tests;
  - `apps/staff/src/app/(public)/_lib/consent.ts` and `.test.ts` (read and write the stored choice);
  - `apps/staff/src/app/(public)/_lib/google-analytics.ts` and `.test.ts` (consent defaults, loading the tag, page views, withdrawal);
  - `apps/staff/src/app/(public)/_lib/track.ts` and `.test.ts`;
  - `apps/staff/src/app/(public)/_components/Analytics.tsx`;
  - `apps/staff/src/app/(public)/_components/SectionViewed.tsx`;
  - `apps/staff/e2e/analytics-consent.spec.ts`.
- Modify:
  - `(public)/layout.tsx` (renders `ConsentProvider`, `CookieBanner` and `Analytics`, except under `/p/`: the `/p` page passes `analytics={false}` through a nested layout, or `/p` gets its own route group `(public-noindex)`; pick the one with fewer moving parts);
  - `Footer.tsx` (the **Cookie settings** button in the Legal card when an ID is set) and `Footer.test.tsx`;
  - `Circle.tsx` and `Wellbeing.tsx` (wrap in `SectionViewed`);
  - `packages/contracts/src/web-env.ts` and `web-env.test.ts` (add `NEXT_PUBLIC_GA_MEASUREMENT_ID`; delete `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`);
  - `apps/api/src/config.ts` (delete `PLAUSIBLE_DOMAIN` and the `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` entry in `NOT_READ_BY_THE_API`; add `NEXT_PUBLIC_GA_MEASUREMENT_ID` there) and its parity test;
  - `.env.example` and the spec 02 variables table, in the same commit (parity tests);
  - `.github/workflows/pages.yml` (`NEXT_PUBLIC_GA_MEASUREMENT_ID: ${{ vars.GA_MEASUREMENT_ID }}`; empty means off);
  - `apps/staff/package.json` (`build:export:ga-test`, an export build with `G-TEST000000` into `site-export/out-ga-test`, used only by the consent spec);
  - `packages/contracts/i18n/en.json` (`public.cookies.*`).

**Behaviour:**
- **No ID, nothing.** With `NEXT_PUBLIC_GA_MEASUREMENT_ID` unset there is no banner, no Cookie settings button, no `dataLayer`, no `gtag` and no Google URL in the page. `parseWebPublicEnv` refuses a value that is not `G-` plus 4 to 12 upper-case letters or digits.
- **The stored choice.** `localStorage` key `quad-cookie-consent` (simpler than a cookie on a static site, never sent to a server, and first-party): `{ "v": 1, "analytics": "granted" | "denied", "at": "<ISO date>" }`.
  - No valid value, an older `v`, a date more than 12 months old, or storage that throws: the choice is unknown, the banner shows and analytics stay off.
  - Reads and writes are wrapped in try/catch; when storage is blocked the choice lasts for the page view only.
  - Raising `v` (when the cookie notice changes materially) asks everyone again.
- **The banner.** A non-modal region fixed to the bottom of the viewport (`role="region"`, `aria-label="Cookie choice"`), shown after hydration only when the choice is unknown, on every public page except `/p/`.
  - Copy: "We'd like to use Google Analytics cookies to count visits to this website. They're off unless you accept." with a link "Cookie notice" (`/legal/cookies`).
  - Two buttons of the same size, weight and style, side by side (stacked full width below 420 px): **Accept analytics cookies** and **Reject analytics cookies**. No pre-ticked option, no "close" that counts as consent; the page stays usable with the banner open (it covers no content needed to read the page and has bottom padding reserved only while shown).
  - `site-*` tokens only (light and dark), 390 px with no horizontal scroll, keyboard order: text link, Accept, Reject; visible focus; reduced motion means no slide-in. After a choice, focus moves to `<main>` and a polite status says "Analytics cookies accepted" or "Analytics cookies rejected".
  - **Cookie settings** in the footer (and a button on `/legal/cookies`) reopens the banner with the current choice announced.
- **Consent gating and loading** (`google-analytics.ts`):
  - On every public page with an ID, before anything else, `window.dataLayer` and a `gtag()` stub are defined inline and `gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied', wait_for_update: 500 })` is queued. This makes no request.
  - Only when the stored choice is `granted` (on load, or on Accept): `gtag('consent', 'update', { analytics_storage: 'granted' })` (ads signals stay `denied`), then a `<script async src="https://www.googletagmanager.com/gtag/js?id=…">` is appended once, then `gtag('js', new Date())` and `gtag('config', ID, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false, cookie_domain: 'none', cookie_expires: 33696000, cookie_flags: 'SameSite=Lax;Secure' })`. `cookie_domain: 'none'` keeps the cookies host-only, so they never reach `console.` or `staging.`; `cookie_expires` is 13 months.
  - On **Reject** after an earlier Accept: `gtag('consent', 'update', { analytics_storage: 'denied' })`, `window['ga-disable-<ID>'] = true`, delete `_ga` and every `_ga_*` cookie on the host, store `denied`, then reload the page so no Google code stays in memory.
  - No `next/script` with a Google URL is rendered on the server, so no Google URL is in the static HTML.
- **Page views and PII.** `send_page_view` is off and the GA4 enhanced measurement "page changes based on browser history", "form interactions" and "site search" are turned off in the property (infra README). `Analytics` sends `page_view` itself on each public route change, with `page_location` = origin + pathname (+ `?view=parent` when set), and nothing else from the query string or hash, and `page_title` from the route's metadata. Public pages contain no personal data in paths. Links from public pages to `/app` and `/sign-in`, and the dialog's `onOpen`, are full page loads, so the tag never runs inside the app.
- **Events.** `track(event, params?)` is typed to the spec events, in GA4's snake_case names, and does nothing unless consent is `granted` and `gtag` exists:
  - `sign_in_opened`;
  - `demo_requested` (the school form);
  - `parent_request_sent` (the parent "tell my school" form);
  - `section_viewed` with `{ section: 'circle' | 'wellbeing' }`.
  - Only these shapes compile, so no form value, name or email can be passed.
- **Privacy settings.** IP anonymisation is built into GA4 (it does not log or store IP addresses; nothing to set). Google signals and ads personalisation are off in code (above) and in the property. Data retention is set to the minimum (2 months) in the property. Data sharing settings are all off. These property settings are the owner's steps in infra README (Task 17), with a checkbox list.
- `SectionViewed` uses one `IntersectionObserver` (50 % visible) and fires once per page view.
- **D57 (SEO and analytics):** GA4 chosen by the owner over Plausible, Cloudflare Web Analytics and Umami; consent first (Consent Mode v2 defaults denied, tag injected only after Accept); the `quad-cookie-consent` key and its 12-month expiry; Reject and withdrawal delete the cookies and reload; host-only 13-month cookies; manual page views with a cleaned `page_location`; the typed events; the `/p` exclusion; the budget statement (the banner is in the budget, `gtag.js` is not, because it loads only after Accept); no ID means no Google code.

Steps:
- [ ] **Step 1: Write failing tests.**
  - `consent.ts`: unknown when empty, malformed, older `v`, older than 12 months or when storage throws; round-trips `granted` and `denied`.
  - `google-analytics.ts` (fake `document` and timers): with no ID nothing is defined; with an ID and unknown or `denied` choice no `<script>` is appended and `dataLayer` holds only the denied default; Accept appends exactly one script with the ID and queues `consent update` then `config` with the settings above; Reject after Accept sets `ga-disable-<ID>`, deletes `_ga` and `_ga_X` and reloads.
  - `CookieBanner`: hidden with no ID; shown when unknown; Accept and Reject have the same classes; both are reachable by keyboard; axe has no serious issues; Cookie settings reopens it.
  - `track`: calls `gtag('event', …)` with exactly the event and params only when granted; a type test (`// @ts-expect-error`) refuses `{ email }` and an unknown event.
  - `SectionViewed` fires once.
  - **e2e `analytics-consent.spec.ts`**, on the export built with the fake ID `G-TEST000000` (`build:export:ga-test`), desktop and 390 px, light and dark. It records every request and routes any Google host (`googletagmanager.com`, `google-analytics.com`, `*.google.com`, `doubleclick.net`) to a stub, so it runs offline:
    - first visit: the banner shows, and after load, scrolling, opening the sign-in note and visiting `/about` there is no Google request and no `_ga*` cookie;
    - Reject: still no Google request after reloads; the choice is stored;
    - Accept: exactly one request to `googletagmanager.com/gtag/js?id=G-TEST000000`, after the click and not before;
    - Cookie settings, then Reject: the `_ga*` cookies are gone (the test sets fake `_ga` cookies to check deletion) and after the reload no Google request;
    - `/p/x`: no banner and no Google request even when granted.
  - e2e on the normal (no ID) builds: no banner, no Cookie settings, no Google URL in the HTML or chunks.
- [ ] **Step 2: Run them to see them fail.** Expected: FAIL.
- [ ] **Step 3: Implement.** Remove every Plausible reference in code and config (`rg -i plausible` returns only the plan and the decision log).
- [ ] **Step 4: Run the checks.** `pnpm --filter @quad/contracts test && pnpm --filter @quad/api test && pnpm --filter @quad/staff test && pnpm --filter @quad/staff build:export:ga-test && pnpm --filter @quad/staff e2e -- analytics-consent && NEXT_PUBLIC_GA_MEASUREMENT_ID=G-TEST000000 pnpm --filter @quad/staff build`, then check the route sizes. Expected: PASS; the landing stays under budget with the banner, and no Google URL is in any server-rendered HTML.
- [ ] **Step 5: Commit.** `feat(staff): Google Analytics only after consent, with a cookie banner`.

## Phase 5: Journeys, budget and visuals

### Task 14: Journey 20, the sign-in dialog journeys and the landing specs

**Files:**
- Create:
  - `apps/staff/e2e/journeys/j20-demo-request.spec.ts`;
  - `apps/staff/e2e/journeys/j17b-sign-in-dialog.spec.ts`, or extend `j17` and `j18` to start from the dialog (preferred: spec 17 says "via `/app` → `/sign-in` until M1b's sign-in dialog").
- Modify:
  - `e2e/journeys/j17-sign-in-one-school.spec.ts`, `j18-two-schools.spec.ts`;
  - `e2e/landing.spec.ts` (live-mode assertions);
  - `docs/spec/17-testing-quality.md` (Task 17).

**Behaviour:**
- **J20.** The e2e stack (`LocalTurnstile`, Mailpit).
  - A visitor fills the school form at 1440 and at 390 and submits.
  - The thank-you `status` is shown.
  - A `platform_leads` row exists. Read it as the owner role through the stack's test helper, not as `quad_app`.
  - The sales email arrives in Mailpit with the school name and Reply-To the visitor.
  - The confirmation arrives with no typed text.
  - The parent form does the same with `kind=parent_intro`: the lead is marked as from a parent, the notification goes to `SALES_INBOX`, the parent gets the confirmation, and Mailpit holds no other message (nothing to the school, OQ1).
  - A second submit within the hour from the same IP after five gets the rate-limit message (a separate test with a fresh IP header is not possible in the browser; cover the 429 copy with a routed fake response).
- **J17 and J18.** They start from the landing's **Sign in** dialog:
  - J17: `prishan.maduka@colombo-intl.local`, the password, `000000`, then `/app` with the school's logo.
  - J18: `ruwan.mendis@quad.local`, the picker, then the second school.
  - Then they return to `/` and see **Open {school}**. A `/#signin` deep link opens the dialog.
- **`landing.spec.ts`.**
  - Live projects: Sign in opens the dialog (not a link to `/app`), Escape returns focus, and the demo form posts (routed to a fake 202) and shows the thank-you.
  - Export projects: unchanged (coming-soon note, `mailto`), plus "no request to `/api/` happens while using the page" (a `page.on('request')` assertion), and the footer's Sign in opens the coming-soon note (the Task 6 Step 0 fix).

Steps:
- [ ] **Step 1: Write the journeys and specs.** They fail until the pieces are in.
- [ ] **Step 2: Run them.** `pnpm --filter @quad/staff e2e -- j17 j18 j20 landing && pnpm --filter @quad/staff e2e:export`. Expected: PASS after Tasks 6 to 13.
- [ ] **Step 3: Commit.** `test(e2e): journey 20 and sign-in from the landing dialog`.

### Task 15: Lighthouse budget and the landing visual test

**Files:**
- Create:
  - `apps/staff/e2e/landing-visual.spec.ts` with baselines under `apps/staff/e2e/__screenshots__/` (Playwright's default snapshot folder for the project; follow the repo's existing convention if one exists);
  - `apps/staff/scripts/lighthouse-budget.mjs` and `apps/staff/test/lighthouse-budget.test.ts`.
- Modify:
  - `apps/staff/package.json` (`"lighthouse": "node scripts/lighthouse-budget.mjs"`);
  - `turbo.json` (a `lighthouse` task after `build`);
  - `scripts/verify.mjs` (a step "Landing performance budget" after the e2e step, and its test);
  - `.github/workflows/ci.yml` (run it in `e2e-smoke`).

**Behaviour:**
- **Visual test.** `/` at 1440 and 390, light and dark, school view, plus the parent view at 390 light (built with no Measurement ID, so no banner), and the banner itself at 390 light and dark with the fake ID. Animations off: `reducedMotion: 'reduce'`, the ticker paused, and the hero stage's first frame. It uses `toHaveScreenshot` with a small `maxDiffPixelRatio` (0.01), in Chromium only (fonts are self-hosted, so the render is stable). Baselines are committed. A deliberate change updates them in the same commit, with the reason in the message.
- **Lighthouse.**
  - Run `lighthouse` (Node API) against `next start` of the production build, with Playwright's Chromium (`chromePath` from `chromium.executablePath()`).
  - Mobile preset with simulated 4G throttling, three runs, median.
  - The build under test has the fake Measurement ID `G-TEST000000` and a fresh profile (no stored choice), so the cookie banner is measured (JavaScript, CLS and LCP) and `gtag.js` is not, because it never loads without Accept. The script also fails if any request goes to a Google host during the run. The printed report says "Google Analytics loads only after consent and is outside this budget".
  - Fail when LCP ≥ 2.5 s, CLS ≥ 0.05 or TBT ≥ 200 ms (INP is a field metric; TBT is the lab stand-in, recorded in D57), when the route's JavaScript is ≥ 150 KB gzip (from the network records: every `script` resource the route loads before interaction), or when the bytes before scroll are ≥ 600 KB.
  - It prints each number against its budget.
  - `pnpm verify` gets it as its own step, so a failure names the budget.
- **D57 (Testing):** TBT for INP, median of three, Chromium-only visuals, where the baselines live, and the budget measured with the banner shown and `gtag.js` excluded (it loads only after Accept).

Steps:
- [ ] **Step 1: Write failing tests.** A unit test of the budget checker on a recorded Lighthouse JSON fixture (over and under each budget). `verify.mjs`'s step list includes the new step.
- [ ] **Step 2: Run them to see them fail.** Expected: FAIL.
- [ ] **Step 3: Implement**, then record the baselines with `pnpm --filter @quad/staff e2e -- landing-visual --update-snapshots` and look at every image against `design/landing.html` and `docs/screenshots/landing/`.
- [ ] **Step 4: Run the checks.** `pnpm --filter @quad/staff build && pnpm --filter @quad/staff lighthouse && pnpm --filter @quad/staff e2e -- landing-visual`. Expected: PASS; note the measured numbers in D57.
- [ ] **Step 5: Commit.** `test(staff): Lighthouse budget and visual test for the landing page`.

### Task 16: Gate, screenshots, export check and review

Steps:
- [ ] **Step 1:**
  - `pnpm verify` is green.
  - `pnpm --filter @quad/staff build:export && pnpm --filter @quad/staff e2e:export` is green.
  - The export's landing matches `docs/screenshots/landing/` (no visual change from pre-launch) and has the new DPA and Cookies pages.
- [ ] **Step 2: Screenshots.**
  - `QUAD_SCREENSHOTS=1 pnpm --filter @quad/staff exec playwright test screenshots -g landing`.
  - Add `docs/screenshots/landing/app-signin-1440-light.png`, `app-signin-390-dark.png`, `app-demo-thanks-1440-light.png`, `dpa-1440-light.png`, `cookies-390-dark.png`, `cookie-banner-390-light.png`, `cookie-banner-390-dark.png` and `p-fallback-390-light.png`.
- [ ] **Step 3: Review.** Run `quad-review` on the whole M1b diff, then `security-review` (focus: the demo endpoint, the definer, the `/p` page, the export scan and the consent gating). Fix findings in their own commits.
- [ ] **Step 4: Commit.** `docs(screenshots): M1b sign-in dialog, demo thank-you, DPA, cookies, cookie banner and /p pages`.

## Phase 6: Docs

### Task 17: Decision log, spec edits, infra README and progress

**Files:** `docs/spec/02-architecture.md`, `04-data-model.md`, `05-auth-tenancy-rbac.md`, `06-api-and-events.md`, `09-parent-app.md`, `16-security-privacy.md`, `17-testing-quality.md`, `18-delivery-plan.md`, `19-public-site.md`, `infra/README.md`.

**Behaviour:**
- **D57** is finalised (see below), and every task's items are checked against the code.
- **Spec 19.**
  - Demo requests: parent requests (OQ1) are saved in `platform_leads` marked as from a parent (`kind=parent_intro`), Quad's team follows up with the school, the parent gets a confirmation, and nothing is emailed to the school (replace "how they are stored and passed on to the school is decided when the endpoint is built"); the parent form row's "Quad passes the request on to the school" becomes "Quad's team gets in touch with the school". The error answers (400 `captcha_failed`, 503 `captcha_unavailable`, 429), the per-email limit, and the notification inbox `support@quad-edu.com` through `SALES_INBOX` (OQ2).
  - Legal pages: the cookie row says browser storage `quad-theme`, `quad-site-view` and `quad-cookie-consent`, adds `quad_trusted`, Turnstile per the audit, and replaces "no tracking cookies, so no consent banner" with "Google Analytics cookies `_ga` and `_ga_<id>` only after the visitor accepts the cookie banner". The DPA row says version 0.1, needs legal review before launch (OQ6).
  - **Analytics** (spec 19 names Plausible and rules out cookies, so it is rewritten): Google Analytics 4, loaded only on public pages, only when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set, and only after Accept on the cookie banner (Consent Mode v2 defaults denied; no request to Google before consent); Google signals and ads personalisation off, retention 2 months, host-only 13-month cookies, no PII in paths or events; events `sign_in_opened`, `demo_requested`, `parent_request_sent`, `section_viewed`. The banner (equal Accept and Reject, `quad-cookie-consent`, Cookie settings in the footer). The sentence "If a cookie-based tool is ever added, a consent banner must ship with it first" is kept as the rule this satisfies.
  - Sub-processors table: the Plausible row becomes **Google Analytics** (Google Ireland Limited / Google LLC; website visit counts, only with consent; cookie id, pages viewed, device, approximate location; United States and global).
  - Performance budget: the banner counts; `gtag.js` loads only after consent and is outside the budget.
  - Pre-launch: the `_live` boundary and the scans.
  - Sign-in: Open {school} via `GET /me`.
  - Footer: DPA and Cookies links, and Cookie settings when analytics is configured.
  - Go-live (OQ7): the pre-launch site with the coming-soon sign-in and the email forms stays on GitHub Pages until AWS hosting is live, then everything switches with `NEXT_PUBLIC_QUAD_PRELAUNCH`.
  - The decision row records that each change to spec 19 here (analytics, banner, cookies, sub-processor, parent requests, inbox) follows the owner's answers of 2026-10-10.
- **Spec 04.** The `platform_leads` columns and the definer in Tenant-less lookups.
- **Spec 06.** The body (`kind`, `turnstileToken`, `website`), the errors, and the `demo-request-received` mapping.
- **Spec 02.** The variables table (drop `PLAUSIBLE_DOMAIN` and `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`; add `NEXT_PUBLIC_GA_MEASUREMENT_ID`; `SALES_INBOX` example `support@quad-edu.com`), and D16's demo-requests entry naming `record_demo_request`.
- **Spec 18.** M1b's Scope line "Plausible analytics behind its variable" becomes "Google Analytics behind its variable and a cookie consent banner (nothing from Google before Accept)".
- **Spec 09.** The Android `pathPrefix="/p/"` rule.
- **Spec 17.** Journeys 17 and 18 start from the dialog, and journey 20's M1b part is marked green.
- **Spec 18 (progress).**
  - Tick M1b in Progress.
  - Remove "and M1b stays unticked" from Built early.
- **`infra/README.md`.**
  - The Turnstile widget (hostnames `quad-edu.com` and `staging.quad-edu.com`), and where the secret and site key go.
  - **Google Analytics (owner's steps):** create a GA4 property and web stream for `quad-edu.com`; put its Measurement ID in the `GA_MEASUREMENT_ID` repository variable (Pages) and the staff build's `NEXT_PUBLIC_GA_MEASUREMENT_ID` (AWS); in the property set data retention to 2 months, turn Google signals off, leave ads personalisation off, turn all data sharing settings off, and in enhanced measurement turn off "page changes based on browser history events", "form interactions" and "site search"; accept Google's data processing terms in the account settings; leave staging without an ID.
  - `SALES_INBOX=support@quad-edu.com` in staging and production (OQ2).
  - The app-link variables.
  - **The go-live switch checklist:** build staff with the flag off; CloudFront serves `/`; set `www` → apex; turn off `pages.yml` and the Pages site; switch DNS from GitHub Pages; check `/robots.txt` and the sitemap in production.

Steps:
- [ ] **Step 1: Write the edits.**
- [ ] **Step 2:** `pnpm format:check` and the spec link check, if one exists. Expected: PASS.
- [ ] **Step 3: Commit.** `docs: M1b decisions, spec updates and progress`.

---

## Open questions and spec gaps

**For the product owner: all decided by the owner on 2026-10-10.** Each answer is recorded in D57 (Task 17) and the spec edits it causes are listed in Task 17.

1. **Parent "tell my school" requests** (spec 19 and D33 left this open). **Decided by the owner on 2026-10-10: the recommendation is accepted.**
   - Saved in the same leads list (`platform_leads`), marked as from a parent (`kind=parent_intro`), so they appear in the console's Leads.
   - Quad's team follows up with the school, and never with the parent's community.
   - The parent gets a confirmation email.
   - Nothing is emailed to the school (Quad has no verified school address, and an automatic email could be abused to spam schools).
   - Where: Tasks 2, 4, 5, 10 (privacy text), 14 (J20 parent case) and 17 (spec 19).
2. **Where new-request (lead notification) emails go.** Spec 19 said `sales@quad-edu.com`, but D42 makes `support@quad-edu.com` the only public address. **Decided by the owner on 2026-10-10:** send them to `support@quad-edu.com`, as a setting (`SALES_INBOX`, required outside local; Mailpit locally). Where: Configuration, Task 5 and Task 17 (spec 02, spec 19, infra README).
3. **Website analytics.** The plan recommended Plausible (no cookies, no banner). **Decided by the owner on 2026-10-10: Google Analytics (GA4).** The owner wanted a free tool and chose GA over Plausible, Cloudflare Web Analytics and Umami, knowing it uses cookies and needs a banner.
   - Consent first: Consent Mode v2 defaults `denied`, and `gtag.js` is injected only after Accept; before that nothing from Google loads and no request goes to Google.
   - Banner: Accept and Reject equally prominent; the choice in `localStorage` `quad-cookie-consent` (12 months); **Cookie settings** in the footer reopens it; 390 px, dark mode, accessible, `site-*` tokens.
   - Privacy settings: IP anonymisation (built into GA4), Google signals off, ads personalisation off, retention 2 months (the minimum), no PII in paths or events.
   - Client-only, so it works on the GitHub Pages export and the live site; the ID is `NEXT_PUBLIC_GA_MEASUREMENT_ID`; no ID, nothing loads. Tests run with no ID and with the fake `G-TEST000000`.
   - Events: `sign_in_opened`, `demo_requested`, `parent_request_sent` (and `section_viewed`).
   - Budget: the banner is tiny and counted; `gtag.js` loads lazily after consent and is outside the budget measurement.
   - Cookies page and privacy policy list `_ga`, `_ga_<id>` and the consent key, and Google (Google Ireland Limited / Google LLC) as a company that handles data for us (D44). Plausible is removed everywhere.
   - Spec 19 named Plausible and ruled out a banner, so Task 17 rewrites its Analytics section, cookie row and sub-processor row, and D57 records the change.
   - Where: Configuration, Tasks 1, 7, 9, 10, 11, 13 (rewritten), 15, 16 and 17.
4. **Limit per email address** (beyond spec 19's 5 per hour per address).
   - **Recommend:** at most 3 requests per email per day, and only one confirmation per lead. This stops someone using the form to flood another person's inbox. (Not asked of the owner separately; kept as planned.)
5. **App-link files need Apple's Team ID and the Android signing fingerprint**, which exist only once the developer accounts and the release key exist.
   - **Recommend:** build the files now and serve them only once those two values are set. Until then `/p/*` links always show the "Get the Quad app" page, which is the right behaviour while the app is not in the stores. (Kept as planned.)
6. **The DPA text.** **Decided by the owner on 2026-10-10:** a plain-English draft, version 0.1, published now and marked "needs legal review before launch" on the page and in the source. Where: Task 10.
7. **When to switch the live site.** **Decided by the owner on 2026-10-10: the recommendation is accepted.** The pre-launch site (coming-soon sign-in and the email forms) stays on GitHub Pages until AWS hosting is live; then everything switches at once with the one setting, `NEXT_PUBLIC_QUAD_PRELAUNCH`. The demo endpoint is never called from GitHub Pages. Where: Task 6, Task 17 (infra README go-live checklist, spec 19).

**Technical (decide in the task, record in D57):**
- **OQ-T1. Dialog styling.** Spec 19 says the dialog uses the public palette, while the M1 `SignInFlow` cards use app tokens.
  - **Recommend:** a site-palette sheet (`site-sheet-*`) with the M1 cards inside, unchanged. After D56 the app tokens are the same navy, cream and lime, so the look matches the prototype within a few shades, and forking the flow would duplicate the M1 logic and its tests.
  - If the visual test shows a clash, add a `tone="site"` prop to the `@quad/ui/auth` card parts rather than a second flow.
- **OQ-T2. Columns spec 04 lacks.**
  - `kind`, `city` and `note` (parent requests) and `updated_at` (spec 19's 24-hour update and 24-month retention both need it).
  - `email` as `citext`, so a repeat is matched without regard to case.
  - **Recommend:** add them in `0022` and update spec 04.
- **OQ-T3. Retention job** (delete leads 24 months after the last update).
  - **Recommend:** M2, as a `worker/platform-jobs/` job with the Leads screens. No lead can be 24 months old before then. Record it in M2's scope.
- **OQ-T4. `demo-request-received`.** Spec 06 names one job.
  - **Recommend:** two `send-email` jobs (sales and confirmation) through the existing `DeliveryService`. A separate job type would need a worker that reads `platform_leads`, which means `withPlatform` in the worker for no gain. Spec 06's job table records the mapping.
- **OQ-T5. The console link in the sales email.** The Leads view is M2.
  - **Recommend:** include `{console}/leads/{id}` from the start and note in D57 that it 404s until M2. M2's Leads route then matches it without changing the template.
- **OQ-T6. Does Turnstile set cookies on our site?** Cloudflare documents that Turnstile runs in its own frame.
  - **Recommend:** the cookie audit (Task 10) decides. If no `quad-edu.com` cookie appears, the Cookies page says "no cookie on our site; Cloudflare's check runs on its own domain", and spec 19's cookie row is corrected.
- **OQ-T7. Captcha outage.**
  - **Recommend:** fail closed (503) with the `mailto` fallback on the page. Spec 19's "202 either way" is read as "new or updated lead, honeypot included", not as accepting unverified requests.
- **OQ-T8. INP in the lab.** Lighthouse lab runs have no INP.
  - **Recommend:** use TBT < 200 ms as the stand-in in CI, and watch real INP later through CrUX or CloudFront RUM once there is traffic (Google Analytics does not report INP by default, and only consenting visitors would be counted).

## Proposed decision-log row

**D57 (2026-10-1x). Public site go-live pieces (M1b).** One row in the D32 style, created in Task 1. Each task appends its items (task number in brackets), and Task 17 finalises it:
- **Product owner's answers (2026-10-10):**
  - parent "tell my school" requests are leads marked as from a parent; Quad's team follows up; the parent gets a confirmation; nothing is emailed to the school (OQ1) [2, 4, 5];
  - lead notifications go to `support@quad-edu.com` through the `SALES_INBOX` setting (OQ2) [5];
  - Google Analytics 4 instead of Plausible (chosen over Plausible, Cloudflare Web Analytics and Umami, as a free tool, knowing it needs cookies and a banner); spec 19's Analytics, cookie and sub-processor rows change accordingly (OQ3) [13, 17];
  - the DPA is a plain-English draft, version 0.1, marked "needs legal review before launch" (OQ6) [10];
  - the pre-launch site stays on GitHub Pages until AWS hosting is live, then switches with `NEXT_PUBLIC_QUAD_PRELAUNCH` (OQ7) [6, 17].
- **Data:**
  - `platform_leads` (migration `0022`) with `kind` (`school_demo`, `parent_intro`), `city`, `note`, `updated_at` and `email citext` beyond spec 04 [2];
  - written only through the definer `record_demo_request` (`quad_owner`, pinned `search_path`, `EXECUTE` to `quad_app`; same email and kind within 24 h while `new` updates the lead; an advisory lock on the email), never `withPlatform`, because the route is anonymous [2];
  - retention to M2's platform job [2].
- **API:**
  - `POST /public/demo-requests` in `src/public/demo-requests` [4];
  - order: per-IP limit (5/h), per-email limit (3/day, OQ4), body, honeypot (202, nothing stored), Turnstile, store, queue [4];
  - identical 202 for new and updated leads [4];
  - 400 `captcha_failed`, 503 `captcha_unavailable` [1, 4];
  - `ip_hash` as an HMAC with an HKDF key from `SESSION_SECRET` [4];
  - two `send-email` jobs for spec 06's `demo-request-received`; a repeat sends only the sales email [4, 5];
  - the confirmation echoes no typed text; the sales email has Reply-To the requester and a console link that works from M2 [5].
- **Turnstile:**
  - `TurnstileVerifier`, with Cloudflare siteverify checking `success`, `hostname` (`TURNSTILE_EXPECTED_HOSTNAME`) and `action` (`demo-request`), and a 5 s timeout [3];
  - fail closed [3];
  - `LocalTurnstile` (the dummy token) when local without a secret; Cloudflare test keys refused outside local [3];
  - the browser widget loaded on first focus, invisible unless challenged; a local build without a site key sends the dummy token; a non-local build requires the site key [9].
- **Build split:**
  - `(public)/_live` is the only public code that may import the API client or `(auth)` (lint rule) [6];
  - the export aliases it to `site-export/prelaunch` stubs [6];
  - `checkExport` refuses `/api/v1/`, `challenges.cloudflare.com`, `data-signin-dialog`, `href="/sign-in`, `p/`, `.well-known/` and a sitemap with `/sign-in` [6];
  - the footer's Sign in is a `SignInEntry`, shipped first as its own fix because it 404s on quad-edu.com today [6].
- **Sign-in dialog:**
  - `next/dynamic` chunk on first click or `#signin`; M1 `SignInFlow` inside a site-sheet `<dialog>` (OQ-T1) [7];
  - the parents line with coming-soon badges [7];
  - Open {school}: gated on the readable CSRF cookie, confirmed by `GET /me`, links `/app` only [8].
- **Pages:**
  - `/legal/dpa` (0.1, marked "needs legal review before launch") and `/legal/cookies` (0.1, rendered from `QUAD_COOKIES` in `packages/contracts`, necessary cookies and storage, then `_ga` and `_ga_<id>` "only if you accept") [10];
  - privacy 0.3: parent requests, analytics by consent, and Google Analytics (Google Ireland Limited / Google LLC) replacing Plausible in "Companies that handle data for us" (D44) [10];
  - the cookie audit journey [10];
  - `/p/*` one static page that never reads its path, `no-referrer`, `noindex`, no analytics [11];
  - `.well-known` files from `APPLE_TEAM_ID` and `ANDROID_APP_CERT_SHA256`, 404 when unset; Android path scoping in the app manifest [11].
- **SEO and analytics:**
  - `/og/landing.png` built with `ImageResponse` from the token source [12];
  - `summary_large_image` [12];
  - JSON-LD `Organization` and `SoftwareApplication` from confirmed company facts only [12];
  - runtime `robots.txt` by `APP_ENV`; sitemap with `/sign-in` only in the live build [12];
  - Google Analytics 4 in the public layout only (not `/app`, `/sign-in`, `/p`), client-only so it also runs on the Pages export, and only when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set [13];
  - consent first: Consent Mode v2 defaults all `denied`, `gtag.js` injected only after Accept, ads signals always `denied`; no Google request or cookie before Accept or after Reject [13];
  - the cookie banner: equal Accept and Reject, choice in `localStorage` `quad-cookie-consent` (`v`, choice, date; re-asked after 12 months), Cookie settings in the footer and on `/legal/cookies`, `site-*` tokens, 390 px, dark mode, accessible [13];
  - withdrawal deletes `_ga`/`_ga_*` and reloads; cookies host-only (`cookie_domain: 'none'`) for 13 months; Google signals and ads personalisation off; retention 2 months; IP anonymisation built into GA4 [13];
  - manual `page_view` with `page_location` cut to origin, path and `view`; typed events `sign_in_opened`, `demo_requested`, `parent_request_sent`, `section_viewed`, with no form values [7, 9, 13];
  - `PLAUSIBLE_DOMAIN` and `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` removed; `NEXT_PUBLIC_GA_MEASUREMENT_ID` added (public, optional, a repository variable for Pages) [13].
- **Testing:**
  - journeys 17 and 18 start from the dialog; journey 20 runs up to the sales email [14];
  - Lighthouse mobile median of three, with TBT for INP, as its own `pnpm verify` step, measured with the cookie banner shown and `gtag.js` outside the budget (it loads only after Accept); Chromium-only visual baselines at 1440 and 390, light and dark [15];
  - the consent spec on an export built with a fake Measurement ID: no Google request before Accept [13];
  - pinned versions of `lighthouse` [15].

## Risks and size

**Size**
- 17 tasks, mid-sized: one migration, one endpoint, about 12 web changes, two pages of legal text, and the cookie banner with consent-gated analytics (Task 13 grew with OQ3).
- Candidates to move out if it runs long, in this order:
  - the OG image (a static PNG from the screenshot script would do for a first cut);
  - the `.well-known` files (useless until the store apps exist);
  - Open {school}.

**Pre-launch regression (highest risk)**
- Every change to `(public)/**`, `src/app/layout.tsx` or `@quad/ui` reaches `quad-edu.com` on the next merge to `main`.
- **Mitigations:**
  - the `_live` alias and the `checkExport` scans (Task 6) land before any live code;
  - every web task runs `build:export` and `e2e:export`;
  - Task 16 compares the export with the reference screenshots.
- A missed `_live` import is a lint error, and a missed string is a scan failure, not a silent leak.

**JavaScript budget**
- The landing is at about 139 KB of 150 KB. The dialog, `@quad/client`, TanStack Query and Turnstile would exceed it if bundled eagerly. Each is lazy by design.
- Open {school} uses plain `fetch` to stay out of the main chunk.
- Measure after Tasks 7, 8, 9 and 13, not only in Task 15. The banner counts; `gtag.js` does not, because it loads only after Accept.

**Turnstile and the network**
- Siteverify and the widget need the internet.
- CI and the e2e stack use `LocalTurnstile` and the dummy token, so the real Cloudflare path is covered only by unit tests with a fake `fetch`. The first staging deploy must try a real submit (infra README checklist).
- Hostname checks fail if the widget's hostnames are set up wrongly in Cloudflare. That is the owner's step in infra README.

**Lighthouse in CI**
- Lab numbers vary between machines, so a strict budget can flake.
- Median of three, simulated throttling (not devtools throttling) and a printed report keep failures explainable.
- If CI hardware is far slower than local, record the measured headroom in D57 rather than loosening the budget silently.

**Abuse**
- A public form that sends email can be used to send unwanted mail. Mitigations:
  - the confirmation contains no typed text;
  - one confirmation per lead;
  - per-email and per-IP limits;
  - Turnstile;
  - the suppression list;
  - WAF rules at the edge (M12 infra).
- The rate limiter fails open on a Redis outage (D32). Turnstile still applies, which is acceptable for this route.

**Legal text**
- The DPA and Cookies pages are drafts and need legal review before launch. The owner decided to publish the DPA as version 0.1 marked "needs legal review before launch" (OQ6).

**Google Analytics and consent**
- A mistake here sends visitor data to Google without consent, on the live public site. Mitigations: the tag is never in server-rendered HTML; the consent spec runs on the real export build with a fake ID and fails on any Google request before Accept; Lighthouse fails on any Google request; review focus 8.
- GA4 property settings (retention, signals, enhanced measurement, data sharing) live in Google's console, not in code. They are the owner's checklist in infra README; the code sets what it can (`allow_google_signals: false`, `allow_ad_personalization_signals: false`, `send_page_view: false`).
- Analytics now undercounts: only visitors who accept are counted. That is the price of the owner's choice and is stated in D57.
- Changing the banner text or the cookie list materially means raising `v` in `quad-cookie-consent`, so everyone is asked again.

**Shared checkout**
- Another agent is committing in the same tree, so the migration number (`0022`) and decision id (D57) can collide. Take the next free ones when writing them, and re-run `pnpm db:reset` after pulling.

**Not built here (later milestones)**
- Console Leads (list, owner, notes, convert to school; M2) and the leads retention job (M2).
- Store links on the badges and `/p/*` (when the apps are published).
- The WAF rules and CloudFront `www` redirect (infra, M12).
- The parent app's App Links intent filter and associated-domains entitlement (the parent deep-link task).
