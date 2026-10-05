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

Quad is multi-tenant: every school is a tenant with its own data, subdomain, users and settings. The super admin works in the platform console. It has its own look so it is never confused with a school's admin app: a night theme by default (day theme on the toggle), a floating glass sidebar, serif display type for titles and figures, KPI tiles with sparklines and count-up numbers, a smooth revenue chart with a 6M/12M switch, a plan donut, a gallery of school cards in each school's brand colour, and branded cover banners on school pages.

| Area | Screens and interactions |
|---|---|
| Overview | Schools, students on Quad, MRR, uptime, MRR chart, schools needing attention, plan mix, system status, recent activity |
| Schools | Tenant list with search, plan and status filters, seat usage, modules, region, MRR and health |
| New school | Five-step wizard: school details with live subdomain check; branding (logo upload or drag and drop, brand colour picked automatically from the logo, sample crest, short name, live preview of the staff sign-in, staff portal and parent app); plan and modules; first admin; animated provisioning. Ends with buttons to open the new school's staff portal and parent app |
| School › Users | Staff accounts with role and status filters, invite by email (validated), bulk change role / require two-step sign-in / deactivate |
| User profile page | Full page per user: profile, work and preference details with save/discard, access (main role, extra roles, class assignments, combined permissions), sign-in and security (two-step, password reset, devices, sign-in history), activity, notification preferences, sign in as the user for support |
| New role page | Full-page role builder: name, description, colour, start from an existing role, scope (whole school, campuses, own classes), permission matrix with row/column shortcuts and presets, sensitive access switches, people search, live summary with validation; also used to edit and delete custom roles |
| School › Roles & permissions | Role list and a module × action matrix (view, create, edit, delete, approve), locked built-in roles, custom roles, save or discard bar |
| School › Plan & modules | Module switches, plan change, seat slider, live monthly total |
| School › Branding | Logo upload, brand colour, live preview, app store name, custom domain; Publish pushes the branding to the staff portal and parent app (also live in other open tabs) |
| School › Sign-in & security | Google and Microsoft single sign-on, two-step sign-in rules, password and session policy, IP allowlist |
| School › Danger zone | Export data, suspend or reactivate (type the subdomain to confirm), schedule deletion |
| Support access | "Open as school admin" opens the school's admin app with a support banner; actions are written to the audit log |
| Plans & billing, Audit log | Plan catalogue, this month's invoices, platform-wide audit log with filters |

The school admin app also has **Settings › Users & roles**, so each school's own admin can invite staff, change roles, deactivate accounts and edit role permissions without the super admin. It uses the same user profile page (also opened from the avatar in the top bar as *My profile*) and the same new role page.

### Sign-in and school branding

- **Sign-in pages** for all three apps. The console and the staff portal share one design: SSO buttons (Google Workspace, Microsoft 365), email and password with show/hide, forgot-password and "check your inbox" screens, and a 6-digit two-step code with auto-advance and paste. The staff portal's sign-in uses the school's logo and colours. The parent app has its own phone flow: welcome screen, phone number or email, one-time code with resend timer, then an offer to turn on Face ID. Each app has a sign-out button that returns to its sign-in page.
- **Branding flows from the console to the school apps.** Published branding is stored in the browser (`localStorage` key `quad-school`). The staff portal recolours its sidebar, buttons and sign-in page and shows the school logo and name; the parent app recolours its sign-in, lock screen, home card and notifications. The parent app's side panel can switch between sample schools to show this.

### Admin web app (`design/admin.html`)

The layout follows the Classe365 admin pattern: a navy module sidebar, a white top bar and a grid of cards on a light grey background.

| Module | Screens and interactions |
|---|---|
| Dashboard | KPIs, fee collection chart, admissions funnel, attendance trend, today's schedule, overdue invoices, task list |
| Pre-admission & enrolment | Kanban pipeline (Enquiry → Application → Assessment → Interview → Offer → Enrolled) with drag and drop; wide applicant panel with clickable stage tracker, quick contact actions, next step, readiness rings, student and guardian details, notes, document checklist (verify, upload, ask parent), assessment scores against the entry benchmark with a recommendation, activity timeline and fees with offer letter; three-step application form |
| CRM | Leads with scores and source filters, lead drawer with notes and "convert to application", campaigns, enquiry forms, unified parent inbox, broadcast composer |
| Student information system | Student directory (table or cards, search, filters), student profile (overview, attendance heatmap, academics, fees, rewards and conduct), class attendance register |
| Learning management | Courses, assignments, gradebook with weighted averages that update as you type; timetable with class and week switches, today column, live "now" line, subject colours and icons, break bands with duty staff, today's agenda, lessons-per-week, lesson panel with cover teacher assignment, and drag-to-swap rearranging |
| Fees & invoicing | Invoices by status, invoice preview drawer, record payment, bulk invoice generation, fee structures, payment receipts |
| Finance & accounting | Income vs expenditure, spend by category, bank balances, journal entries with debit/credit balance check, chart of accounts, budget vs actual |

Global features: command palette (Ctrl/⌘ K), notifications panel, collapsible sidebar, academic-year switcher, toasts and a theme toggle.

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
