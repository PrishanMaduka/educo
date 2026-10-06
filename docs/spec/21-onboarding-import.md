# 21 Onboarding and data import

How a school moves to Quad from Classe365, another system or spreadsheets. The import framework is built in **M4** (people and classes), opening fee balances in **M7**, and optional historic attendance and marks in **M8** ([18](18-delivery-plan.md)).

## Where it is

- Staff portal: **Settings → Import data** (`settings.edit` plus the create permission of the module being imported into, held by School admin by default). See [08](08-staff-portal.md).
- Console: the last screen of the new-school wizard offers **Import the school's data** as an optional follow-up. A platform user in a support session (reason required) can run imports for the school; every action is audited on both sides.
- Recommended order (shown as a checklist on the Import data page, each step unlocking once the one before has a committed batch): 1 Staff → 2 Classes → 3 Students → 4 Guardians and links → 5 Enrolments (if not in the student file) → 6 Opening balances (M7) → 7 Historic attendance and marks (M8, optional).
- The academic structure (stages, year groups, subjects, bell times) comes from the curriculum template in the wizard and the Structure screens ([14](14-academics.md)); it is not imported.

## Templates

`GET /imports/templates/:entity?format=csv|xlsx` downloads a template with the header row, one example row (sample, clearly fictional) and, in XLSX, a second sheet explaining each column and the allowed values (year-group labels, class names and subject names read from the school's own structure). Files may be CSV (UTF-8, comma or semicolon) or XLSX (first sheet), up to 10 MB and 20,000 rows.

| Entity | Columns (required in **bold**) |
|---|---|
| Staff | **first_name**, **last_name**, **email**, phone, employee_no, job_title, department, **role** (a role key or name in the school), subjects (semicolon-separated), is_class_teacher (yes/no), max_periods_per_week, start_date |
| Classes | **year_group** (label as the school uses it, e.g. "Grade 4"), **class_name**, class_teacher_email, room |
| Students | **admission_no**, **first_name**, **last_name**, preferred_name, **date_of_birth**, gender, **year_group**, **class_name**, house, admitted_on, previous_school, nationality, status (active by default) |
| Guardians and links | **student_admission_no**, **guardian_first_name**, **guardian_last_name**, **relationship**, phone (E.164 or local; required if no email), email, address, occupation, preferred_channel (app, sms, email), is_primary (yes/no), lives_with (yes/no), can_collect (yes/no) |
| Enrolments | **admission_no**, **year_group**, **class_name**, from_date. For moving students between classes after the first import |
| Opening balances (M7) | **admission_no**, **amount** (decimal in the school currency, converted to minor units on the server), as_of_date, description, fee_item (optional) |
| Historic attendance (M8) | **admission_no**, **date**, **status** (present, absent, late, excused), session (am/pm/day), reason |
| Historic marks (M8) | **admission_no**, **academic_year**, **term**, **subject**, mark, grade, comment |

**Classe365 preset.** Classe365 exports students, guardians and staff as CSV with its own headers. The mapping step recognises those headers and pre-fills the mapping (e.g. `Admission No` → admission_no, `Parent 1 Mobile` → guardian phone, `Class` split into year group and class name by the school's naming). A school can export from any other system or spreadsheet and map by hand. Presets live in `packages/domain/import/presets/` with unit tests.

## Steps

1. **Upload.** `POST /imports` with `{entity}` returns a presigned upload (the usual [files](15-cross-cutting.md#files) flow, virus-scanned). The batch is created with status `uploaded`.
2. **Map columns.** The page shows the file's headers with a sample of three values each and a dropdown of Quad fields; a preset or saved mapping fills it in; required fields must be mapped. Value mapping for enumerations: every distinct value in the file for year group, class, role, relationship, gender and status is listed with a dropdown of the school's values ("Gr 4" → "Grade 4"). Saved per school and entity for next time.
3. **Dry run.** `POST /imports/:id/dry-run` runs every row through validation and deduplication without writing. The result: counts of rows that will be **created**, **updated**, **linked to an existing account**, **skipped** (unchanged) and **errors**, and a table of rows with their messages (filter by error type; download as CSV with an `error` column to fix and re-upload). Nothing is committed while any row has an error, unless the person ticks "Skip rows with errors" (the skipped rows are listed in the batch).
4. **Commit.** `POST /imports/:id/commit` queues the `import-commit` job. Progress streams over realtime (`import.progress`), and the page can be left. On finish: "Imported 1,248 students into 42 classes. 3 rows skipped." with **Download report**.
5. **Invites (people imports).** Imported staff and guardians are created as `invited`. Invites are not sent automatically: the page offers **Send staff invites** and **Send parent invites** (SMS, email or printed letters with QR codes, see [05](05-auth-tenancy-rbac.md)) so the school chooses the moment.

## Accounts and deduplication

Quad has one global **account** per person and one **membership** (`users` row) per school ([02](02-architecture.md#where-the-tenant-comes-from)).

- **Phone** (normalised to E.164 with the school's country as default) and **email** (lower-cased) are the matching keys.
- Within the file: rows with the same phone or email for the same kind of person are one person (a guardian of three siblings appears once, linked three times). Conflicting names for the same key are an error ("Two different names use +94 77 123 4567: rows 14 and 88").
- Against this school: a matching membership is **updated** (only the mapped, non-empty fields), never duplicated. Students match on `admission_no`.
- Against other schools: if an account with that phone or email exists (a parent at two schools, a teacher at two schools), the import creates a new **membership** linked to the existing account; it does not copy or reveal anything from the other school. The dry run shows "Linked to an existing Quad account" without saying which school. If phone matches one account and email matches another, the row is an error ("This phone and this email belong to different Quad accounts. Use one of them, or ask Quad support to merge them.").
- No account is ever merged by import. Merges are a console support action ([05](05-auth-tenancy-rbac.md)).

## Batches and rollback

- Every import is an `import_batches` row **[T]**: id, tenant_id, entity, status enum(`uploaded`,`mapped`,`validated`,`committing`,`committed`,`failed`,`rolled_back`), file_id, mapping jsonb, counts jsonb, error_report_file_id, created_by, committed_at, rolled_back_at, rolled_back_by.
- Every committed row writes `import_batch_rows` **[T]**: batch_id, row_no, action enum(`created`,`updated`,`linked`,`skipped`), target_type, target_id, before jsonb (for updates).
- **Roll back** (`POST /imports/:id/rollback`) is available for **7 days** after commit, from the batch's page: it deletes created records, restores `before` values on updated ones and removes created memberships (never the global account if it has another membership). Rollback is refused, with a list of reasons, if later work depends on the rows (an invoice was issued, a register was taken, a guardian signed in, a later batch updated the same rows); the person can roll back the later batch first. After 7 days the row log is pruned and the batch is final.
- Commit and rollback each run in one transaction per 500 rows inside `withTenant`; a failure part-way marks the batch `failed` and rolls back the rows already written by that run.

## Opening balances (M7)

- Each row creates one **opening balance invoice** per student (`kind = opening_balance`, dated `as_of_date`, no fee structure) with a single line, and posts a journal entry to Accounts receivable against an "Opening balances" equity account ([13](13-fees-payments-finance.md)). Negative amounts create a credit on the family account.
- The money maths (parsing decimals into minor units, rounding, currency) runs in `packages/domain/fees` with unit tests. Amounts with more decimals than the currency allows are errors, not rounded.
- Guardians see the balance in Payments as "Balance from before Quad", payable like any invoice. Reminders follow the school's schedule.
- Requires `fees.create` as well as `settings.edit`.

## Historic data (M8, optional)

- Attendance: written to `attendance_marks` with `source = import` and attached to a closed register per date and class; it feeds the attendance history and the early-warning trend (marked as imported in the explanation). Dates must be inside a past or current academic year set up in Quad.
- Marks: written to a read-only "Imported results" gradebook per academic year and term; shown on the student profile and, if the school chooses, to parents under Results as "Earlier results". They do not create report cards.
- Older years are created as `closed` academic years when the school adds them in Academic year. Historic data never sends notifications.

## Validation rules

| Rule | Message (shown per row) |
|---|---|
| Required column missing or empty | "Add a date of birth." |
| Date not valid (accepts `YYYY-MM-DD`, `DD/MM/YYYY` with the school's locale) | "We couldn't read 31/02/2016 as a date." |
| Year group or class not in the school's structure | "There is no class Grade 4 – Lotus. Add it in Structure, or map it to another class." |
| Phone not valid for the country | "Check this phone number: 077 12 345." |
| Email not valid | "Check this email address." |
| Duplicate admission number in the file | "Admission number CIS-24100 appears twice (rows 3 and 41)." |
| Student age outside the year group's age range by more than 2 years | Warning only: "Amaya is 14 but placed in Year 4." |
| Seat limit of the plan exceeded | Blocks the commit: "This import would take you to 1,320 students; your plan allows 1,250." |
| Role not found or a guarded role (School admin) | "Role 'Principal' does not exist. Choose one of the school's roles." Imports cannot grant School admin |
| Amount not a number or wrong precision (opening balances) | "Rs 12,500.505 has too many decimals." |

Year-group labels in messages and templates come from the school's curriculum (never hard-coded "Grade" or "Year").

## Permissions and audit

- `settings.edit` for every import, plus the target module's permission: `settings.edit` for staff, `sis.create` for classes, students, guardians and enrolments, `fees.create` for opening balances, `attendance.edit` and `lms.edit` for historic data. Routes carry `@Can(...)` for both. Sensitive data (safeguarding, medical) cannot be imported in v1.
- Audit events: `import.uploaded`, `import.committed` (counts), `import.rolled_back`, `import.invites_sent`, with the batch id. Support-session imports are also written to `platform_audit`.
- Uploaded files and error reports are deleted 30 days after the batch is final.

## Limits and performance

- 20,000 rows per file; one running commit per school at a time (others queue).
- Dry run of 5,000 rows under 15 s; commit of 5,000 students with guardians under 60 s. Rows are validated in chunks of 1,000 in the worker; the API never parses large files in a request.
- Imports pause the school's realtime fan-out and notifications for the rows they create.

## API

`GET /imports` (batches), `GET /imports/templates/:entity`, `POST /imports`, `PUT /imports/:id/mapping`, `POST /imports/:id/dry-run`, `GET /imports/:id/rows?status=error`, `POST /imports/:id/commit`, `POST /imports/:id/rollback`, `POST /imports/:id/invites`. Routes are relative to `/api/v1` and listed in [06](06-api-and-events.md). These replace the earlier `POST /students/import`.

## Journeys

- **Import with rollback** (journey in [17](17-testing-quality.md#cross-app-journeys-must-stay-green-from-the-milestone-that-introduces-them)): download the student template, upload a Classe365-style file with one bad row, see the error in the dry run, fix and re-upload, commit, see the students in Students, roll back the batch, and the students are gone.
- Guardian import that matches a parent already at another seeded school links to the existing account; that parent then sees the school picker in the parent app.
- Opening balances (M7): import a balance, the parent sees "Balance from before Quad" and pays it.
- API tests: every endpoint's happy path, validation, permission denied and cross-tenant; rollback refused after an invoice exists; rollback refused after 7 days.
