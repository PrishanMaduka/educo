# Quad implementation specification

This folder is the end-to-end specification for building Quad, a multi-tenant school platform, from the HTML prototypes in `design/`. It is written to be used with Claude Code in a terminal, one milestone at a time.

## How to use this with Claude Code

1. Clone the repo and open a terminal in its root. Claude Code reads `CLAUDE.md` automatically. That file holds the project rules and points here.
2. Install the prerequisites in [02 Architecture → Local development](02-architecture.md#local-development) (pinned versions in [Repository bootstrap](02-architecture.md#repository-bootstrap)).
3. Build in the order in [18 Delivery plan](18-delivery-plan.md). Each milestone has its scope, the spec sections to read, acceptance criteria and a prompt you can paste. Two project commands are provided:
   - `/build-milestone M3` reads the milestone, plans, builds, tests and reports.
   - `/verify` runs the full quality gate (types, lint, unit, API, end-to-end).
4. Keep the prototype open while you work: `open design/index.html`. The prototypes are the visual and behavioural reference. Where this spec and a prototype disagree, **this spec wins**. Where the spec is silent, copy the prototype.
5. When you make a decision the spec did not cover, add it to the decision log in [02 Architecture](02-architecture.md#decision-log) in the same change.

## Contents

| # | Document | What it covers |
|---|---|---|
| 01 | [Product](01-product.md) | Vision, people, the three apps, glossary, scope and non-goals |
| 02 | [Architecture](02-architecture.md) | Stack, monorepo layout, tenancy and database roles, environments and paths, local development, repository bootstrap (scripts, Turborepo, Docker, environment variables), decision log |
| 03 | [Design system](03-design-system.md) | The app design system from `design/system.html`: tokens (light and dark), the school brand colour, type, shape, colour rules, illustration and avatars, logo, page patterns, the greeting scenes, components, motion, accessibility |
| 04 | [Data model](04-data-model.md) | Every entity, field and relation, tenancy columns, indexes |
| 05 | [Auth, tenancy and permissions](05-auth-tenancy-rbac.md) | Sign-in flows, sessions, roles, the permission matrix, support access, audit |
| 06 | [API and realtime](06-api-and-events.md) | REST conventions, endpoint list, webhooks, realtime events, background jobs |
| 07 | [Platform console](07-platform-console.md) | Super-admin app: schools, wizard, curricula, plans, users, roles, branding, early warning for schools |
| 08 | [Staff portal](08-staff-portal.md) | School app: home, admissions, CRM, communications, students, attendance, pastoral, settings |
| 09 | [Parent app](09-parent-app.md) | Mobile app: every screen, gestures, offline, push |
| 10 | [Early warning](10-early-warning.md) | Signals, scoring, support plans, the school version in the console |
| 11 | [Ask Quad](11-ask-quad.md) | The assistant: Claude API, tools, safety, per-app intents, evaluation |
| 12 | [Circle, moments, messages and notifications](12-moments-messaging.md) | Quad Circle (moments, day ring, people, learning, family circle, photo consent, quiet hours, family pulse and connection), inbox, broadcasts, push, SMS, email |
| 13 | [Fees, payments and finance](13-fees-payments-finance.md) | Fee structures, billing runs, invoices, gateways, accounting |
| 14 | [Academics](14-academics.md) | Curriculum, year groups, timetable, staffing, cover, LMS, exams, reports, year rollover |
| 15 | [Cross-cutting](15-cross-cutting.md) | Files, search, jobs, audit, localisation, accessibility, performance, observability |
| 16 | [Security and privacy](16-security-privacy.md) | Children's data, safeguarding access, threat model, data residency and sub-processors, retention and purge, compliance |
| 17 | [Testing and quality](17-testing-quality.md) | Test pyramid, fixtures, end-to-end suites, the quality gate, CI |
| 18 | [Delivery plan](18-delivery-plan.md) | Milestones M0 to M12 (with M0b, M1b and M9b) with acceptance criteria and Claude Code prompts |
| 19 | [Public site](19-public-site.md) | The landing page at `quad-edu.com`, sign-in entry, demo requests, legal pages and sub-processors, SEO, analytics, performance budget |
| 20 | [Infrastructure and operations](20-infrastructure-operations.md) | AWS architecture, DNS and routing, Terraform, CI/CD and migrations, providers, app store publishing, observability, SLOs, on-call, support, backups, tenant deletion |
| 21 | [Onboarding and data import](21-onboarding-import.md) | Moving from Classe365 or spreadsheets: templates, mapping, dry run, account deduplication, batches and rollback, opening balances, historic data |

## Conventions in this spec

- **Must** means required for the milestone to be accepted. **Should** means expected unless there is a recorded reason not to.
- Field names are `camelCase` in TypeScript and `snake_case` in SQL.
- Money is stored as integer minor units (cents) with an ISO 4217 currency code, and shown in the school's currency and locale (`$3,100.00` for USD, `Rs 310,000` for LKR).
- Dates are stored in UTC; school-local times use the school's IANA time zone. A new school's time zone, currency and locale default from its country (for example `Asia/Colombo` and LKR for Sri Lanka) and can be changed; nothing defaults to Sri Lanka globally (D35).
- "Year group" means a grade or year (Year 4, Grade 9, MYP 2). "Class" means a section within it (Year 4 – Emerald). "Stage" is a group of year groups (Junior School).
- Sample data: names in examples are fictional and come from the prototypes. Since the app redesign ([D34](02-architecture.md#decision-log)) the prototypes use an international sample set (Greenfield International School in USD, St. Clare's Academy in GBP, Emma Nakamura, Grace Okafor, the Patels with Maya and Leo). Older examples in these specs still use the earlier names (Colombo International School, Amaya Perera, Dilhani Perera); read them through the mapping in D34. The seeds and seeded accounts are renamed in a later task.
