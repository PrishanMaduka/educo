# 07 Platform console

App: `apps/console`. Prototype: `design/platform.html`. Users: Quad staff (see [05](05-auth-tenancy-rbac.md#platform-roles)).

## Shell
- Side bar (rail `#15173A`, lilac active item) with the Quad logo and a "CONSOLE" badge.
  - **Platform:** Overview, Early warning (count of at-risk schools), Schools (count), Curricula, Plans & billing, Audit log.
  - **Pinned schools:** up to 6, each with its colour badge.
  - **Apps:** links that open the staff portal and parent app preview of the selected school.
- Top bar: search (schools, users; Ctrl K), system status pill ("All systems normal"), Ask Quad, theme toggle, profile.

## Overview
- **Greeting section** with the morning scene: "Good morning, {name}", then the sentence "{n} schools in {c} countries now run on Quad, looking after {students} students and bringing in {MRR} a month. Most of them are doing well: {k} are thriving. There are {x} things that need you today, and {y} schools are showing early signs they might leave." Also a calendar note (next public holiday that affects many schools) and the actions New school, All schools and Ask Quad.
- **Needs you today:** failed card payments (Retry payment), schools near their seat limit (Upgrade), trials ending within 14 days (Send offer), onboarding stuck (Open), falling staff use (Plan a check-in). Each row has the school, the reason and one action.
- **Early warning for schools:** the counts by level and the top cards (see [10](10-early-warning.md#schools-console)).
- **KPI tiles** with sparklines and count-ups: live schools, students, MRR, uptime over 30 days.
- **Revenue chart:** smooth MRR line with a 6M/12M switch and the latest value marked. **Plan mix:** a donut by plan with counts and a revenue-share note.
- **System status:** API, web, push, SMS, payments and email. **Recent activity:** from `platform_audit`.

## Schools
- Gallery and list views. The gallery uses school cards with the school's colour cover, logo, name, country, seats used/limit bar, plan, country, MRR, health pill and modules count.
- Search, a plan filter, and status chips (All, Active, Trial, Onboarding, Past due, Suspended) with counts.
- Export (CSV) and New school.

## New-school wizard (drawer, six steps)
1. **School details:** name, short name (auto-suggested), country (sets currency and time zone), region, curriculum (template list).
2. **Stages and year groups:** loaded from the chosen curriculum. In the editor you can:
   - rename stages and set age ranges;
   - add or remove year groups (chips with ×, an "+ Add year group" input; duplicates are rejected);
   - set classes per year group (1–10);
   - reorder stages (↑/↓), switch a stage off, or add a custom stage.
   
   A live journey bar and totals ("4 stages · 15 year groups · 30 classes") update as you edit. If you change the curriculum after editing, it asks "Load the new template or keep your edits?". Validation: at least one stage is on, every stage that is on has a name and at least one year group.
3. **Branding:** logo upload by drag and drop or file picker (PNG, JPG or SVG up to 2 MB, square recommended). The brand colour is picked automatically from the logo (dominant non-neutral colour) and can be changed with swatches or a hex. Also a short name, "No logo yet? Make a sample crest", and live previews of the staff sign-in, staff portal and parent app sign-in and home.
4. **Plan and modules:** Starter, Growth or Enterprise cards. Module switches are limited to what the plan includes. A seat slider, and a live monthly total of seats × the per-student price.
5. **First admin:** name and email (validated). They get an invite email.
6. **Create:** an animated provisioning checklist streamed from the job: create the school record (a `tenants` row in the shared database; no domain or schema is created), set up stages and classes, roles and permissions, branding, parent app listing, invite the admin. When done: "{School} is live on Quad. Congratulations!", the line "Staff sign in at quad-edu.com. Quad opens {School} for them from their account.", a petal burst, and buttons to open the staff portal and the parent app.

Acceptance: the wizard keeps its state when closed and reopened. Back and Next keep the edits. A provisioning failure shows the failed step with Retry. Creating a school writes `platform_audit`.

## School page (`/schools/:id`)
- A cover banner in the school colour with the logo tile, name, country, status, plan and health pills, and the actions "Open as school admin" and "Manage users".
- Tabs:
  - **Overview:** an early-warning panel (level, sparkline of staff weekly use, reasons, suggested next step, actions), KPI tiles (students/seat limit, staff accounts and pending invites, parents on the app and % of families, monthly bill and per-student price), usage chart and details.
  - **Stages:** the same editor as wizard step 2, with Save and the school's curriculum name.
  - **Users:**
    - Staff accounts with role and status filters and search.
    - Invite by email (validated), and bulk actions: change role, require two-step, deactivate.
    - Each user opens a **full profile page** with:
      - profile, work and preference details, with Save and Discard;
      - access: main role, extra roles, class assignments and the combined permissions;
      - sign-in and security: two-step, password reset, devices, sign-in history;
      - activity, notification preferences, and "Sign in as this user" for support.
  - **Roles & permissions:**
    - A role list and the module × action matrix. System roles are locked; custom roles can be edited.
    - A sticky save bar appears when there are changes.
    - The **New role page** is a full-page builder:
      - name, description and colour;
      - start from an existing role, and choose the scope;
      - the matrix with row and column shortcuts and presets;
      - sensitive switches, a people search, and a live summary with validation.
  - **Plan & modules:** module switches, a plan change, a seat slider, and the live monthly total.
  - **Branding:** logo, colour, live previews, app store name. There is no per-school domain: every school is reached at `quad-edu.com`, and its branding shows once a member signs in. **Publish** pushes the branding to the school's apps live (`tenant.branding.updated`).
  - **Sign-in & security:** Google and Microsoft SSO with the allowed domain, two-step rules, password minimum, session length, IP allowlist.
  - **Danger zone:**
    - export all data (a job that emails a download link);
    - suspend or reactivate, by typing the school's name to confirm;
    - schedule deletion, with a 30-day grace period and the same typed confirmation.

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
- **New plan** and **Edit plan** drawers have these fields: name, colour, description, price, included modules, seat limit, annual discount, trial days, open for sign-up, and featured.
- This month's platform invoices: status, Retry for failed payments, and a link to the school.

## Audit log
Filters: actor, school, action type and date range. The row detail shows the metadata JSON in a readable layout.

## Early warning (schools) and Ask Quad
See [10](10-early-warning.md#schools-console) and [11](11-ask-quad.md#tools-read-only-each-checks-the-callers-permissions-and-the-tenant).
