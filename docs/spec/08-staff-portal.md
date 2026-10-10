# 08 Staff portal

App: `apps/staff`. Prototypes: `design/landing.html` (public landing page and sign-in) and `design/admin.html` (the signed-in portal). URL: `quad-edu.com` (landing and sign-in) and `quad-edu.com/app/...` (portal) for every school; see [02](02-architecture.md#tenancy).

The profile menu shows the current school and, for people in more than one school, **Switch school**.

The portal uses the app design system in [03](03-design-system.md) (D34). Renders: `docs/screenshots/redesign/staff-*.png`.

**Sample data.** The prototype uses the international sample set in [D34](02-architecture.md#decision-log): Greenfield International School (USD, Cambridge, colour Greenfield green), Emma Nakamura as the signed-in head of school, and Grace Okafor's Year 4 Emerald.

Academics (timetable, staffing, cover, LMS, exams, reports, academic year, My teaching) are in [14](14-academics.md). Fees and finance are in [13](13-fees-payments-finance.md). Early warning is in [10](10-early-warning.md), Moments and messaging in [12](12-moments-messaging.md), and Ask Quad in [11](11-ask-quad.md).

## Public landing page
`quad-edu.com/` is served by `apps/staff` as a static, Quad-branded page (never school-branded). Reference: `design/landing.html`. Its sections, the demo request form (`POST /public/demo-requests` → `platform_leads` → the console's Leads), the sign-in dialog, legal pages, tokens and performance budget are specified in [19](19-public-site.md). The sign-in flow is in [05](05-auth-tenancy-rbac.md#staff-portal-quad-educom).

## Navigation (side bar)
| Group | Items |
|---|---|
| Overview | Dashboard, My teaching |
| Pre-admission | Admissions pipeline (open applicants count) |
| Relationships | CRM & leads, Communications (unread count), Family connection, Evenings & forms |
| Student information | Students, Early warning (Needs a conversation count), Attendance, Pastoral care |
| Learning | Courses & gradebook, Timetable, Teachers & classes, Staff cover, Exams, Reports |
| Finance | Fees & invoicing, Accounting |
| Transport | Routes, Pickup (module `transport`) |
| Settings | Academic year, Users & roles, School settings |

Items are hidden when the user lacks permission or the module is not in the plan. On phones the side bar is a slide-over opened with the menu button.

The side bar is Quad navy for every school, with the school's logo (or initials tile) and name at the top. The school's colour marks only the active item (`rail-active`) and the portal's actions ([03](03-design-system.md#staff-and-console-shell)). Each item has its own icon in a navy badge, drawn in its group's section colour from Quad's palette (Overview lime, Pre-admission orange, Relationships pink, Student information sky, Learning violet, Finance lime, Transport orange, Settings mist; [03](03-design-system.md#side-bar-icons), D40).

Top bar: search (Ctrl K, see [15](15-cross-cutting.md#search)), Ask Quad (`/`), academic year picker (switching shows that year read-only unless it is the current year), theme, notifications panel, profile (with **Help**, which opens a support-ticket drawer).

All year-group labels come from the school's curriculum (Year 4, Grade 4, PYP 4). Never hard-code "Grade".

## Dashboard: "the school today"
Loaded with one call, `GET /dashboard`; blocks refresh on `dashboard.changed`. Each block is shown only to people who may see its data.

1. **Greeting section** with the time-of-day scene (see [03](03-design-system.md#the-greeting-section-time-of-day)): "Good morning / afternoon / evening, {first name}", then a summary built from live data: "{present} of {enrolled} students are in school today, {pct}%. {lowest year group} is the lowest at {pct}%. Term {n} fees are {pct}% collected and {k} things need you before assembly." Below that, a context line ("Monday 5 October · Week 6 of Term 1 · next break Half-term, Mon 26 Oct") and the actions Take attendance and New application.
2. **Needs you today:** up to 6 rows, most urgent first, each with an icon, a sentence, detail and one action. This is the one list of row kinds (other files refer to it):
   1. lessons with no cover (Arrange cover);
   2. students who need a conversation (See who);
   3. open high-level safeguarding cases, as a count only and shown only to sensitive holders (Open);
   4. exam clashes (Fix);
   5. overdue invoices with the total (Remind);
   6. applicants waiting over two weeks (Open pipeline);
   7. parent threads waiting longer than two school days for a reply (Open inbox; see [12](12-moments-messaging.md#messages)).

   The pickup and contact-change approval queues, when not empty, also count here as a row "{n} changes from parents to check" (Review). Empty state: "All clear. Enjoy your tea."
3. **Good news:**
   - birthdays today (from `students.dob`), with **Send wishes**, which sends the school's birthday message from each class teacher to the guardians in the parent app (`POST /dashboard/birthday-wishes`) and shows a petal burst;
   - merits this week and the leading house;
   - the best attendance year group this week;
   - students whose support plans are working.
4. **Early warning:** the top 3 "Needs a conversation" cards in compact form, and "See all".
5. **The numbers:**
   - KPI tiles: enrolled with the change on last year; attendance today; fees collected against billed; open applications;
   - fee collection, stacked collected/outstanding by month;
   - admissions funnel with conversion;
   - daily attendance for the last 4 weeks with a 95% target line;
   - **Today:** today's events and meetings from the calendar, interviews and assessments;
   - overdue invoices (top 5) with Remind;
   - **My tasks:** the signed-in person's own checklist (`tasks`): tick to complete, an "{n} open" count, add a task with a title and optional due date, and delete. Tasks are private to their owner.

## Admissions pipeline
- A kanban with the columns Enquiry, Application, Assessment, Interview, Offer sent and Enrolled, with counts. Drag cards between columns, or use the keyboard: Enter opens a card, and the drawer has a "Move to" control. Waitlisted applicants keep their column and show a **Waitlist** pill.
- Cards show the name, ref, year group, a priority dot, the source, documents (n/5) and days in stage.
- Filters: year group (grouped by stage, with counts), source and "Waitlist only". Search by name or ID. Clear filters, with the "N of M applicants" count. **Export** (CSV of the filtered applicants).
- KPIs: enquiries this month, applications in review (average days per stage), offer acceptance, and seats left for the next intake.
- **Applicant drawer** (wide). Header: avatar, ref and source, name, year group and intake, priority pill and "{n} days in {stage}"; quick actions **Email**, **Call** (shows the number, with `tel:` on phones), **Message** (parent app, when the family has it) and **Schedule** (a calendar invite for a call or visit); and a clickable stage stepper with the date each stage was reached. Tabs:
  - **Overview:** a **Next step** box for the current stage (Enquiry: send the application form; Application: check the documents, then book an assessment; Assessment and Interview: the booking with Reschedule; Offer: waiting for the family, with expiry and Send reminder; Enrolled: open the record), three rings (documents verified n/5, assessment average, fees paid n/2), the student's details (date of birth, gender, nationality, current school, languages, siblings at the school), parents and guardians (with main contact and call buttons), and notes with **Add note**.
  - **Documents:** "{n} of 5 verified · {k} waiting for review", then one row per document (birth certificate, previous report, photo, passport, medical) with its status: Not received (**Ask parent**, Upload), Uploaded by parent (View, **Verify**), Verified by {name} on {date} (View). **Ask the family for all missing documents** sends one request.
  - **Assessment:** before booking, **Book assessment** (date, time, place; the family gets a confirmation). After, the scores per paper out of 100 with the year group's entry benchmark marked (default 65), interviewer notes (staff only) and the **Recommendation**: Offer a place, Waitlist or Decline.
  - **Activity:** a timeline of enquiry, fees paid, bookings, notes, documents and offers.
  - **Fees:** application fee, assessment fee, admission fee and refundable deposit, each Paid (date, method) or Not due, with Record payment. From the Interview stage on, **Send offer letter** (or **Resend offer letter**).
  
  Footer: **Decline** (reason and optional letter), **Waitlist**, and **Move to {next stage}** (or **Open student record** when enrolled).
- **Send offer** (drawer): letter template (from `letter_templates`, with a preview using the applicant's details), admission fee, deposit and expiry date (default 14 days). Sends by email and the parent app; the family accepts in the parent app or by replying, and staff can mark it accepted.
- **New application** (three-step drawer): child (name, date of birth, year group applying, intake), then parents (name, email, phone, relationship), then source and notes. Validation is inline. On save, the card appears in Enquiry or Application.
- **Enrol** creates the student, guardians (with parent-app invites), the enrolment in a class with free capacity (or one you choose), and optionally the first invoice. It then shows "Student record created".

## CRM & leads
- Tabs:
  - **Leads:** source chips with counts, and a table with name, source, interest, lead score bar (`good` above 70, `warn` above 40, `bad` otherwise), owner, last contact and status.
  - **Campaigns:** cards with channel, reach, opened %, clicked % and status.
  - **Enquiry forms:** form list, an embed code, and a public form preview.
- The lead drawer has details, an activity timeline, **Log call** (outcome and note), **Send email** (template or free text; sent from the school's office address), **Add note**, and **Convert to application**. Each one writes a `lead_activities` row (`POST /leads/:id/activities`) and updates "last contact".
- New lead form.

## Communications
- **Inbox:** threads with parents, unread first, with Open and Archived views. A conversation pane, a reply composer with **Templates** (a picker of saved replies from `message_templates`, shared ones and your own; "Save as template" from any reply) and attachments. Thread actions: mark read or unread, archive, mute. Replies arrive in the parent app's Messages.
- **Broadcasts:** compose a title and body; choose the audience (whole school, stages, year groups, classes, roles), the channels (app, SMS, email), **Urgent** (overrides parents' preferences and quiet hours, and sends SMS to everyone; for safety and closures only), and a schedule. **Preview** shows how it looks in the app and email, the number of families, how many get each channel, and the SMS cost estimate ("312 SMS · about Rs 1,560"). Then **Send to {n} families**. Delivery stats come afterwards (delivered, opened).
- **Quiet hours** card: on/off, from, until and include weekends (default 18:00–07:00 and weekends). Saved in School settings. See [12](12-moments-messaging.md#good-relationships-by-design).
- **News and stories** (built in M11): publish news posts (title, summary, body, cover image and tag; edit or delete later) and parent-app stories (slides with a background, title and text; they expire after 24 hours). Story hearts and replies are shown per story; a reply arrives in the inbox as a thread with the office.

## Family connection
For leaders (`circle.connection.read`): a story sentence, stat tiles, a heatmap of year group × class of families who heard something positive in the last two weeks (selecting a cell filters the list), and **Families not reached** with **Remind {teacher}** and **Send a note from the office**. The office-note drawer has the selected families, a short message prefilled from a template ("We wanted to share…") and **Send to {n} families**; each family gets an app message from the school office (`POST /circle/connection/office-notes`). A footnote says it is about families, not a ranking of teachers. Details in [12](12-moments-messaging.md#good-relationships-by-design).

## Evenings & forms
Two tabs. The prototype is the reference.

- **Evenings:**
  - A list of events (parents' evening, options evening), each with date, time, slot length and year groups.
  - **Teachers are filled in automatically** from the teaching assignments for those year groups. Class teachers come first.
  - A **booking grid** of teachers × time slots shows booked slots with the parent's name, and updates live as parents book.
  - Actions:
    - open or close bookings;
    - **Remind unbooked parents** (an app message to guardians of students in the year groups with no booking; shows the count first);
    - **Export schedules** (a PDF per teacher, or one teacher from the grid).
  - The **New evening** drawer has title, year groups, date, start and end, slot length (5, 10 or 15 minutes) and location.
- **Forms:**
  - A list with yes/no/waiting counts, the fee (if any) and the deadline.
  - Each form opens to show responses by class, with the signer's typed name and time.
  - Actions:
    - Remind (sends to those still waiting);
    - **Close** (no more answers; parents see "Closed"). Forms also close automatically after the deadline;
    - **Export** (CSV: student, class, answer, signer, signed at, invoice).
  - The **New form** drawer has title, kind (trip consent, annual consent, activity sign-up), the question, year groups (or all), deadline and an optional amount. Forms with an amount add an invoice line when a parent answers yes.
- **Trips** (built in M8; a third tab): a list of trips with date, year groups, cost, places, and consent and payment counts. The **New trip** drawer has title, description, date, depart and return times, location, cost, places and year groups; saving creates the consent form (kind `trip_consent`, with the cost) automatically, so consent and payment work like any form with a fee. A trip opens to its students with consent, paid and medical-check status, and **Remind** for those still waiting.

## Students
- **Directory:** table or card view.
  - Search by name or ID.
  - Filters: year group (grouped by stage) and status.
  - Columns: student, class, guardian, attendance (red under 90%), GPA, fee balance and status.
  - Bulk select, then: **Message parents** (a broadcast drawer prefilled with the selected students' guardians), **Export** (CSV of the selected rows; needs `sensitive.export_data`) and **Move class** (choose a class in the same year group; checks capacity; audited).
  - **Import** opens Settings → Import data ([21](21-onboarding-import.md)).
  - Add student.
- **Student profile:**
  - A header with the avatar, ID, name, class, house and status. Facts: attendance, GPA, fee balance and house points. Actions: message parent, report card.
  - Read-only Circle lines: **Family circle** (relatives who see moments) and **Photo consent** (class, family only, or no photos), as set by the guardians.
  - An **early-warning banner** when the student has a signal (level, reasons, link).
  - Tabs:
    - Overview: personal details, guardians and contacts with app status (and **Send invite** for guardians not on the app), pickup people with their approval status, medical summary (needs sensitive access);
    - Attendance: a term heatmap with counts;
    - Academics: Term 1 vs Term 2 by subject, with grades from the school's scale;
    - Fees: invoices and payments;
    - Rewards & conduct: a timeline.
- **Changes from parents** (a queue reached from the Needs you row and from Students): contact-detail changes (old and new value) and new pickup people (name, relationship, phone, photo, children), each with **Approve** or **Reject** (with a note). Approved contact changes update the guardian record; an approved pickup person can be chosen on a pickup pass. The parent is told either way.

## Attendance
- **Registers:**
  - Choose a class (your classes first).
  - Each student gets a P / A / L / E segmented control. "Mark all present" fills the register, and late minutes and a reason can be added.
  - Save. Parents of absent students are told at the school's alert time (default 09:00; the school can change this to "at once" in School settings).
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
  - The log/view drawer has: student, type (segmented), reason (from the school's positive or negative reason list), points (defaulted from the reason), detention date, note, and "Tell parents in the app". An entry opens in the same drawer to **edit** (its author, or anyone with `sis.edit`; the change is audited and parents see the updated entry) or delete.
  - A note is required for concerns and detentions. Parents see the reason and the note, never private staff comments.
  - **Reasons** (School settings → Behaviour reasons): the school's positive and negative lists with default points, reorder and switch off.
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

## Transport (module `transport`, built in M11)
- **Routes:** a list of routes (name, vehicle, driver and phone, students on board, stops). The route drawer edits the details, the ordered stops (name, map pin, scheduled morning and afternoon times) and the students per stop and direction. A live view shows today's run on a map from the provider adapter (a simulator in staging and demos). GPS hardware integration is v2.
- **Pickup:** the **pickup-pass scanner** for the gate and front desk (`frontdesk` role and above). It uses the device camera (or a USB scanner) to read a parent's pass and shows, large: the person's name, photo and relationship, the children they may collect with their photos and classes, and a green "OK to collect" or a red reason ("This code has expired. Ask them to refresh the pass.", "Not on the approved list", "This pass is for another day"). **Confirm handover** records the pickup (`pickup_scans` and a `gate_events` out row) and tells the parent. Below it, today's pickups with time and gate.

## Users & roles
- **Staff accounts:** invite by email (one or many), role, status, last sign-in, and two-step status. Row actions: **Remind** (to set up two-step), **Reset password** (emails a reset link), **Sign out everywhere**, change role, deactivate. "Sign in as" is not available to schools; Quad support uses it from the console (see [05](05-auth-tenancy-rbac.md#support-access-open-as-school-admin)).
- **Roles & permissions:** the same matrix and role builder as the console (see [07](07-platform-console.md)), limited to the school's plan. School admins cannot give a sensitive key they do not hold themselves.
- Each user's profile page: the same layout as the console user page.
- **Preview a role** (school admins; `users.manage`): a card on Users & roles lists every role (system and custom) with how many pages it can open and where it starts, and a **View as** picker in the top bar on desktop. Choosing a role re-renders the portal with that role's menu, home page (teachers start on My teaching, front desk on Attendance), Needs-you rows, dashboard sections and actions. Pages the role can only read show a **View only** tag and hide their action buttons; pages outside the role show "{Page} isn't part of the {role} role" with a link back to its home, and pages outside the school's plan show "{Page} isn't included in your school's plan" instead, even when the role doesn't open them either (D52). A banner says "Previewing as {role} · {sample person}" with **Back to my view**.
  - It is a preview, not impersonation: the admin stays signed in as themselves, sees the school's real data filtered by the role's permissions and scope (a teacher preview uses a sample class-teacher membership chosen by the admin), and **every write is refused** while previewing. Sensitive keys the admin does not hold are never granted by previewing. Each preview start and end is written to the audit log.
  - Prototype: `design/admin.html` (top-bar picker, banner, Users & roles card).

## School settings
Settings → **School settings** (`settings.view` to see, `settings.edit` to change; school admins by default). A page with a summary line ("Ask Quad is on. Quiet hours are 18:00–07:00 and weekends. Online payments: PayHere live.") and tabs. Every save shows a toast ("Quiet hours saved") and writes the audit log. Values live in `school_settings` unless noted.

| Tab | Settings |
|---|---|
| General | School name, office email (used as Reply-To on emails), office phone, address, time zone (read-only; set in the console), SMS sender ID (requested through Quad; "QUAD" until approved). Logo and colour are read-only with "Set by Quad". |
| Families | Photo consent default for new students (Class, Family only, No photos), family circle on/off, absence alert time (at a set time, default 09:00, or straight away), and invoice reminder days (default 3 days before, 7 and 14 days after) |
| Communication | Quiet hours (on/off, from, until, include weekends) and the reply expectation shown to staff |
| Early warning | Share with parents: Off, After a plan is started (default), Automatically |
| Ask Quad | On/off, "Keep conversations" on/off, and this month's use against the plan's budget (see [11](11-ask-quad.md#cost-controls)) |
| Behaviour reasons | The positive and negative reason lists |
| Online payments | Shortcut to Fees → Online payments, where gateway credentials are managed ([13](13-fees-payments-finance.md#who-owns-the-money)) |
| Import data | Templates, uploads, dry runs and past import batches with rollback. Specified in [21](21-onboarding-import.md) |
| Audit | The school's audit log: who did what and when, filters for person, action type and date range, a readable detail of each entry, and Export (CSV, needs `sensitive.export_data`). Support sessions from Quad are marked |

Sign-in rules (two-step, password length, session length, IP allowlist) are shown read-only with "Managed by Quad. Ask support to change them."

## Notifications panel
Grouped by today and earlier: absences, payments, messages, cover requests, form replies, changes from parents and system notices. "Mark all read". Each item links to where you act on it.
