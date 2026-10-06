# 15 Cross-cutting

## Search
- **Command palette** (Ctrl K / ⌘K) in the staff portal and console:
  - searches students (name, admission number), staff, guardians, applicants, invoices (number), pages ("Timetable") and actions ("New application", "Record payment");
  - arrow keys move the selection, Enter opens, Escape closes;
  - results are grouped, with recent searches.
- Backend: `GET /search?q=` uses Postgres `tsvector` columns with a `pg_trgm` similarity fallback. It is permission-filtered and limited to 8 results per group, with p95 under 120 ms.

## Files
- Upload flow: `POST /files` returns a presigned PUT URL. The client uploads directly to S3, then calls `POST /files/:id/complete`. The `scan-file` job runs ClamAV, and the file is available only once it is `clean`.
- Images are resized with `sharp` to 320, 960 and 2048 px variants (WebP), and EXIF data is removed. Logos accept SVG, which is sanitised (DOMPurify on the server).
- Downloads use short-lived signed CloudFront URLs. Safeguarding attachments are never cached by the CDN.
- Limits: 10 MB per file (25 MB for documents), with per-school storage quotas by plan.

## Background jobs
BullMQ, with one queue per kind (see [06](06-api-and-events.md#background-jobs-bullmq-in-appsapisrcworkerts)).
- Retries use exponential backoff (5 attempts). A job that still fails moves to a failed set that is visible in an internal admin page.
- Schedules run in the school's time zone (one repeatable job per tenant per schedule). Jobs must be idempotent.

## Audit
See [05](05-auth-tenancy-rbac.md#audit). There is an append-only `audit_log` and `platform_audit`: no updates or deletes, enforced by a database trigger. Retention: 7 years.

## Localisation
- Every user-visible string goes through `i18next` (web) or Flutter's `intl` with ARB files (mobile). Keys live once in `packages/contracts/i18n/en.json`; `pnpm i18n:build` generates `apps/parent/lib/l10n/app_en.arb`. No string concatenation for sentences; use ICU messages with plurals ("{count, plural, one {# student} other {# students}}").
- Dates, numbers and money use `Intl` with the school's locale and currency (`Rs 310,000`, `5 Oct`, `Monday 5 October`).
- v1 ships `en` only. Add `si` and `ta` later; check that the layouts work with longer strings.
- The year-group labels and the school's own names (classes, houses) are data, not translations.

## Accessibility
WCAG 2.2 AA. See [03](03-design-system.md#accessibility). Automated checks: `@axe-core/playwright` on every page in the end-to-end suite must report zero serious or critical issues. In the Flutter app, widget tests use `meetsGuideline(androidTapTargetGuideline)`, `iOSTapTargetGuideline`, `labeledTapTargetGuideline` and `textContrastGuideline` on every screen.

## Performance budgets
| Surface | Budget |
|---|---|
| Staff and console pages | LCP < 2.0 s, INP < 200 ms, JS < 250 KB gzip per route |
| Parent app | Cold start to interactive Home < 2 s on a mid-range Android device; Home from cache < 300 ms |
| API | p95 reads < 300 ms, writes < 600 ms; timetable generation < 10 s; billing run for 1,500 students < 30 s |
| Realtime | Event fan-out < 1 s end to end |

## Observability
- OpenTelemetry traces from web through the API to the database and jobs, with a `tenant_id` attribute on every span.
- Pino JSON logs with request id, tenant id and user id. Never log personal data such as names, phones or message bodies.
- Sentry for API, web and mobile errors, with release tags.
- Dashboards: request rate and errors per route, job failures, gateway webhooks, push delivery, SMS spend, and Ask Quad tokens, cost and latency.
- Alerts: error rate over 2% for 5 minutes, webhook failures, a job queue backlog over 1,000, or an SMS spend spike.

## Feature flags
A simple `feature_flags(tenant_id nullable, key, enabled)` table, cached in Redis. Flags are used for staged rollouts (Ask Quad per school, the moments photo upload, and the transport live map).

## Settings that schools control
- Ask Quad on or off, and whether conversations are kept.
- Early warning shared with parents (off, after a plan, automatic).
- When absence alerts go out (at 09:00 or straight away).
- Reminder schedule.
- Quiet hours for staff.
- Photo consent required for moments.
- Sign-in rules (see the console).
