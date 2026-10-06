# 08 Staff portal

App: `apps/staff`. Prototypes: `design/landing.html` (public landing page and sign-in) and `design/admin.html` (the signed-in portal). URL: `quad-edu.com` (landing and sign-in) and `quad-edu.com/app/...` (portal) for every school; see [02](02-architecture.md#tenancy).

The profile menu shows the current school and, for people in more than one school, **Switch school**.

Academics (timetable, staffing, cover, LMS, exams, reports, academic year, My teaching) are in [14](14-academics.md). Fees and finance are in [13](13-fees-payments-finance.md). Early warning is in [10](10-early-warning.md), Moments and messaging in [12](12-moments-messaging.md), and Ask Quad in [11](11-ask-quad.md).

## Navigation (side bar)
| Group | Items |
|---|---|
| Overview | Dashboard, My teaching |
| Pre-admission | Admissions pipeline (open applicants count) |
| Relationships | CRM & leads, Communications (unread count), Family connection, Evenings & forms |
| Student information | Students, Early warning (Needs a conversation count), Attendance, Pastoral care |
| Learning | Courses & gradebook, Timetable, Teachers & classes, Staff cover, Exams, Reports |
| Finance | Fees & invoicing, Accounting |
| Settings | Academic year, Users & roles |

Items are hidden when the user lacks permission or the module is not in the plan. On phones the side bar is a slide-over opened with the menu button.

Top bar: search (Ctrl K, see [15](15-cross-cutting.md#search)), Ask Quad (`/`), academic year picker (switching shows that year read-only unless it is the current year), theme, notifications panel, profile.

All year-group labels come from the school's curriculum (Year 4, Grade 4, PYP 4). Never hard-code "Grade".

## Dashboard: "the school today"
1. **Greeting section** with the morning scene: "Good morning, {first name}", then a summary built from live data: "{present} of {enrolled} students are in school today, {pct}%. {lowest year group} is the lowest at {pct}%. Term {n} fees are {pct}% collected and {k} things need you before assembly." Below that, a context line ("Monday 5 October · Week 6 of Term 1 · next holiday Vap Poya, Mon 26 Oct") and the actions Take attendance and New application.
2. **Needs you today:** up to 6 rows, each with an icon, a sentence, detail and one action:
   - lessons with no cover (Arrange cover);
   - students who need a conversation (See who);
   - open high-level safeguarding cases, as a count only and shown only to sensitive holders (Open);
   - exam clashes (Fix);
   - overdue invoices with the total (Remind);
   - applicants waiting over two weeks (Open pipeline).
   
   Empty state: "All clear. Enjoy your tea."
3. **Good news:**
   - birthdays today, with **Send wishes**, which sends a parent-app message from the class teacher and shows a petal burst;
   - merits this week and the leading house;
   - the best attendance year group this week;
   - students whose support plans are working.
4. **Early warning:** the top 3 "Needs a conversation" cards in compact form, and "See all".
5. **The numbers:**
   - KPI tiles: enrolled with the change on last year; attendance today; fees collected against billed; open applications;
   - fee collection, stacked collected/outstanding by month;
   - admissions funnel with conversion;
   - daily attendance for the last 4 weeks with a 95% target line;
   - today's events;
   - overdue invoices with Remind;
   - my tasks (checklist).

## Admissions pipeline
- A kanban with the columns Enquiry, Application, Assessment, Interview, Offer sent and Enrolled, with counts. Drag cards between columns, or use the keyboard: Enter opens a card, and the drawer has a "Move to" control.
- Cards show the name, ref, year group, a priority dot, the source, documents (n/5) and days in stage.
- Filters: year group (grouped by stage, with counts) and source. Search by name or ID. Clear filters, with the "N of M applicants" count.
- KPIs: enquiries this month, applications in review (average days per stage), offer acceptance, and seats left for the next intake.
- **Applicant drawer** (wide): a header with the avatar, name, ref, year group, stage pill and a stage stepper. Tabs:
  - Overview: family, previous school, notes;
  - Documents: a checklist of five items, each with upload/verify;
  - Assessment: scores;
  - Activity: a timeline, with "add note".
  
  Actions: schedule interview, send offer (letter template, deposit amount), enrol and decline.
- **New application** (three-step drawer): child (name, date of birth, year group applying, intake), then parents (name, email, phone, relationship), then source and notes. Validation is inline. On save, the card appears in Enquiry or Application.
- **Enrol** creates the student, guardians (with parent-app invites), the enrolment in a class with free capacity (or one you choose), and optionally the first invoice. It then shows "Student record created".

## CRM & leads
- Tabs:
  - **Leads:** source chips with counts, and a table with name, source, interest, lead score bar (green above 70, amber above 40, red otherwise), owner, last contact and status.
  - **Campaigns:** cards with channel, reach, opened %, clicked % and status.
  - **Enquiry forms:** form list, an embed code, and a public form preview.
- The lead drawer has details, activities and notes, Log call and Send email, and "Convert to application".
- New lead form.

## Communications
- **Inbox:** threads with parents (unread first), a conversation pane, a reply composer with templates, and attachments. Replies arrive in the parent app's Messages.
- **Broadcasts:** compose a title and body; choose the audience (whole school, stages, year groups, classes, roles), the channels (app, SMS, email) and a schedule; preview, then send. Delivery stats come afterwards (delivered, opened).
- **Quiet hours** card: on/off, from, until and include weekends (default 18:00–07:00 and weekends). See [12](12-moments-messaging.md#good-relationships-by-design).
- **News and stories:** publish news posts (with a cover image and tag) and parent-app stories (slides with a background, title and text; they expire after 24 hours).

## Family connection
For leaders (`circle.connection.read`): a story sentence, stat tiles, a heatmap of year group × class of families who heard something positive in the last two weeks (selecting a cell filters the list), and **Families not reached** with **Remind {teacher}** and **Send a note from the office** (drawer). A footnote says it is about families, not a ranking of teachers. Details in [12](12-moments-messaging.md#good-relationships-by-design).

## Evenings & forms
Two tabs. The prototype is the reference.

- **Evenings:**
  - A list of events (parents' evening, options evening), each with date, time, slot length and year groups.
  - **Teachers are filled in automatically** from the teaching assignments for those year groups. Class teachers come first.
  - A **booking grid** of teachers × time slots shows booked slots with the parent's name, and updates live as parents book.
  - Actions:
    - open or close bookings;
    - remind unbooked parents;
    - export the per-teacher schedule as PDF.
  - The **New evening** drawer has title, year groups, date, start and end, slot length (5, 10 or 15 minutes) and location.
- **Forms:**
  - A list with yes/no/waiting counts, the fee (if any) and the deadline.
  - Each form opens to show responses by class, with the signer's typed name and time.
  - Actions:
    - Remind (sends to those still waiting);
    - close;
    - export.
  - The **New form** drawer has title, kind (trip consent, annual consent, activity sign-up), the question, year groups (or all), deadline and an optional amount. Forms with an amount add an invoice line when a parent answers yes.

## Students
- **Directory:** table or card view.
  - Search by name or ID.
  - Filters: year group (grouped by stage) and status.
  - Columns: student, class, guardian, attendance (red under 90%), GPA, fee balance and status.
  - Bulk select for message, export and move class.
  - Import CSV, with a dry-run preview and per-row errors.
  - Add student.
- **Student profile:**
  - A header with the avatar, ID, name, class, house and status. Facts: attendance, GPA, fee balance and house points. Actions: message parent, report card.
  - Read-only Circle lines: **Family circle** (relatives who see moments) and **Photo consent** (class, family only, or no photos), as set by the guardians.
  - An **early-warning banner** when the student has a signal (level, reasons, link).
  - Tabs:
    - Overview: personal details, guardians and contacts with app status, medical summary (needs sensitive access);
    - Attendance: a term heatmap with counts;
    - Academics: Term 1 vs Term 2 by subject, with grades from the school's scale;
    - Fees: invoices and payments;
    - Rewards & conduct: a timeline.

## Attendance
- **Registers:**
  - Choose a class (your classes first).
  - Each student gets a P / A / L / E segmented control. "Mark all present" fills the register, and late minutes and a reason can be added.
  - Save. Parents of absent students are told at 09:00 (the school can change this to "at once").
  - Registers show as "taken" with who and when.
- **School view:**
  - Today by year group and class.
  - Unexplained absences, with the parent's reported reason when there is one.
  - Lates.
  - Absence reports from parents, to acknowledge.
- Codes: P present, A absent, L late, E excused. A school can add custom codes later (v2).

## Pastoral care
Three tabs. Reference: `V.pastoral` in the prototype.

- **Behaviour:**
  - A log with a type filter (merit, house points, concern, detention), plus the house points table.
  - The log/view drawer has: student, type (segmented), reason (positive or negative list), points, detention date, note, and "Tell parents in the app".
  - A note is required for concerns and detentions. Parents see the reason and the note, never private staff comments.
- **Medical:**
  - Conditions with severity, medication and where it is stored, and the care-plan review date (flagged if due within 30 days). Needs `sensitive.medical`.
  - The **sick bay today** log has a **Log visit** drawer: time, complaint, treatment, outcome, tell parents.
- **Safeguarding:**
  - Needs `sensitive.safeguarding`.
  - A banner lists who has access (DSL, deputies), and "Every view is recorded".
  - Case list: reference, student, category, level, status, reported. A case opens in a drawer showing that the view is logged.
  - The case drawer has: level, status, lead, reporter, a dated chronology, and "Add to chronology" (facts only).
  - **Record a concern** is a danger-styled drawer with student, category, level and what happened (at least 15 characters). It also shows who to call if the child is at immediate risk.
  - Safeguarding data is never used by early warning or Ask Quad.

## Users & roles
- **Staff accounts:** invite by email (one or many), role, status, last sign-in, and two-step status (with Remind).
- **Roles & permissions:** the same matrix and role builder as the console (see [07](07-platform-console.md)), limited to the school's plan. School admins cannot give a sensitive key they do not hold themselves.
- Each user's profile page: the same layout as the console user page.

## Notifications panel
Grouped by today and earlier: absences, payments, messages, cover requests, form replies and system notices. "Mark all read". Each item links to where you act on it.
