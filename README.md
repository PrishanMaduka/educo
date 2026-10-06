# Quad

A school management platform for school administrators, teachers, parents and students. It will ship as a monorepo with a web app for staff and a mobile app for parents.

## Design prototypes

Open `design/index.html` in a browser. Each prototype is a single self-contained HTML file with no build step.

| File | What it is |
|---|---|
| `design/index.html` | Launcher: what makes Quad different, and links to every prototype |
| `design/circle.html` | Concept: Quad Circle. Every child has a circle of family and school around them; a live school day links a teacher's phone (capture moments, family pulse, quiet hours), the child's circle and a parent's phone (day ring, moments, the people around the child, learning at home), plus the school's connection view |
| `design/platform.html` | Platform console for the super admin: schools (tenants), plans, each school's users, roles, modules, branding and security |
| `design/admin.html` | School admin web app: dashboard, the six core modules, and Users & roles |
| `design/parent.html` | Parent mobile app in a phone frame, with controls to simulate push notifications |
| `design/brand.html` | Logo guidelines: construction, colours, app icon and usage |
| `design/brand/` | Logo files (SVG): full logo, white logo, mark, app icon |

Both prototypes have light and dark themes and work at phone width. All data in them is sample data for a fictional school.

### Look and feel

All three apps share one design language:

- **Colour.** Soft off-white pages, a deep Quad Indigo side bar, coral for actions and lilac for highlights, with a matching dark theme. Each school's brand colour replaces coral in its own staff portal and parent app. The platform console uses a darker indigo side bar with lilac for the active item, so it is never mistaken for a school's portal.
- **Type.** Figtree throughout, with heavy headings and a soft lilac highlight on key words.
- **Story first.** Home screens open with a greeting and a few sentences about what is happening and what needs doing, before any charts. Local details stay (Poya holidays, birthdays, rupees), and good moments get a petal burst.
- **Early warning** (all apps). It finds students who are slipping (schools, in the console), explains why with trends, and suggests a next step and an owner. One click starts a support plan.
- **Ask Quad** (all apps). Press the floating button or `/` and ask in plain English. Answers are worked out from the app's own data and come with actions and a "From:" line that names the sources. It can also draft letters.
- **Quad Circle.** Every child has a circle of people at school and at home. Teachers share moments (photo, praise or great work, with an optional skill tag) and post one thing to try at home each week from My teaching, where a family pulse shows which families haven't heard anything positive lately. Leaders get a Family connection view, and the school sets quiet hours. Parents get a Circle tab (Moments · People · Learning), a day ring on Home, a weekly recap, photo consent per child, and can invite relatives to see moments.

### Logo

The mark is four soft rounded tiles, one each for the school (indigo), teachers and parents (lilac) and students (coral). The coral tile has a tail that turns the square into a Q. The lowercase wordmark is drawn in Quad Indigo. See `design/brand.html`.

### Platform console (`design/platform.html`)

Quad is multi-tenant: every school is a tenant with its own data, subdomain, users and settings. The super admin works in the platform console. It shares the warm look of the school apps but has its own accent so it is never confused with a school's staff portal: a teak-brown side bar with gold for the active item, and Quad's own mark. Schools keep their brand colours on their cards and pages.

| Area | Screens and interactions |
|---|---|
| Overview | Greeting and a plain-language summary of the platform; **Needs you today** (failed payments, seats near the limit, trials ending, onboarding, falling usage) with one-click actions; early warning for schools; then Schools, students on Quad, MRR, uptime, MRR chart, schools needing attention, plan mix, system status, recent activity |
| Early warning | Each school's health from staff weekly use (with trend), last admin sign-in, parent app use, billing, support tickets, seats and trial end, with a level (At risk of leaving, Keep an eye on, Thriving, Paused), suggested next step and actions (plan a check-in, retry payment, upgrade, draft an email in Ask Quad). The same signal shows on each school's overview |
| Ask Quad | Questions about schools at risk, revenue (by plan and country), a school by name, trials ending, seat usage, students by country, uptime and incidents, and how to add a school; drafts renewal, check-in and onboarding emails |
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
| Home (the school today) | Greeting and a plain-language summary; **Needs you today** (uncovered lessons, students who need a conversation, open high-level safeguarding cases, exam clashes, overdue invoices, applicants who have been waiting); **Good news** (birthdays with Send wishes, merits, best year group, students who are improving); early warning cards; then "The numbers": KPIs, fee collection chart, admissions funnel, attendance trend, today's schedule, overdue invoices, task list |
| Pre-admission & enrolment | Kanban pipeline (Enquiry → Application → Assessment → Interview → Offer → Enrolled) with drag and drop; search plus grade and source filters with live counts, a result count and Clear filters; wide applicant panel with clickable stage tracker, quick contact actions, next step, readiness rings, student and guardian details, notes, document checklist (verify, upload, ask parent), assessment scores against the entry benchmark with a recommendation, activity timeline and fees with offer letter; three-step application form |
| CRM | Leads with scores and source filters, lead drawer with notes and "convert to application", campaigns, enquiry forms, unified parent inbox, broadcast composer |
| Student information system | Student directory (table or cards, search, filters), student profile (overview, attendance heatmap, academics, fees, rewards and conduct), class attendance register |
| Learning management | Courses, assignments, gradebook with weighted averages that update as you type; timetable built for the whole school at once so no teacher is booked in two classes at the same time, with a grade filter (grouped into primary, middle and senior school) and that grade's classes, a week switch, per-grade **Subjects** (lessons a week, teacher and room, with a live meter of planned versus available periods, copy from another grade, apply to other grades in the same band) and **Bell times** (named day schedules such as Primary day or A/L day: first bell, lessons and intervals with durations, duty staff, reorder, times worked out automatically, a day strip, and which grades use the schedule), so each grade can have its own subjects and its own number and timing of intervals; today column, live "now" line, subject colours and icons, break bands with duty staff, today's agenda, lessons-per-week, lesson panel with cover teacher assignment, and drag-to-swap rearranging |
| Teachers & classes | Who teaches what for the year. **Teachers**: list with subjects, classes taught, responsibilities and a weekly-periods bar (search and filter by subject, section and role, including over the limit); the teacher drawer sets subjects they can teach, lessons by class and subject (taking over from the current teacher), class teacher of, head or deputy head of a section, and the weekly limit, with warnings for knock-on changes. **Classes**: every class by section with its class teacher and subject teachers; the class drawer sets the class teacher and a teacher for each subject (teachers of that subject listed first, with their load). **Sections**: Primary, Middle and Senior school with head and deputy head (one section per person), class and teacher counts, and the principal. The timetable uses these assignments for lesson teachers, cover suggestions and the class teacher shown above the grid |
| My teaching | A teacher's day (switch teacher with the picker): current or next lesson with countdown, today's lessons with Register and Marks & comments, a "Needs you" list (cover requests to accept, report comments due, morning registration, parent messages), their own class, and the week at a glance with any clashes flagged. The register drawer marks present, absent, late or excused; the comments drawer has a mark, grade and comment per student with a comment bank |
| Reports | Report cycle (Term 1 report) per class with marks and comments progress and a four-step flow: marks and comments → section head review → approved → published to parents. Student report editor with mark, grade on the curriculum's scale, effort, comment and comment bank for each subject, a class teacher comment, previous/next student, and a live preview of the printed report with the school's branding. Publishing shows a "report is ready" card in the parent app |
| Academic year | Current year with a term timeline and today marker, students by year group, pre-rollover checks and past years (read only). The year-end rollover is a five-step drawer: new year and term dates (validated), promotion map from each year group to the next with leavers and new intake plus exceptions (repeat the year, leaving), classes and staff (class teachers move up with their class or stay with the year group; keep subjects, assignments and section heads; rebuild timetables), fees and records (carry forward balances, draft invoices, notify parents, archive), and a typed confirmation with a progress run. Afterwards students have moved up, leavers are alumni, the year switcher shows the new year and reports start again |
| Early warning | Students flagged from attendance trend, behaviour concerns, a subject falling well below last term, missed homework, and fees unpaid for 30+ days, with a reason, sparkline, level (Needs a conversation, Keep an eye on, Plan in place, Improving, Not a concern), suggested next step and owner. Filter by level, signal and year group. **Start a plan** drawer (step, owner, review date, what was agreed, tell parents); **Write to parents** drafts a letter in Ask Quad; **Not a concern**; **How this works** explains the rules. A banner shows on the student's profile |
| Ask Quad | Side panel, opened from the top bar, the floating button or `/`. Answers questions about who needs attention (by year group), attendance, overdue fees (with Send reminders), cover, exam clashes, parents' evening bookings, admissions, and a student or teacher by name. Drafts letters (trip, fees, attendance, parents' evening, about a child) with Copy |
| Pastoral care | Behaviour log (merits, house points, concerns, detentions) with filters, house points table and a log drawer that can tell parents; medical conditions with severity, medication, care-plan reviews and a sick-bay log; safeguarding restricted to the lead and deputies, with concerns, levels, statuses, a dated chronology and a "record a concern" drawer |
| Staff cover | Today's absent staff, every lesson that needs cover, free teachers for each lesson (subject specialists first, then fewest covers this term), auto-assign, report absence, and a cover sheet that feeds the timetable and My teaching |
| Exams | Exam series from the curriculum's qualifications (for example Checkpoint, IGCSE, A Level, O/L, A/L, MYP, Diploma) plus internal exams; a day-by-session timetable with no clashes for any year group, room capacity checks, add and edit papers, and publish to the parent app |
| Evenings & forms | Parents' evenings built from teaching assignments, with a teacher-by-slot booking grid that shows bookings made in the parent app live; consent forms with yes/no/waiting counts, fees and reminders, filled in from parent signatures in the app |
| Fees & invoicing (billing run, online payments) | Invoices by status, invoice preview drawer, record payment, bulk invoice generation, fee structures, payment receipts |
| Finance & accounting | Income vs expenditure, spend by category, bank balances, journal entries with debit/credit balance check, chart of accounts, budget vs actual |

Global features: command palette (Ctrl/⌘ K), notifications panel, collapsible sidebar, academic-year and term switcher, toasts and a theme toggle.

**Filter dropdowns.** Toolbar filters use a custom dropdown instead of the browser's select: icon, current value, a tinted state with a clear (×) button when a filter is on, a menu with group headings, counts per option, a check on the selected one, search for long lists, and keyboard support (arrows, Enter, Escape). Form selects in drawers keep the native control with a matching chevron.

**Form pattern.** Every input form in the staff portal and the platform console opens as a side drawer, following the applicant panel: a tinted header with an icon, section label, title and subtitle; the fields grouped in a card on a light background; and the actions pinned to the bottom. Confirmations for destructive actions (suspend, delete) use a red header. The user profile and role builder stay full pages because they hold several sections of settings.

### Parent mobile app (`design/parent.html`)

Based on the iSAMS iParent feature set: one login for all of a parent's children, with dashboard, children, communications, information and settings.

- **Home**: a slim greeting bar, stories, a compact child switcher, then the child's **day ring** (LIVE: lessons done, arrival, register, moments, lunch, bus; tap for the Day timeline). **Needs you** carries a heads-up row when something is slipping, which opens How {child} is doing with the full heads-up card (what we noticed, why it matters, the teacher's suggestion, **Book a 10-minute chat**, **Message the teacher**). Then the bus, fees, quick links, coming up and news. Moments live in the Circle tab.
- **Circle** (tab): **Moments** (photos, praise and great work from teachers, grouped by day, with skill tags, Love and Say thanks, and a weekly recap), **People** (an orbit of everyone around the child; a person screen with Message, Say thanks and Ask for a chat; Invite family; Photos of {child}) and **Learning** (this week in class with one thing to try at home, We tried it, and the skills teachers noticed this term). Everything syncs live with the staff portal.
- **Inner pages**: every screen (children, attendance, results, timetable, homework, rewards, reports, calendar, payments, trips, messages, news, notifications, absence, canteen, pickup, bus, parents' evening, forms, exams, medical) opens with a one-line plain summary, then one main element, then grouped detail
- **How my child is doing**: attendance against target, each subject with a trend, homework, behaviour and house points, wellbeing, in plain language
- **Ask Quad**: a bottom sheet (floating button, More, or `/`) that answers about homework, how a child is doing overall or in a subject, attendance, next exam, fees (with Pay now), the bus, lunch, holidays, parents' evening and the class teacher, and drafts absence notes or messages to the teacher
- **Children** (from More or the Profiles chip on Home): per-child profile with attendance calendar, results and progress trend, timetable, homework, rewards and conduct, school reports, medical details
- **Payments**: outstanding balance, pay with a saved card or bank transfer (bottom sheet with a success state), trips with consent and payment, payment history
- **Messages**: conversations with teachers and offices, new message, school bulletins
- **School life**: book parents' evening appointments with each of the child's teachers, sign consent forms (fees are added to Payments), and see the exam timetable once the school publishes it; a to-do card on Home shows what needs doing; payment methods follow the school's online payment settings
- **More**: calendar, news, staff directory, contact-details update, notification preferences, Face ID, dark mode, language, sign out
- **Report an absence** form
- **Prototype panel** to simulate absence alerts, rewards, new invoices and teacher messages as push notifications
- **Live and interactive**: school stories (tap, hold to pause, swipe down, heart reactions), a "right now in class" card with a live countdown, a live school-bus tracker with an animated map and stop-by-stop alerts, a QR pickup pass that changes every 5 minutes, a canteen wallet with top-ups and a daily limit, and slide-to-pay with confetti
- **Gestures**: swipe the Home card to switch child, pull to refresh, drag from the left edge to go back, swipe conversations for actions, drag sheets down to close, swipe push banners away
- **Chat**: quick replies, "Seen" receipts and a typing indicator

## Implementation

The end-to-end implementation specification is in [`docs/spec/`](docs/spec/README.md):
- the product, architecture and stack;
- design tokens, the data model, auth and permissions, and the API;
- every app and module;
- early warning, Ask Quad and Moments;
- security, testing, and a milestone-by-milestone delivery plan.

[`CLAUDE.md`](CLAUDE.md) holds the rules Claude Code follows in this repo. Build with Claude Code one milestone at a time:

```
claude
> /build-milestone M0
```

Planned layout (details in [docs/spec/02-architecture.md](docs/spec/02-architecture.md)):

```
quad/
├── apps/
│   ├── api/          # NestJS API and background workers
│   ├── staff/        # Staff portal (Next.js + Tailwind CSS), one subdomain per school
│   ├── console/      # Platform console (Next.js + Tailwind CSS)
│   └── parent/       # Parent mobile app (Flutter)
├── packages/         # tokens, ui, contracts, client, db, domain, config
├── design/           # Interactive HTML prototypes (reference)
├── docs/spec/        # Implementation specification
└── infra/            # Terraform
```
