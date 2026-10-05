# Quad

A school management platform for school administrators, teachers, parents and students. It will ship as a monorepo with a web app for staff and a mobile app for parents.

## Design prototypes

Open `design/index.html` in a browser. Each prototype is a single self-contained HTML file with no build step.

| File | What it is |
|---|---|
| `design/index.html` | Launcher with links to both prototypes |
| `design/platform.html` | Platform console for the super admin: schools (tenants), plans, each school's users, roles, modules, branding and security |
| `design/admin.html` | School admin web app: dashboard, the six core modules, and Users & roles |
| `design/parent.html` | Parent mobile app in a phone frame, with controls to simulate push notifications |
| `design/brand.html` | Logo guidelines: construction, colours, app icon and usage |
| `design/brand/` | Logo files (SVG): full logo, white logo, mark, app icon |

Both prototypes have light and dark themes and work at phone width. All data in them is sample data for a fictional school.

### Logo

The mark is a ring cut into four arcs (school, teachers, parents, students) around a shared centre, with a tail that turns it into a Q. The lowercase wordmark is drawn with the same stroke as the mark. See `design/brand.html`.

### Platform console (`design/platform.html`)

Quad is multi-tenant: every school is a tenant with its own data, subdomain, users and settings. The super admin works in the platform console. It has its own look so it is never confused with a school's admin app: a night theme by default (day theme on the toggle), a floating glass sidebar, Sora display type for titles and figures, KPI tiles with sparklines and count-up numbers, a smooth revenue chart with a 6M/12M switch, a plan donut, a gallery of school cards in each school's brand colour, and branded cover banners on school pages.

| Area | Screens and interactions |
|---|---|
| Overview | Schools, students on Quad, MRR, uptime, MRR chart, schools needing attention, plan mix, system status, recent activity |
| Schools | Tenant list with search, plan and status filters, seat usage, modules, region, MRR and health |
| New school | Six-step wizard: school details with live subdomain check; stages and year groups (loaded from the chosen curriculum template; rename stages, set age ranges, add or remove year groups such as Playgroup, Nursery and Reception, classes per year group, reorder, switch off, add custom stages; live journey bar and totals); branding (logo upload or drag and drop, brand colour picked automatically from the logo, sample crest, short name, live preview of the staff sign-in, staff portal and parent app); plan and modules; first admin; animated provisioning. Ends with buttons to open the new school's staff portal and parent app |
| School › Stages | The same stages editor for an existing school, with Save; shows which curriculum the school follows |
| Curricula | Curriculum templates (Cambridge International, Pearson Edexcel, IB, Sri Lankan national, American, and custom ones) with stages, year groups, grading scale and exam milestones. Each template opens in a drawer for editing, with an option to apply the changes to schools already on that curriculum. The new-school wizard loads the chosen curriculum's stages; if you change the curriculum after editing the stages, it asks whether to load the new template or keep your edits |
| School › Users | Staff accounts with role and status filters, invite by email (validated), bulk change role / require two-step sign-in / deactivate |
| User profile page | Full page per user: profile, work and preference details with save/discard, access (main role, extra roles, class assignments, combined permissions), sign-in and security (two-step, password reset, devices, sign-in history), activity, notification preferences, sign in as the user for support |
| New role page | Full-page role builder: name, description, colour, start from an existing role, scope (whole school, campuses, own classes), permission matrix with row/column shortcuts and presets, sensitive access switches, people search, live summary with validation; also used to edit and delete custom roles |
| School › Roles & permissions | Role list and a module × action matrix (view, create, edit, delete, approve), locked built-in roles, custom roles, save or discard bar |
| School › Plan & modules | Module switches, plan change, seat slider, live monthly total |
| School › Branding | Logo upload, brand colour, live preview, app store name, custom domain; Publish pushes the branding to the staff portal and parent app (also live in other open tabs) |
| School › Sign-in & security | Google and Microsoft single sign-on, two-step sign-in rules, password and session policy, IP allowlist |
| School › Danger zone | Export data, suspend or reactivate (type the subdomain to confirm), schedule deletion |
| Support access | "Open as school admin" opens the school's admin app with a support banner; actions are written to the audit log |
| Plans & billing | Plan catalogue and this month's invoices. New plan and Edit plan open in a drawer: name, colour, tagline, price per student, student limit, yearly discount, free trial, included modules, offer to new schools, most popular. A live preview card sits beside the form. When editing, it shows the schools on the plan, the monthly revenue change, schools above a lowered limit (which blocks saving), modules that become paid add-ons, and when a price change applies (next invoice, at renewal, or new schools only). Plans with no schools can be deleted |
| Audit log | Platform-wide audit log with filters |

The school admin app also has **Settings › Users & roles**, so each school's own admin can invite staff, change roles, deactivate accounts and edit role permissions without the super admin. It uses the same user profile page (also opened from the avatar in the top bar as *My profile*) and the same new role page.

### Sign-in and school branding

- **Sign-in pages** for all three apps. The console and the staff portal share one design: SSO buttons (Google Workspace, Microsoft 365), email and password with show/hide, forgot-password and "check your inbox" screens, and a 6-digit two-step code with auto-advance and paste. The staff portal's sign-in uses the school's logo and colours. The parent app has its own phone flow: welcome screen, phone number or email, one-time code with resend timer, then an offer to turn on Face ID. Each app has a sign-out button that returns to its sign-in page.
- **Branding flows from the console to the school apps.** Published branding is stored in the browser (`localStorage` key `quad-school`). The staff portal recolours its sidebar, buttons and sign-in page and shows the school logo and name; the parent app recolours its sign-in, lock screen, home card and notifications. The parent app's side panel can switch between sample schools to show this.

### Curriculum drives the school apps

The curriculum and stages chosen when a school is created in the console (or later on its Stages tab) are published to the staff portal and parent app with the branding. Everything that deals with year groups follows them:

- **Year groups and sections**: names such as Year 7, Grade 7, MYP 2 or Reception; the stages (for example Early Years, Junior School, Senior School, Sixth Form) are the sections used for section heads, filters and fee structures; the number of classes per year group comes from the stage.
- **Timetable**: one bell schedule per stage, shaped by the kind of stage (early years, primary, secondary, sixth form), and default subjects worded for the curriculum (for example Global Perspectives for Cambridge, Individuals & Societies for IB, Social Studies and Spanish for American, Religion and Sinhala for the Sri Lankan national curriculum).
- **Teachers & classes**: class-teacher teaching in early years and primary, subject teachers above; section heads per stage; a curriculum card with the grading scale and exam milestones.
- **Students, admissions, CRM, attendance, gradebook, fees, dashboard and parent app**: year group and class names, and marks converted to the curriculum's grading scale (A* to U, 9 to 1, 1 to 7, A/B/C/S/W or A to F).

Saving a school's stages, or a curriculum template applied to it, updates the school apps if that school is the one open in them.

### Admin web app (`design/admin.html`)

The layout follows the Classe365 admin pattern: a navy module sidebar, a white top bar and a grid of cards on a light grey background.

| Module | Screens and interactions |
|---|---|
| Dashboard | KPIs, fee collection chart, admissions funnel, attendance trend, today's schedule, overdue invoices, task list |
| Pre-admission & enrolment | Kanban pipeline (Enquiry → Application → Assessment → Interview → Offer → Enrolled) with drag and drop; search plus grade and source filters with live counts, a result count and Clear filters; wide applicant panel with clickable stage tracker, quick contact actions, next step, readiness rings, student and guardian details, notes, document checklist (verify, upload, ask parent), assessment scores against the entry benchmark with a recommendation, activity timeline and fees with offer letter; three-step application form |
| CRM | Leads with scores and source filters, lead drawer with notes and "convert to application", campaigns, enquiry forms, unified parent inbox, broadcast composer |
| Student information system | Student directory (table or cards, search, filters), student profile (overview, attendance heatmap, academics, fees, rewards and conduct), class attendance register |
| Learning management | Courses, assignments, gradebook with weighted averages that update as you type; timetable built for the whole school at once so no teacher is booked in two classes at the same time, with a grade filter (grouped into primary, middle and senior school) and that grade's classes, a week switch, per-grade **Subjects** (lessons a week, teacher and room, with a live meter of planned versus available periods, copy from another grade, apply to other grades in the same band) and **Bell times** (named day schedules such as Primary day or A/L day: first bell, lessons and intervals with durations, duty staff, reorder, times worked out automatically, a day strip, and which grades use the schedule), so each grade can have its own subjects and its own number and timing of intervals; today column, live "now" line, subject colours and icons, break bands with duty staff, today's agenda, lessons-per-week, lesson panel with cover teacher assignment, and drag-to-swap rearranging |
| Teachers & classes | Who teaches what for the year. **Teachers**: list with subjects, classes taught, responsibilities and a weekly-periods bar (search and filter by subject, section and role, including over the limit); the teacher drawer sets subjects they can teach, lessons by class and subject (taking over from the current teacher), class teacher of, head or deputy head of a section, and the weekly limit, with warnings for knock-on changes. **Classes**: every class by section with its class teacher and subject teachers; the class drawer sets the class teacher and a teacher for each subject (teachers of that subject listed first, with their load). **Sections**: Primary, Middle and Senior school with head and deputy head (one section per person), class and teacher counts, and the principal. The timetable uses these assignments for lesson teachers, cover suggestions and the class teacher shown above the grid |
| My teaching | A teacher's day (switch teacher with the picker): current or next lesson with countdown, today's lessons with Register and Marks & comments, a "Needs you" list (cover requests to accept, report comments due, morning registration, parent messages), their own class, and the week at a glance with any clashes flagged. The register drawer marks present, absent, late or excused; the comments drawer has a mark, grade and comment per student with a comment bank |
| Reports | Report cycle (Term 1 report) per class with marks and comments progress and a four-step flow: marks and comments → section head review → approved → published to parents. Student report editor with mark, grade on the curriculum's scale, effort, comment and comment bank for each subject, a class teacher comment, previous/next student, and a live preview of the printed report with the school's branding. Publishing shows a "report is ready" card in the parent app |
| Academic year | Current year with a term timeline and today marker, students by year group, pre-rollover checks and past years (read only). The year-end rollover is a five-step drawer: new year and term dates (validated), promotion map from each year group to the next with leavers and new intake plus exceptions (repeat the year, leaving), classes and staff (class teachers move up with their class or stay with the year group; keep subjects, assignments and section heads; rebuild timetables), fees and records (carry forward balances, draft invoices, notify parents, archive), and a typed confirmation with a progress run. Afterwards students have moved up, leavers are alumni, the year switcher shows the new year and reports start again |
| Fees & invoicing | Invoices by status, invoice preview drawer, record payment, bulk invoice generation, fee structures, payment receipts |
| Finance & accounting | Income vs expenditure, spend by category, bank balances, journal entries with debit/credit balance check, chart of accounts, budget vs actual |

Global features: command palette (Ctrl/⌘ K), notifications panel, collapsible sidebar, academic-year and term switcher, toasts and a theme toggle.

**Filter dropdowns.** Toolbar filters use a custom dropdown instead of the browser's select: icon, current value, a tinted state with a clear (×) button when a filter is on, a menu with group headings, counts per option, a check on the selected one, search for long lists, and keyboard support (arrows, Enter, Escape). Form selects in drawers keep the native control with a matching chevron.

**Form pattern.** Every input form in the staff portal and the platform console opens as a side drawer, following the applicant panel: a tinted header with an icon, section label, title and subtitle; the fields grouped in a card on a light background; and the actions pinned to the bottom. Confirmations for destructive actions (suspend, delete) use a red header. The user profile and role builder stay full pages because they hold several sections of settings.

### Parent mobile app (`design/parent.html`)

Based on the iSAMS iParent feature set: one login for all of a parent's children, with dashboard, children, communications, information and settings.

- **Home**: child switcher, today's arrival status, fees due, quick actions, upcoming events, school news
- **Children**: per-child profile with attendance calendar, results and progress trend, timetable, homework, rewards and conduct, school reports, medical details
- **Payments**: outstanding balance, pay with a saved card or bank transfer (bottom sheet with a success state), trips with consent and payment, payment history
- **Messages**: conversations with teachers and offices, new message, school bulletins
- **More**: calendar, news, staff directory, contact-details update, notification preferences, Face ID, dark mode, language, sign out
- **Report an absence** form
- **Prototype panel** to simulate absence alerts, rewards, new invoices and teacher messages as push notifications
- **Live and interactive**: school stories (tap, hold to pause, swipe down, heart reactions), a "right now in class" card with a live countdown, a live school-bus tracker with an animated map and stop-by-stop alerts, a QR pickup pass that changes every 5 minutes, a canteen wallet with top-ups and a daily limit, and slide-to-pay with confetti
- **Gestures**: swipe the Home card to switch child, pull to refresh, drag from the left edge to go back, swipe conversations for actions, drag sheets down to close, swipe push banners away
- **Chat**: quick replies, "Seen" receipts and a typing indicator

## Proposed monorepo structure

```
quad/
├── apps/
│   ├── web/          # Admin, teacher and student portal (Next.js)
│   ├── parent/       # Parent mobile app (React Native / Expo)
│   └── api/          # Backend API (Node.js, REST + webhooks)
├── packages/
│   ├── ui/           # Shared design tokens and components
│   ├── db/           # Database schema and migrations (PostgreSQL)
│   ├── auth/         # Platform roles (super admin, support) and per-school roles
│   ├── tenancy/      # Tenant resolution by subdomain, per-tenant schema, plan limits
│   └── config/       # Shared lint, TypeScript and test config
└── design/           # Interactive HTML prototypes (this folder)
```

This structure is a proposal for review. The stack is not decided yet.
