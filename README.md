# Quad

A school management platform for school administrators, teachers, parents and students. It will ship as a monorepo with a web app for staff and a mobile app for parents.

## Design prototypes

Open `design/index.html` in a browser. Each prototype is a single self-contained HTML file with no build step.

| File | What it is |
|---|---|
| `design/index.html` | Launcher with links to both prototypes |
| `design/admin.html` | Admin web app: dashboard and the six core modules |
| `design/parent.html` | Parent mobile app in a phone frame, with controls to simulate push notifications |
| `design/brand.html` | Logo guidelines: construction, colours, app icon and usage |
| `design/brand/` | Logo files (SVG): full logo, white logo, mark, app icon |

Both prototypes have light and dark themes and work at phone width. All data in them is sample data for a fictional school.

### Logo

The mark is a ring cut into four arcs (school, teachers, parents, students) around a shared centre, with a tail that turns it into a Q. The lowercase wordmark is drawn with the same stroke as the mark. See `design/brand.html`.

### Admin web app (`design/admin.html`)

The layout follows the Classe365 admin pattern: a navy module sidebar, a white top bar and a grid of cards on a light grey background.

| Module | Screens and interactions |
|---|---|
| Dashboard | KPIs, fee collection chart, admissions funnel, attendance trend, today's schedule, overdue invoices, task list |
| Pre-admission & enrolment | Kanban pipeline (Enquiry → Application → Assessment → Interview → Offer → Enrolled) with drag and drop, applicant drawer, three-step application form with validation |
| CRM | Leads with scores and source filters, lead drawer with notes and "convert to application", campaigns, enquiry forms, unified parent inbox, broadcast composer |
| Student information system | Student directory (table or cards, search, filters), student profile (overview, attendance heatmap, academics, fees, rewards and conduct), class attendance register |
| Learning management | Courses, assignments, gradebook with weighted averages that update as you type, weekly timetable |
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
│   ├── auth/         # Roles: super admin, admin, finance, teacher, parent, student
│   └── config/       # Shared lint, TypeScript and test config
└── design/           # Interactive HTML prototypes (this folder)
```

This structure is a proposal for review. The stack is not decided yet.
