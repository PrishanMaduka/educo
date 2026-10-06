# 06 API and realtime

## Conventions

- Base URLs: `https://api.quad.school/v1` (school and parent routes) and `https://api.quad.school/v1/platform` (console routes).
- JSON with `camelCase` keys. Every request and response body has a Zod schema in `packages/contracts`, and OpenAPI is generated from them at `/v1/openapi.json`. `packages/client` is regenerated from it with `pnpm api:client`.
- Auth: a session cookie (web) or `Authorization: Bearer` (mobile). The tenant always comes from the session or token.
- Lists: cursor pagination `?cursor=&limit=` (default 50, max 200). The response is `{ items, nextCursor }`. Filters are query parameters matching the UI filters (`?yearGroupId=&status=`). Search is `?q=`.
- Errors: `{ code, message, fields? }` with HTTP 400 (validation), 401, 403 (`forbidden`, `module_not_in_plan`), 404, 409 (`conflict`, `seat_limit`, `slot_taken`, `clash`), 422 (business rule), 429.
- Idempotency: `Idempotency-Key` header on payments, billing runs, broadcasts and bookings.
- Concurrency: editable records return `etag`; updates send `If-Match`, and a mismatch returns 409 with the current version.
- Rate limits (Redis): 600 requests per minute per user, 20 per minute on auth routes per IP, and 30 Ask Quad messages per hour per user.
- Times in responses are ISO 8601 UTC; school-local fields (lesson times) are `HH:mm` strings with the school's time zone.

## Endpoints

Grouped by module. `→` notes the main behaviour. Every list endpoint supports the filters in the matching UI.

### Me and auth
- `POST /auth/password`, `POST /auth/sso/:provider/start`, `GET /auth/sso/:provider/callback`, `POST /auth/totp/verify`, `POST /auth/otp/request`, `POST /auth/otp/verify`, `POST /auth/refresh`, `POST /auth/sign-out`, `POST /auth/password/forgot`, `POST /auth/password/reset`
- `GET /me`, `GET /me/permissions`, `PATCH /me` (name, theme, locale), `GET /me/sessions`, `DELETE /me/sessions/:id`, `POST /me/totp`, `POST /me/devices` (push token)

### Platform (console)
- `GET /platform/overview` → counts, MRR series (6M/12M), plan mix, system status, needs-you-today list, activity feed
- `GET/POST /platform/tenants`, `GET/PATCH /platform/tenants/:id`, `POST /platform/tenants/:id/suspend|reactivate|schedule-deletion|export`
- `GET /platform/subdomains/check?value=` → `{ available, suggestion }`
- `POST /platform/tenants` runs the provisioning job and returns `{ tenantId, jobId }`; progress is streamed on `platform.provisioning.{jobId}`
- `GET/PUT /platform/tenants/:id/stages`, `GET/PUT /platform/tenants/:id/modules`, `PUT /platform/tenants/:id/plan`, `GET/PUT /platform/tenants/:id/branding`, `POST /platform/tenants/:id/branding/publish`, `GET/PUT /platform/tenants/:id/security`
- `GET/POST/PATCH /platform/tenants/:id/users`, `POST /platform/tenants/:id/users/bulk` (role change, require two-step, deactivate), `POST …/users/:uid/reset-password`, `POST …/users/:uid/sign-out-everywhere`
- `GET/POST/PATCH/DELETE /platform/tenants/:id/roles`
- `POST /platform/tenants/:id/support-session` → `{ url }` (one-time link into the staff portal)
- `GET/POST/PATCH /platform/curricula`, `POST /platform/curricula/:id/apply` (to schools on it, with a preview of the changes)
- `GET/POST/PATCH /platform/plans`, `GET /platform/invoices`, `POST /platform/invoices/:id/retry`
- `GET /platform/signals` (early warning for schools), `POST /platform/signals/:tenantId/check-in`
- `GET /platform/audit`
- `POST /platform/assistant/messages` (Ask Quad, console)

### School settings and people
- `GET/PATCH /school` (name, contact, time zone), `GET /school/branding` (read-only; set in the console)
- `GET/POST/PATCH /users` (staff), `POST /users/invite`, `GET/POST/PATCH/DELETE /roles`, `PUT /roles/:id/permissions`
- `GET /academic-years`, `POST /academic-years/:id/rollover/preview`, `POST /academic-years/:id/rollover` (job)
- `GET/PUT /structure` (stages, year groups, classes, subjects per year group, bells), `GET/PUT /staffing` (teaching assignments, class teachers, section heads)

### Students
- `GET/POST /students`, `GET/PATCH /students/:id`, `GET /students/:id/overview|attendance|academics|fees|conduct|signals`
- `GET/POST /students/:id/guardians`, `POST /students/import` (CSV with a dry-run preview)

### Admissions and CRM
- `GET /applicants?stage=&yearGroupId=&source=`, `POST /applicants`, `PATCH /applicants/:id` (moving `stage` is a drag on the board), `POST /applicants/:id/notes|documents|interviews|offer|enrol`
- Enrol: creates the student, guardians, enrolment and first invoice (optional), in one transaction
- `GET/POST/PATCH /leads`, `POST /leads/:id/convert`, `GET/POST /campaigns`, `GET/POST /enquiry-forms`, `POST /public/enquiry/:embedKey` (public, rate-limited, captcha)

### Attendance
- `GET /registers?date=&classId=`, `PUT /registers/:sessionId` (marks) → notifies parents of absent students at 09:00 or at once, depending on the school setting
- `GET /attendance/summary?from=&to=&yearGroupId=`, `GET /absence-reports`, `POST /absence-reports/:id/acknowledge`

### Pastoral
- `GET/POST /behaviour`, `DELETE /behaviour/:id`, `GET /houses/points`
- `GET/POST/PATCH /medical` (`sensitive.medical`), `GET/POST /sick-bay`
- `GET/POST /safeguarding`, `GET /safeguarding/:id` (logs a view), `POST /safeguarding/:id/entries`, `PATCH /safeguarding/:id` (`sensitive.safeguarding`)

### Early warning
- `GET /signals?level=&factor=&yearGroupId=`, `POST /signals/:studentId/plan`, `PATCH /support-plans/:id`, `POST /signals/:studentId/dismiss`, `GET /signals/rules`

### Academics
- `GET /timetable?classId=&teacherId=&week=`, `POST /timetable/generate` (job), `PATCH /timetable/slots/:id` (checks for clashes), `POST /timetable/publish`
- `GET /teach/today?teacherId=` (My teaching), `GET /teach/week`
- `GET/POST /cover/absences`, `GET /cover/board?date=`, `POST /cover/auto-assign`, `PUT /cover/assignments`, `POST /cover/publish`
- `GET/POST /courses`, `GET/POST /assignments`, `PUT /gradebook/:courseId` (marks)
- `GET/POST /exam-series`, `POST /exam-series/:id/generate`, `PATCH /exam-papers/:id`, `GET /exam-series/:id/clashes`, `POST /exam-series/:id/publish` (422 if clashes)
- `GET/POST /report-cycles`, `GET /report-cycles/:id/classes/:classId`, `PUT …/entries`, `POST …/approve`, `POST /report-cycles/:id/publish`, `GET /reports/:studentId/:cycleId.pdf`

### Communication
- `GET /threads`, `POST /threads`, `GET /threads/:id/messages`, `POST /threads/:id/messages`, `POST /threads/:id/read`
- `GET/POST /broadcasts`, `POST /broadcasts/:id/send`
- `GET/POST /moments`, `DELETE /moments/:id`, `GET /moments/:id/reactions`
- Circle (staff): `GET/POST /learning-posts`, `PATCH/DELETE /learning-posts/:id`, `GET /learning-posts/:id/tries`; `GET /circle/pulse?classId=` (class teacher of that class only); `GET /circle/connection?yearGroupId=` (`circle.connection.read`); `POST /circle/connection/reminders` (`{classId}` → class teacher), `GET/PUT /settings/quiet-hours`; photo consent and family circle are read-only on `GET /students/:id`
- `GET/POST /events`, `GET /events/:id/grid`, `PATCH /events/:id`, `GET/POST /forms`, `GET /forms/:id/responses`, `POST /forms/:id/remind`
- `GET/POST /news`, `GET/POST /stories`, `GET /notifications`, `POST /notifications/read`

### Fees and finance
- `GET/POST /fee-items`, `GET/PUT /fee-structures`, `GET/PUT /discount-rules`
- `POST /billing-runs/preview` (the four steps' totals), `POST /billing-runs` (creates drafts), `POST /billing-runs/:id/send`
- `GET /invoices?status=`, `GET /invoices/:id`, `POST /invoices/:id/send|remind|void`, `POST /payments/manual` (record a payment)
- `GET/PUT /payment-settings`, `GET /payments`
- `POST /webhooks/payhere`, `POST /webhooks/stripe` (signature verified, idempotent)
- `GET /finance/summary`, `GET/POST /journal`, `GET /accounts`, `GET/PUT /budgets`

### Parent app (`/family/...`, guardian tokens only)
- `GET /family/home` → one call for Home: children, day ring (same payload as `/family/day`), to-dos (including the heads-up row), bus, dues, coming up, news
- `GET /family/children/:studentId/attendance|results|timetable|homework|conduct|reports|exams|medical|doing`
- `GET /family/moments?studentId=&skill=`, `POST /family/moments/:id/heart`, `POST /family/moments/:id/thanks`
- Circle: `GET /family/day?studentId=` (day ring events and still-to-come), `GET /family/circle/people?studentId=`, `GET /family/circle/people/:staffId?studentId=`, `POST /family/circle/people/:staffId/thanks`, `POST /family/circle/people/:staffId/chat-request`
- Learning: `GET /family/learning?studentId=&week=` (posts, tries, term skill tally), `POST /family/learning/:postId/tries` (`{studentId, note?}`), `DELETE /family/learning/:postId/tries/:studentId`
- Family circle: `GET/POST /family/circle/relatives`, `DELETE /family/circle/relatives/:id`; photo consent `GET/PUT /family/children/:studentId/photo-consent`
- `GET /family/recaps?studentId=&week=`
- `GET /family/events/:id/slots`, `POST /family/events/:id/bookings`, `DELETE /family/bookings/:id`
- `GET /family/forms`, `POST /family/forms/:id/responses`
- `GET /family/invoices`, `POST /family/payments/intent` (gateway session), `GET /family/payments/methods`
- `POST /family/absence-reports`, `GET /family/bus/:routeId/live`, `POST /family/pickup-pass` (rotating token), `POST /family/wallet/top-up`
- `GET /family/threads`, the thread routes as above, `PATCH /family/contact`, `GET/PUT /family/notification-prefs`
- `POST /family/assistant/messages`

### Assistant
- `POST /assistant/messages` (staff), `POST /family/assistant/messages`, `POST /platform/assistant/messages` → Server-Sent Events stream (see [11](11-ask-quad.md#transport))
- `POST /assistant/messages/:id/feedback`

## Realtime (Socket.IO)

Clients connect with their session or token and join `tenant:{id}` and `user:{id}`. Teachers also join `class:{id}`; console users join `platform`.

| Event | Room | Payload | Used by |
|---|---|---|---|
| `moment.created` | guardians of the class or student | moment summary | Parent Home, Moments tab, push banner |
| `moment.reaction.created` | `user:{teacherId}` | momentId, heart, thanks | My teaching, Moments card |
| `learning.posted` | guardians of the class | post summary | Circle → Learning |
| `learning.tried` | `user:{teacherId}` | postId, studentId, note | My teaching, This week in class |
| `consent.photo.changed` | staff of the student's classes | studentId, scope | Share drawer |
| `family_circle.changed` | guardians of the student, staff of the student's classes | studentId | Circle → People, student profile |
| `event.booking.created` / `.cancelled` | `tenant:{id}` | eventId, teacherId, time | Evenings booking grid |
| `form.response.created` | `tenant:{id}` | formId, counts | Forms list |
| `message.created` | thread participants | thread, message | Inbox, parent Messages |
| `attendance.register.saved` | `tenant:{id}` | classId, absent count | Dashboard counters |
| `cover.published` | cover teachers | slots | My teaching |
| `exam.series.published`, `report.published` | guardians of the affected students | ids | Parent Home and to-dos |
| `invoice.updated`, `payment.succeeded` | guardian, `tenant:{id}` | invoice | Parent payments, fees list |
| `tenant.branding.updated` | `tenant:{id}` | branding | All apps re-theme live |
| `platform.provisioning.{jobId}` | creator | step, percent | New-school wizard |
| `bus.position` | `route:{id}` | lat, lng, eta | Parent bus screen |

## Background jobs (BullMQ, in `apps/api/src/worker.ts`)

| Job | Schedule or trigger |
|---|---|
| `provision-tenant` | On create: database rows, roles, structure from the template, branding, first admin invite |
| `compute-signals` | Daily at 06:00 school time, and on demand |
| `compute-school-health` | Daily at 05:00 UTC |
| `notify-absences` | 09:00 school time, after registers |
| `send-reminders` | Invoices due in 3 days and overdue at 7 and 14 days |
| `generate-timetable` | On request |
| `generate-exam-timetable` | On request |
| `render-report-pdfs` | On publish |
| `send-broadcast`, `send-push`, `send-sms`, `send-email` | Queues with retry and backoff |
| `rollover-year` | On request |
| `reconcile-payments` | Hourly; checks gateway status for pending payments |
| `purge-deleted` | Nightly: hard-delete soft-deleted rows past retention |
| `scan-file` | On upload (ClamAV container) |
