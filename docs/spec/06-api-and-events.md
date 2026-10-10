# 06 API and realtime

## Conventions

- Base URLs: `https://quad-edu.com/api/v1` (school, parent and public routes, same origin as the web app) and `https://console.quad-edu.com/api/v1/platform` (console routes, proxied to the same API service and accepted only with a console session; console sign-in is under `/platform/auth/*`, never `/auth/*`). Every route below is written **relative to `/api/v1`**; console routes start with `/platform`.
- JSON with `camelCase` keys. Every request and response body has a Zod schema in `packages/contracts`, and OpenAPI is generated from them at `/api/v1/openapi.json`. `packages/client` (TypeScript) and `quad_api` (Dart) are regenerated from it with `pnpm api:client`.
- Auth: a session cookie (web) or `Authorization: Bearer` (mobile). The tenant always comes from the session or token, except on the tenant-less entry points in [05](05-auth-tenancy-rbac.md#tenant-less-entry-points).
- Guards: each route carries `@Can('<module>.<action>')` (shown in brackets below where it is not obvious from the module) and `@Module(...)` when it belongs to a plan module. `/family` routes check the guardian–student link. `/platform` routes check the platform role.
- Lists: cursor pagination `?cursor=&limit=` (default 50, max 200). The response is `{ items, nextCursor }`. Filters are query parameters matching the UI filters (`?yearGroupId=&status=`). Search is `?q=`. Lists with an Export button also answer `Accept: text/csv` (needs `sensitive.export_data` for personal data; every export is audited).
- Errors: `{ code, message, fields? }` with HTTP 400 (`validation`, `invalid_link` for any refused signed link, `invalid_code` for a wrong sign-in or two-step code), 401 (`unauthorized`, `invalid_credentials` for a wrong email or password), 403 (`forbidden`, `module_not_in_plan`, `school_suspended`, `account_locked`, `two_step_required`, `preview_read_only`), 404 (`not_found`), 409 (`conflict`, `seat_limit`, `slot_taken`, `clash`, `in_use`), 422 (`business_rule`, and the specific `last_admin`, `system_role_locked`, `already_member`, `own_role_locked`, `family_member` and `module_not_in_plan`), 426 (`app_update_required`), 429 (`rate_limited`, with `Retry-After`), 500 (`internal`) and 503 (`unavailable`, when sign-in cannot reach the lockout counter). The codes are `ErrorCode` in `packages/contracts` (D32).
- Idempotency: `Idempotency-Key` header on payments, refunds, wallet top-ups, billing runs, broadcasts, bookings and imports.
- Concurrency: editable records return `etag`; updates send `If-Match`, and a mismatch returns 409 with the current version.
- Rate limits (Redis): 600 requests per minute per user, 20 per minute on auth routes per IP, 30 Ask Quad messages per hour per user, and 5 demo requests per hour per IP.
- Times in responses are ISO 8601 UTC; school-local fields (lesson times) are `HH:mm` strings with the school's time zone.

## Endpoints

Grouped by module. `→` notes the main behaviour. Every list endpoint supports the filters in the matching UI.

### Me and auth
All routes are served from `https://quad-edu.com/api/v1` (the same origin as the web app). There is no per-school host.

- `GET /auth/memberships` (after the password or OTP step: the person's schools), `POST /auth/select-school` (`{tenantId}`, must be one of the memberships; rotates the session), `POST /auth/password` (the only staff first factor; no SSO routes, D37), `POST /auth/totp/verify`, `POST /auth/otp/request` (`{phone}` or `{email}`), `POST /auth/otp/verify`, `POST /auth/refresh`, `POST /auth/sign-out`, `POST /auth/password/forgot` (always 202), `POST /auth/password/reset` (signed token), `POST /auth/support-session` (`{token}`: redeems a support link and opens the visit; D16, D32), `POST /auth/support-session/end` (Exit to platform → `{redirect}`). With a bearer token, `POST /auth/select-school` answers the token pair (or, for a switch, a new access token) instead of setting cookies
- Invites: `GET /auth/invites/:token` (verifies a signed staff, guardian or relative invite; a staff invite → `{school, name, emailMasked, needsPassword}`), `POST /auth/invites/:token/accept` (adds the membership: an existing account accepts after signing in; a new account with no password sends `{password}` and goes on to two-step set-up or the school, D32)
- `POST /me/role-preview` (`{roleId, sampleUserId?}`; `users.manage`; sets a preview on the session: permission checks then use the role's matrix and scope, intersected with the admin's own sensitive keys, and every non-GET request returns 403 `preview_read_only`), `DELETE /me/role-preview`, `GET /me`, `GET /me/permissions` (reflects an active preview; a hidden page carries `hiddenBy: 'plan' | 'role'`, D52), `PATCH /me` (name, theme, locale), `GET /me/sessions`, `DELETE /me/sessions/:id`, `POST /me/totp`, `POST /me/devices` (push token), `DELETE /me/devices/:id`, `POST /me/contact/change` (own phone or email: OTP to the new value)
- `GET /me/tasks`, `POST /me/tasks`, `PATCH /me/tasks/:id` (title, due, done), `DELETE /me/tasks/:id`
- `GET /app/config` (public; `{minVersion: {ios, android}, latestVersion, storeUrls, maintenance}`; see [09](09-parent-app.md#minimum-version-and-forced-update))

### Public (no session)
- `POST /public/demo-requests` (`{name, email, school, students, curriculum, country, turnstileToken}`) → validates the Cloudflare Turnstile token and a honeypot field, rate-limits 5 per hour per IP, writes `platform_leads` (a repeat from the same email within 24 hours updates the lead), queues `demo-request-received`, and answers 202 with no body details. No tenant. See [19](19-public-site.md#demo-requests).
- `POST /public/enquiry/:embedKey` (rate-limited, captcha) → `tenant_by_embed_key` → creates a lead or applicant
- `POST /webhooks/payhere`, `POST /webhooks/stripe` (signature verified first, then `tenant_by_gateway_account`; idempotent on the gateway event id)
- `POST /webhooks/ses` (SES bounce and complaint events from SNS, sent as `text/plain`, body at most 300 KB; first checked: topic pinned to `SES_SNS_TOPIC_ARN`, `SigningCertURL` exactly `https://sns.<topic region>.amazonaws.com/SimpleNotificationService-<32 hex>.pem`, signature version 2 against that single, currently valid certificate, and a one-hour replay window; then `record_email_suppression`, which never replaces a `manual` entry; no tenant; 200 `{status: 'ok'}`, 403 `forbidden` for anything unverified, 400 `validation` for a body that is not JSON, 413 for a larger body. See [20](20-infrastructure-operations.md))
- `GET /calendar/:token.ics` (a signed calendar-feed token; see [09](09-parent-app.md#school-life-from-profile-and-from-to-dos))

### Platform (console)
- `GET /platform/overview` → counts, MRR series (6M/12M), plan mix, system status, needs-you-today list, activity feed
- `GET /platform/search?q=` → schools, school users, platform users, invoices and leads, grouped (max 8 per group)
- Console sign-in: `POST /platform/auth/password`, `POST /platform/auth/totp/setup`, `POST /platform/auth/totp/verify`, `POST /platform/auth/sign-out`; `GET /platform/me` (the signed-in Quad staff member and role)
- `GET /platform/me/prefs`, `PUT /platform/me/prefs` (pinned schools, up to 6); recent schools are recorded when a school page opens
- `GET/POST /platform/tenants` (`text/csv` export; in M1 `GET` lists only id, name, short name, status and brand colour, for Open as school admin and the audit filter), `GET/PATCH /platform/tenants/:id`, `POST /platform/tenants/:id/suspend` (`{reason}`, shown to the school's admins), `POST /platform/tenants/:id/reactivate`, `POST /platform/tenants/:id/schedule-deletion`, `POST /platform/tenants/:id/cancel-deletion`, `POST /platform/tenants/:id/export`
- `POST /platform/tenants` runs the provisioning job and returns `{ tenantId, jobId }`; progress is streamed on `platform.provisioning.{jobId}`. Body may include `leadId` to mark that lead `won`.
- `GET/PUT /platform/tenants/:id/stages`, `GET/PUT /platform/tenants/:id/modules`, `PUT /platform/tenants/:id/plan`, `GET/PUT /platform/tenants/:id/branding`, `POST /platform/tenants/:id/branding/publish`, `GET/PUT /platform/tenants/:id/security`
- `GET/POST/PATCH /platform/tenants/:id/users`, `POST /platform/tenants/:id/users/bulk` (role change, require two-step, deactivate), `POST …/users/:uid/reset-password`, `POST …/users/:uid/sign-out-everywhere`
- `GET/POST/PATCH/DELETE /platform/tenants/:id/roles`
- `POST /platform/tenants/:id/support-session` (`{reason}` required) → `{ url }` (single-use signed link into the staff portal)
- `GET /platform/tenants/:id/checkins`, `POST /platform/tenants/:id/checkins` (`{withUserId, at, how, notes, sendInvite}`), `PATCH /platform/checkins/:id` (done, outcome, cancel)
- `GET/POST/PATCH /platform/curricula`, `POST /platform/curricula/:id/apply/preview`, `POST /platform/curricula/:id/apply` (to schools on it)
- `GET/POST/PATCH /platform/plans`, `POST /platform/plans/:id/impact` (draft → schools on the plan, revenue change, schools over the new limit, modules removed), `DELETE /platform/plans/:id` (409 `in_use` while any school is on it; otherwise archives it)
- `GET /platform/invoices`, `GET /platform/invoices/:id.pdf`, `POST /platform/invoices/:id/retry`, `POST /platform/invoices/:id/mark-paid` (bank transfer), `POST /platform/invoices/:id/void`
- `GET /platform/signals` (early warning for schools)
- `GET /platform/leads?status=&owner=`, `GET/PATCH /platform/leads/:id` (status, owner, notes), `POST /platform/leads/:id/notes`, `POST /platform/leads` (manual)
- `GET/POST/PATCH /platform/users` (platform users; `owner` only), `POST /platform/users/:id/reset-totp`, `POST /platform/users/:id/deactivate`
- `GET /platform/support-tickets`, `PATCH /platform/support-tickets/:id`
- `GET /platform/jobs/failed`, `POST /platform/jobs/:queue/:id/retry` (owner and admin)
- `GET /platform/audit?actor=&action=&tenantId=&from=&to=` (`text/csv` export), `GET /platform/audit/people` (the Quad staff who appear as the actor, for the filter; D50)
- `POST /platform/assistant/messages` (Ask Quad, console)

### School settings and people
- `GET /school` [`settings.view`], `PATCH /school` (name, office email, office phone, address, SMS sender ID; `If-Match` required; time zone, branding and sign-in rules are refused as managed by Quad) [`settings.edit`], `GET /school/branding` (read-only; set in the console; any signed-in member)
- `GET /settings` [`settings.view`] (spec 08 wins), `PATCH /settings` [`settings.edit`] (arrives with each tab's feature; M1 ships `GET` only) → `school_settings` (Ask Quad, early-warning sharing, absence alert time, reminder days, photo consent default, family circle, quiet hours, SMS sender ID). Each change is audited.
- `GET /settings/payment-gateways`, `PUT /settings/payment-gateways/:provider` (credentials, mode), `POST /settings/payment-gateways/:provider/test` (makes a test call; marks `verified`) [`fees.approve`]
- `GET /audit?actor=&action=&from=&to=` [`settings.view`] (`text/csv` export with `sensitive.export_data`), `GET /audit/people` [`settings.view`] (the members who appear as the actor, for the filter; D49)
- `GET/POST/PATCH /users` (staff) [`users.manage`], `POST /users/invite`, `POST /users/:id/remind-two-step`, `POST /users/:id/reset-password` (emails a signed reset link), `POST /users/:id/sign-out-everywhere` (this school's sessions, and the account's trusted devices, D53), `POST /users/:id/resend-invite` (a new link; the old one stops working), `GET /roles` [`users.manage` or `settings.view`], `POST /roles` (`{name, description?, color, scope, baseRoleKey, permissions?}`: `baseRoleKey` null is Blank; `permissions` is an optional grant created in the same transaction, D48), `PATCH/DELETE /roles/:id`, `PUT /roles/:id/permissions` [`users.manage`]
- `GET /academic-years`, `POST /academic-years` (next year: name, term dates), `POST /academic-years/:id/rollover/preview`, `PUT /academic-years/:id/rollover/exceptions` (repeats year, leaving, class moves), `POST /academic-years/:id/rollover` (job)
- `GET/PUT /structure` (stages, year groups, classes, subjects per year group, bells, rooms), `POST /structure/subjects/copy` (`{fromYearGroupId, toYearGroupIds}`), `GET/POST/PATCH/DELETE /rooms`, `GET/PUT /staffing` (teaching assignments, class teachers, section heads), `GET/PUT /staffing/:teacherId/unavailability`, `GET/PUT /staffing/:teacherId/office-hours`
- Imports: `GET /imports` (batches), `GET /imports/templates/:entity?format=csv|xlsx`, `POST /imports` (`{entity}` → presigned upload), `PUT /imports/:id/mapping`, `POST /imports/:id/dry-run`, `GET /imports/:id/rows?status=error`, `POST /imports/:id/commit` (job), `POST /imports/:id/rollback` (within 7 days), `POST /imports/:id/invites` (send guardian and staff invites for the batch). Specified in [21](21-onboarding-import.md#api).

### Dashboard
- `GET /dashboard` → one call for the staff dashboard: greeting summary and context line, needs-you rows (see [08](08-staff-portal.md#dashboard-the-school-today)), good news (birthdays today, merits and leading house, best attendance year group, improving students), early-warning top 3, KPI tiles, fee collection series, admissions funnel, attendance series with target, today's events, overdue invoices (top 5) and open task count. Each block is permission-filtered and omitted when the user cannot see it.
- `POST /dashboard/birthday-wishes` (`{studentIds}`) → sends the school's birthday template from each class teacher to the guardians in the app

### Students
- `GET/POST /students`, `GET/PATCH /students/:id`, `GET /students/:id/overview|attendance|academics|fees|conduct|signals`
- `GET/POST /students/:id/guardians`, `POST /students/:id/guardians/:userId/invite` (sends the guardian invite)
- Bulk: `POST /students/bulk/message` (`{studentIds, body, channels}` → a broadcast to their guardians), `POST /students/bulk/move-class` (`{studentIds, classId}`), `GET /students?…` with `Accept: text/csv` for export
- `GET /contact-changes?status=pending`, `POST /contact-changes/:id/approve|reject` [`sis.edit`]
- `GET /pickup-people?status=pending`, `POST /pickup-people/:id/approve|reject` [`sis.edit`]

### Admissions and CRM
- `GET /applicants?stage=&yearGroupId=&source=` (`text/csv` export), `POST /applicants`, `PATCH /applicants/:id` (moving `stage` is a drag on the board; `recommendation`; `waitlisted`), `POST /applicants/:id/notes|interviews`
- Documents: `POST /applicants/:id/documents` (upload), `PATCH /applicants/:id/documents/:docId` (verify), `POST /applicants/:id/documents/request` (`{kinds}` or all missing → email and app message to the family)
- Assessment: `POST /applicants/:id/assessments` (book: date, place), `PATCH /applicant-assessments/:id` (scores, notes)
- Offers: `GET /letter-templates`, `POST /applicants/:id/offer` (`{templateId, admissionFeeMinor, depositMinor, expiresOn}` → sends the letter by email and the parent app), `POST /offers/:id/resend|withdraw`
- Fees: `GET /applicants/:id/fees`, `POST /applicants/:id/fees/:feeId/record-payment`
- `POST /applicants/:id/decline` (`{reason, templateId?}`), `POST /applicants/:id/enrol`
- Enrol: creates the student, guardians, enrolment and first invoice (optional), in one transaction
- `GET/POST/PATCH /leads`, `POST /leads/:id/activities` (`{kind: call|email|note|sms|meeting, text}`), `POST /leads/:id/convert`, `GET/POST /campaigns`, `GET/POST /enquiry-forms`

### Attendance
- `GET /registers?date=&classId=`, `PUT /registers/:sessionId` (marks) → notifies parents of absent students at the school's alert time or at once, depending on the school setting
- `GET /attendance/summary?from=&to=&yearGroupId=`, `GET /absence-reports`, `POST /absence-reports/:id/acknowledge`
- `POST /gate-events` (card reader integration or front desk: `{studentId, at, gate, direction, source}`)

### Pastoral
- `GET/POST /behaviour`, `PATCH /behaviour/:id` (author or `sis.edit`; audited), `DELETE /behaviour/:id`, `GET /houses/points`, `GET/POST/PATCH /behaviour-reasons` [`settings.edit`]
- `GET/POST/PATCH /medical` (`sensitive.medical`), `GET/POST /sick-bay`
- `GET/POST /safeguarding`, `GET /safeguarding/:id` (logs a view), `POST /safeguarding/:id/entries`, `PATCH /safeguarding/:id` (`sensitive.safeguarding`)

### Early warning
- `GET /signals?level=&factor=&yearGroupId=`, `POST /signals/:studentId/plan`, `PATCH /support-plans/:id`, `POST /signals/:studentId/dismiss`, `GET /signals/rules`

### Academics
- `GET /timetable?classId=&teacherId=&week=`, `POST /timetable/generate` (job), `PATCH /timetable/slots/:id` (checks for clashes), `POST /timetable/publish`
- `GET /teach/today?teacherId=` (My teaching), `GET /teach/week`, `GET /teach/notes?classId=`, `PUT /teach/notes` (`{classId, subjectId, studentId?, text}`: the "Working on with {child}" line)
- `GET/POST /cover/absences`, `DELETE /cover/absences/:id` ("Back in school": removes unpublished cover and tells published cover teachers), `GET /cover/board?date=`, `POST /cover/auto-assign`, `PUT /cover/assignments`, `POST /cover/requests/:id/accept`, `POST /cover/requests/:id/decline`, `POST /cover/publish`
- `GET/POST /courses`, `GET/POST /assignments`, `PUT /gradebook/:courseId` (marks), `POST /gradebook/:courseId/publish` (`{assignmentIds}` → parents see those marks), `GET /gradebook/:courseId.csv`
- `GET/POST /exam-series`, `POST /exam-series/:id/generate`, `POST /exam-papers`, `PATCH /exam-papers/:id`, `DELETE /exam-papers/:id`, `GET /exam-series/:id/clashes`, `POST /exam-series/:id/publish` (422 if clashes)
- `GET/POST /report-cycles`, `GET /report-cycles/:id/classes/:classId`, `PUT …/entries`, `POST …/ready`, `POST …/approve`, `POST …/send-back` (`{note}`), `POST …/reopen`, `POST /report-cycles/:id/publish`, `POST /report-cycles/:id/classes/:classId/unpublish` (`{reason}`; parents lose access and are told the report is being corrected), `GET /reports/:studentId/:cycleId.pdf`
- `GET/POST/PATCH/DELETE /comment-bank`

### Communication
- `GET /threads?status=open|archived`, `POST /threads`, `GET /threads/:id/messages`, `POST /threads/:id/messages`, `POST /threads/:id/read`, `POST /threads/:id/unread`, `POST /threads/:id/archive`, `POST /threads/:id/unarchive`, `POST /threads/:id/mute` (`{until}`)
- `GET/POST/PATCH/DELETE /message-templates`
- `GET/POST /broadcasts`, `POST /broadcasts/preview` (`{audience, channels, urgent}` → recipients, app/SMS/email counts, SMS segments and cost estimate at the school's rate), `POST /broadcasts/:id/send`
- `GET/POST /moments`, `DELETE /moments/:id`, `POST /moments/:id/hide` (`{reason}`; admins), `GET /moments/:id/reactions`
- Circle (staff): `GET/POST /learning-posts`, `PATCH/DELETE /learning-posts/:id`, `GET /learning-posts/:id/tries`; `GET /circle/pulse?classId=` (class teacher of that class only); `GET /circle/connection?yearGroupId=` (`circle.connection.read`); `POST /circle/connection/reminders` (`{classId}` → class teacher); `POST /circle/connection/office-notes` (`{studentIds, body}` → a message from the school office to each family; `circle.connection.read`); quiet hours are part of `PATCH /settings`; photo consent and family circle are read-only on `GET /students/:id`
- `GET/POST /events`, `GET /events/:id/grid`, `PATCH /events/:id` (open or close bookings), `POST /events/:id/remind-unbooked`, `GET /events/:id/schedule.pdf?teacherId=`
- `GET/POST /forms`, `PATCH /forms/:id` (edit, `closedAt` to close), `GET /forms/:id/responses` (`text/csv` export), `POST /forms/:id/remind`
- `GET/POST /trips`, `PATCH /trips/:id`, `GET /trips/:id/students` (consent and payment status per student)
- `GET/POST /news`, `PATCH/DELETE /news/:id`, `GET/POST /stories`, `DELETE /stories/:id`, `GET /notifications`, `POST /notifications/read`

### Fees and finance
- `GET/POST /fee-items`, `GET/PUT /fee-structures`, `GET/PUT /discount-rules`
- `POST /billing-runs/preview` (the four steps' totals), `POST /billing-runs` (creates drafts), `POST /billing-runs/:id/send`
- `GET /invoices?status=`, `GET /invoices/:id`, `POST /invoices/:id/send|remind|void`, `POST /payments/manual` (record a payment)
- `GET /payments`, `POST /payments/:id/refunds` (`{amountMinor, reason}`) [`fees.approve`] → refunds through the school's gateway; `GET /refunds`
- `GET/PUT /payment-settings`, `GET /settlements`, `POST /settlements/:id/match`
- Canteen: `GET/PUT /canteen/menu?week=`, `GET /wallets?classId=`, `POST /wallets/:id/purchases` (`{amountMinor, description}`; manual purchase entry by staff, blocked over the daily limit or the balance), `POST /wallet-transactions/:id/refund` [`fees.edit`]
- `GET /finance/summary`, `GET/POST /journal`, `GET /accounts`, `GET/PUT /budgets`

### Transport (module `transport`)
- `GET/POST/PATCH /routes`, `GET/PUT /routes/:id/stops`, `GET/PUT /routes/:id/students`, `GET /routes/:id/runs?date=`
- `POST /pickup/scan` (`{token, gate}` → person, photo, children and the result; writes `pickup_scans` and a `gate_events` out row) [`attendance.create`], `GET /pickup/scans?date=`

### Parent app (`/family/...`, guardian tokens only)
- `GET /family/me` (guardian or relative profile, children, schools; the only profile route relatives can call)
- `GET /family/home` → one call for Home: children, day ring (same payload as `/family/day`), stories, needs-you rows (including the heads-up row), bus, dues, coming up, news
- `GET /family/children/:studentId/attendance|results|timetable|homework|conduct|reports|exams|medical|doing`
- `GET /family/moments?studentId=&skill=`, `POST /family/moments/:id/heart`, `POST /family/moments/:id/thanks`
- Circle: `GET /family/day?studentId=` (day ring events and still-to-come), `GET /family/circle/people?studentId=`, `GET /family/circle/people/:staffId?studentId=`, `POST /family/circle/people/:staffId/thanks`
- 10-minute chat: `GET /family/circle/people/:staffId/chat-slots?studentId=` (see [09](09-parent-app.md#people)), `POST /family/circle/people/:staffId/chat-request` (`{studentId, startsAt, mode}` → books the slot, posts to the thread; 409 `slot_taken`), `DELETE /family/chat-requests/:id`
- Learning: `GET /family/learning?studentId=&week=` (posts, tries, term skill tally), `POST /family/learning/:postId/tries` (`{studentId, note?}`), `DELETE /family/learning/:postId/tries/:studentId`
- Family circle: `GET/POST /family/circle/relatives`, `DELETE /family/circle/relatives/:id`; photo consent `GET/PUT /family/children/:studentId/photo-consent`
- `GET /family/recaps?studentId=&week=`
- News and stories: `GET /family/news`, `GET /family/news/:id`, `GET /family/stories`, `POST /family/stories/:id/heart`, `POST /family/stories/:id/reply` (a message to the school office)
- `GET /family/directory?q=` (staff and offices the guardian may message, with roles and reply hours)
- `GET /family/calendar?from=&to=&filter=all|events|off`, `GET /family/calendar/:eventId.ics`, `POST /family/calendar/feed` (→ a signed `webcal://` subscription URL)
- `GET /family/events/:id/slots`, `POST /family/events/:id/bookings`, `DELETE /family/bookings/:id`
- `GET /family/forms`, `POST /family/forms/:id/responses`
- `GET /family/trips`, `GET /family/trips/:id` (consent goes through `POST /family/forms/:formId/responses`; payment through the invoice it creates)
- `GET /family/invoices`, `POST /family/payments/intent` (gateway session, see [13](13-fees-payments-finance.md#parent-payments)), `GET /family/payments/:id` (status), `GET /family/payments/methods`
- `POST /family/absence-reports`, `GET /family/bus/:routeId/live`
- Pickup: `GET /family/pickup/people`, `POST /family/pickup/people` (`{name, relationship, phone, photo?, studentIds}` → status `pending` until the office approves), `DELETE /family/pickup/people/:id`, `POST /family/pickup-pass` (`{personId, studentIds}` → today's pass and its rotating token), `POST /family/pickup-pass/:id/share` (→ a link valid today only for that person), `DELETE /family/pickup-pass/:id`
- Wallet: `GET /family/wallet?studentId=`, `POST /family/wallet/top-up` (`{studentId, amountMinor, method}` → a gateway session like invoices), `PUT /family/wallet/limit` (`{studentId, dailyLimitMinor}`), `GET /family/canteen/menu?date=`
- `GET /family/threads`, the thread routes as above, `PATCH /family/contact` (→ a `contact_change_requests` row for the school to review), `GET/PUT /family/notification-prefs` (7 categories and `smsBackup`)
- `POST /family/assistant/messages`

### Assistant
- `POST /assistant/messages` (staff), `POST /family/assistant/messages`, `POST /platform/assistant/messages` → Server-Sent Events stream (see [11](11-ask-quad.md#transport))
- `POST /assistant/messages/:id/feedback`, `GET /assistant/usage` (school admins: this month's use against the plan budget)

### Search and files
- `GET /search?q=` (staff command palette; see [15](15-cross-cutting.md#search)), `GET /platform/search?q=` (console)
- `POST /files`, `POST /files/:id/complete`, `GET /files/:id` (signed URL) (see [15](15-cross-cutting.md#files))
- `POST /support-tickets` (in-app Help: `{subject, body}` → `support_tickets`, visible in the console)

## Realtime (Socket.IO)

Clients connect to `wss://quad-edu.com/socket.io` with their session or token and join `tenant:{id}` and `user:{id}`. Teachers also join `class:{id}`; console users connect to `wss://console.quad-edu.com/socket.io` (same API service, console session) and join `platform`. The parent app's client uses `transports: ['websocket']` (M6); the web apps may fall back to long polling, which the ALB keeps on one task with its own cookie ([20](20-infrastructure-operations.md)).

| Event | Room | Payload | Used by |
|---|---|---|---|
| `moment.created` | guardians of the class or student | moment summary | Parent Circle tab (Moments badge and feed), Home day ring dot, in-app banner |
| `moment.reaction.created` | `user:{teacherId}` | momentId, heart, thanks | My teaching, Moments card |
| `learning.posted` | guardians of the class | post summary | Circle → Learning |
| `learning.tried` | `user:{teacherId}` | postId, studentId, note | My teaching, This week in class |
| `consent.photo.changed` | staff of the student's classes | studentId, scope | Share drawer |
| `family_circle.changed` | guardians of the student, staff of the student's classes | studentId | Circle → People, student profile |
| `event.booking.created` / `.cancelled` | `tenant:{id}` | eventId, teacherId, time | Evenings booking grid |
| `chat.request.created` / `.cancelled` | `user:{staffId}`, the guardian | requestId, studentId, startsAt | My teaching, parent person screen |
| `form.response.created` | `tenant:{id}` | formId, counts | Forms list |
| `message.created` | thread participants | thread, message | Inbox, parent Messages |
| `thread.updated` | `user:{id}` | threadId, read, archived, muted | Inbox and Messages on the person's other devices |
| `attendance.register.saved` | `tenant:{id}` | classId, absent count | Dashboard counters |
| `gate.event.created` | guardians of the student | studentId, at, direction | Home day ring |
| `cover.published` | cover teachers | slots | My teaching |
| `cover.request.updated` | `tenant:{id}` | requestId, status | Cover board |
| `exam.series.published`, `report.published` | guardians of the affected students | ids | Parent Home and to-dos |
| `invoice.updated`, `payment.succeeded`, `refund.updated` | guardian, `tenant:{id}` | invoice, payment | Parent payments, fees list |
| `wallet.updated` | guardians of the student | studentId, balance | Canteen screen |
| `pickup.scanned` | the pass creator | passId, result | Pickup pass screen |
| `dashboard.changed` | `tenant:{id}` | block keys | Dashboard refreshes those blocks |
| `tenant.branding.updated` | `tenant:{id}` | branding | All apps re-theme live |
| `tenant.suspended` | `tenant:{id}` | reason | All apps show the suspended screen |
| `platform.provisioning.{jobId}` | creator | step, percent | New-school wizard |
| `platform.lead.created` | `platform` | leadId | Console Leads badge |
| `import.progress` | `user:{id}` (who started it) | batchId, processed, total, status | Import data page |
| `bus.position` | `route:{id}` | lat, lng, eta | Parent bus screen |

## Background jobs (BullMQ, in `apps/api/src/worker.ts`)

| Job | Schedule or trigger |
|---|---|
| `provision-tenant` | On create: database rows, roles, structure from the template, branding, school settings, first admin invite |
| `compute-signals` | Daily at 06:00 school time, and on demand |
| `compute-school-health` | Daily at 05:00 UTC |
| `notify-absences` | At the school's absence alert time (default 09:00), after registers |
| `send-reminders` | On the school's reminder days (default 3 days before, and 7 and 14 days overdue) |
| `deliver-held` | When each school's quiet hours end: delivers held moments and messages |
| `build-weekly-recaps` | Fridays at 15:00 school time |
| `generate-timetable` | On request |
| `generate-exam-timetable` | On request |
| `render-report-pdfs` | On publish |
| `send-broadcast`, `send-push`, `send-sms`, `send-email` | Queues with retry and backoff |
| `rollover-year` | On request |
| `import-commit` | On request: commits or rolls back an import batch, with progress on `import.progress` (see [21](21-onboarding-import.md#batches-and-rollback)) |
| `demo-request-received` | On a demo request: emails `sales@quad-edu.com` and a confirmation to the requester |
| `reconcile-payments` | Hourly; checks gateway status for pending payments and refunds |
| `reconcile-settlements` | Daily; matches gateway payouts to payments |
| `platform-billing` | Daily at 02:00 UTC: issues platform invoices on period start, charges cards, dunning emails at 3, 7 and 14 days, suspension at 21 days past due (see [13](13-fees-payments-finance.md#platform-billing-console)) |
| `assistant-budget` | Hourly: usage against each school's monthly budget; alerts at 80% |
| `purge-deleted` | Nightly: hard-delete soft-deleted rows past retention |
| `scan-file` | On upload (ClamAV container) |
