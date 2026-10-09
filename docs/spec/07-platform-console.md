# 07 Platform console

App: `apps/console`. Prototype: `design/platform.html`, on the app design system in [03](03-design-system.md) (D34). Renders: `docs/screenshots/redesign/console-*.png`. Users: Quad staff (see [05](05-auth-tenancy-rbac.md#platform-roles)).

**Sample data.** The prototype's schools and people are the international sample set in [D34](02-architecture.md#decision-log) (Greenfield International School, St. Clare's Academy, Emma Nakamura, Omar Haddad).

## Shell
- Side bar in Quad navy (`rail`) with the Quad logo and a lime "CONSOLE" badge. The console has no school colour, so it uses the default brand: the active item is Quad lime with navy text, and lime marks Quad's own primary actions. Each school keeps its own colour on its card, cover and logo tile (initials in `brand-ink` on `brand-fill`, so they pass AA). Items show soft-badge icons ([03](03-design-system.md#side-bar-icons), D40): each Platform and Team item has its own section colour, and pinned schools keep their initial tiles.
  - **Platform:** Overview, Early warning (count of at-risk schools), Schools (count), Leads (count of new), Curricula, Plans & billing, Audit log.
  - **Team:** Platform users (owner only), Support tickets (open count), System (failed jobs).
  - **Pinned schools:** the schools the user pinned (up to 6, pin or unpin from the school page's ☆ button), then the last 4 schools they opened that are not pinned. Each shows its colour badge and name. Stored per platform user in `platform_user_prefs`, so it follows them across devices. With nothing pinned the group shows recent schools only (as the prototype does).
  - **Apps:** links that open the staff portal and parent app preview of the selected school.
- Top bar: search (Ctrl K; schools, school users, platform users, invoices and leads through `GET /platform/search`), system status pill ("All systems normal", from the status page `status.quad-edu.com`), Ask Quad, theme toggle, profile.

## Overview
- **Greeting section** with the time-of-day scene (see [03](03-design-system.md#the-greeting-section-time-of-day)): "Good morning / afternoon / evening, {name}", then the sentence "{n} schools in {c} countries now run on Quad, looking after {students} students and bringing in {MRR} a month. Most of them are doing well: {k} are thriving. There are {x} things that need you today, and {y} schools are showing early signs they might leave." Also a calendar note (next public holiday that affects many schools) and the actions New school, All schools and Ask Quad.
- **Needs you today:** failed card payments (Retry payment), schools near their seat limit (Upgrade), trials ending within 14 days (Send offer), onboarding stuck (Open), falling staff use (Plan a check-in), new demo requests (Open leads), and support tickets older than a week (Open). Each row has the school, the reason and one action.
- **Early warning for schools:** the counts by level and the top cards (see [10](10-early-warning.md#schools-console)).
- **KPI tiles** with sparklines and count-ups: live schools, students, MRR, uptime over 30 days.
- **Revenue chart:** smooth MRR line with a 6M/12M switch and the latest value marked. **Plan mix:** a donut by plan with counts and a revenue-share note.
- **System status:** API, web, push, SMS, payments and email. **Recent activity:** from `platform_audit`.

## Schools
- Gallery and list views. The gallery uses school cards with the school's colour cover, logo, name, country, seats used/limit bar, plan, country, MRR, health pill and modules count.
- Search, a plan filter, and status chips (All, Active, Trial, Onboarding, Past due, Suspended) with counts.
- Export (CSV of the filtered list: name, country, plan, status, students, seat limit, MRR, health, since) and New school.

## New-school wizard (drawer, six steps)
1. **School details:** name, short name (auto-suggested), country (sets currency and time zone), region, curriculum (template list).
2. **Stages and year groups:** loaded from the chosen curriculum. In the editor you can:
   - rename stages and set age ranges;
   - add or remove year groups (chips with ×, an "+ Add year group" input; duplicates are rejected);
   - set classes per year group (1–10);
   - reorder stages (↑/↓), switch a stage off, or add a custom stage.
   
   A live journey bar and totals ("4 stages · 15 year groups · 30 classes") update as you edit. If you change the curriculum after editing, it asks "Load the new template or keep your edits?". Validation: at least one stage is on, every stage that is on has a name and at least one year group.
3. **Branding:** logo upload by drag and drop or file picker (PNG, JPG or SVG up to 2 MB, square recommended). The brand colour is picked automatically from the logo (dominant non-neutral colour) and can be changed with the named swatches (`QuadBrand.PALETTE`, Quad lime first as the default; [03](03-design-system.md#school-brand-colour)) or any hex. A school with no colour gets Quad lime. Every colour is made readable by the brand derivation, and the previews show the derived button, text and side-bar colours. Also a short name, "No logo yet? Make a sample crest", and live previews of the staff portal (after sign-in) and the parent app home (after sign-in). Sign-in screens are Quad-branded and are not previewed.
4. **Plan and modules:** Starter, Growth or Enterprise cards. Module switches are limited to what the plan includes. A seat slider, and a live monthly total of seats × the per-student price.
5. **First admin:** name and email (validated). They get an invite email (a signed staff-invite link).
6. **Create:** an animated provisioning checklist streamed from the job: create the school record (a `tenants` row in the shared database; no domain or schema is created), set up stages and classes, roles and permissions, school settings, branding, invite the admin. When done: "{School} is live on Quad. Congratulations!", the lines "Staff sign in at quad-edu.com. Quad opens {School} for them from their account." and "Parents use the Quad app. It shows {School}'s logo and colours once they sign in.", a petal burst, and buttons to open the staff portal, the parent app preview and **Import data**.

**Import data** (optional follow-up) opens the onboarding import for the new school from the console, with the same templates, mapping and dry run as the school's own Settings → Import data. See [21](21-onboarding-import.md).

When the wizard is started from a lead (**Convert to school** on the Leads page), step 1 is prefilled from the lead (school name, country, curriculum) and step 5 from the contact; finishing marks the lead `won` and links it to the school.

Acceptance: the wizard keeps its state when closed and reopened. Back and Next keep the edits. A provisioning failure shows the failed step with Retry. Creating a school writes `platform_audit`.

## School page (`/schools/:id`)
- A cover banner in the school colour with the logo tile, name, country, status, plan and health pills, a ☆ **Pin** toggle, and the actions "Open as school admin" (asks for a reason, always) and "Manage users".
- Tabs:
  - **Overview:** an early-warning panel (level, sparkline of staff weekly use, reasons, suggested next step, actions), KPI tiles (students/seat limit, staff accounts and pending invites, parents on the app and % of families, monthly bill and per-student price), usage chart and details, the planned and past check-ins, and the billing contact and payment method.
  - **Stages:** the same editor as wizard step 2, with Save and the school's curriculum name.
  - **Users:**
    - Staff accounts with role and status filters and search.
    - Invite by email (validated), and bulk actions: change role, require two-step, deactivate.
    - Each user opens a **full profile page** with:
      - profile, work and preference details, with Save and Discard;
      - access: main role, extra roles, class assignments and the combined permissions;
      - sign-in and security: two-step, password reset, devices, sign-in history;
      - activity, notification preferences, and "Sign in as this user" for support (a reason is required; it starts a support session as that user).
  - **Roles & permissions:**
    - A role list and the module × action matrix. System roles are locked; custom roles can be edited.
    - A sticky save bar appears when there are changes.
    - The **New role page** is a full-page builder:
      - name, description and colour;
      - start from an existing role, and choose the scope;
      - the matrix with row and column shortcuts and presets;
      - sensitive switches, a people search, and a live summary with validation.
  - **Plan & modules:** module switches, a plan change, a seat slider, and the live monthly total.
  - **Branding:** logo, colour, short name and live previews. There is no per-school domain or app listing: every school is reached at `quad-edu.com` and through the one Quad parent app, and its branding shows once a member signs in. **Publish** pushes the branding to the school's apps live (`tenant.branding.updated`).
  - **Sign-in & security:** two-step rules, password minimum, session length, IP allowlist. Staff always sign in with their work email and a password; there is no Google or Microsoft sign-in to set up (D37).
  - **Danger zone:**
    - export all data (a job that emails a download link);
    - suspend or reactivate, by typing the school's name to confirm. Suspending needs a **Reason (shown to the school admin)**; staff and parents see "{School} is paused on Quad" with that reason and the school's contact details, and sign-ins are blocked until it is reactivated. Billing pauses while suspended;
    - schedule deletion, with a 30-day grace period and the same typed confirmation. During the grace period the tab shows the deletion date and **Cancel deletion**. After it, the `purge-deleted` job removes the school's rows, files and cached data.

## Curricula
- Template cards: Cambridge International, Pearson Edexcel, International Baccalaureate, Sri Lankan national, American, plus custom templates. Each shows its stages, year groups, grading scale and exam milestones.
- Each template opens in a drawer to edit its name, description, grading scale and qualifications, with the stages editor. You can copy stages from another curriculum. Saving offers "Apply these changes to N schools on this curriculum" with a preview of the changes. Applying never deletes year groups that have students; it shows what will be skipped.
- Seed data (built-in templates):

| Template | Stages (ages: year groups) | Grading | Qualifications |
|---|---|---|---|
| Cambridge International | Early Years (EYFS) 3–5: Playgroup, Nursery, Reception · Junior School 5–11: Year 1–6 · Senior School 11–16: Year 7–11 · Sixth Form 16–18: Year 12–13 | A* to U | Year 6 Primary Checkpoint, Year 9 Lower Secondary Checkpoint, Year 11 IGCSE, Year 13 International A Level |
| Pearson Edexcel | EYFS 3–5: Nursery, Reception · Primary 5–11: Year 1–6 · Secondary 11–16: Year 7–11 · Sixth Form: Year 12–13 | 9 to 1 | Year 11 International GCSE, Year 13 International A Level |
| IB | Early Years 3–6: Pre-K, Kindergarten · PYP 6–11: PYP 1–5 · MYP 11–16: MYP 1–5 · DP 16–19: DP 1–2 | 1 to 7 | MYP 5 eAssessment, DP 2 IB Diploma |
| Sri Lankan national | Pre-school 3–5: Lower KG, Upper KG · Primary 5–10: Grade 1–5 · Junior Secondary 10–14: Grade 6–9 · Senior Secondary (O/L) 14–16: Grade 10–11 · Collegiate (A/L) 16–19: Grade 12–13 | A, B, C, S, W | Grade 5 Scholarship exam, Grade 11 G.C.E. O/L, Grade 13 G.C.E. A/L |
| American | Pre-K 3–5: Pre-K 3, Pre-K 4 · Elementary 5–11: Kindergarten, Grade 1–5 · Middle 11–14: Grade 6–8 · High 14–18: Grade 9–12 | A to F · GPA 4.0 | Grade 8 MAP Growth, Grade 11 SAT/PSAT, Grade 12 Diploma and AP |

## Plans & billing
- Plan cards. Seed plans:

| Plan | Price per student per month | Modules | Seats | Trial |
|---|---|---|---|---|
| Starter | $1.20 | admissions, sis, fees, parent | 500 | 30 days |
| Growth (featured) | $2.10 | admissions, crm, sis, lms, fees, parent | 1,500 | 30 days |
| Enterprise | $3.40 | all, including finance and transport | 5,000 | 14 days |

- Annual discount: 10%, 15% or 20% respectively.
- **New plan** and **Edit plan** drawers (wide, with a live preview card on the right) have these fields: name, colour, tagline, price per student per month, student limit, discount for paying yearly (none, 5–25%), free trial (none, 14, 30 or 60 days), included modules (with Select all and Clear), **Offer to new schools** (off hides it from the wizard; schools already on it keep it), and **Mark as most popular**.
- **Impact panel** (Edit plan): schools on the plan, the monthly revenue change, schools above a lowered student limit (named), and modules removed ("Schools keep {modules} as paid add-ons"). For a new plan it shows what a 600-student school would pay monthly and yearly.
- **When a price change applies** (Edit plan, when paying schools are on it): From the next invoice, At each school's renewal, or New schools only. Stored in `plan_price_changes`; the billing job applies it.
- **Delete plan** is disabled with "Move the {n} schools to another plan first" while any school is on it; otherwise it archives the plan.
- This month's platform invoices: number, school, amount with tax, status, PDF, Retry for failed card payments, Mark paid for bank transfers, and a link to the school.

## Leads
Demo requests from the landing page (`POST /public/demo-requests`) and leads added by hand.
- A story line ("{n} new demo requests this week. {k} demos booked.") and status chips with counts: New, Contacted, Demo booked, Won, Lost.
- Table: name, school, students band, curriculum, country, received, owner and status. Search by name, school or email.
- The lead drawer has the request details, owner (platform users), status, notes (a dated list with "Add note"), **Email** (opens the mail client) and **Convert to school**, which opens the new-school wizard prefilled. Lost needs a short reason.
- A new lead raises a badge on the nav item (`platform.lead.created`) and an email to `sales@quad-edu.com`.

## Platform users
Owner only (see [05](05-auth-tenancy-rbac.md#platform-roles)).
- A table of Quad staff: name, email (must be `@quad-edu.com`), role (owner, admin, support, billing, read only), two-step status, last sign-in and status.
- **Invite** (drawer): name, email and role. The invite link lets the person choose a password, and they set up TOTP on first sign-in.
- Row actions: change role, reset TOTP (they set it up again at next sign-in), deactivate (ends their sessions). The last owner cannot be demoted or deactivated.
- Every change writes `platform_audit`.

## Support tickets and System
- **Support tickets:** tickets from in-app Help (staff portal and parent app) and from `support@quad-edu.com`, with school, subject, age, status, priority and assignee. Opening one shows the thread and links to the school.
- **System:** failed background jobs by queue (job, school, error, attempts, failed at) with Retry, and links to the status page and dashboards (see [15](15-cross-cutting.md#background-jobs)).

## Audit log
Filters: actor, school, action type and date range. The row detail shows the metadata JSON in a readable layout. Export (CSV) of the filtered rows.

## Early warning (schools) and Ask Quad
See [10](10-early-warning.md#schools-console) and [11](11-ask-quad.md#tools-read-only-each-checks-the-callers-permissions-and-the-tenant). The **Plan a check-in** drawer is described in [10](10-early-warning.md#schools-console).
