# 16 Security and privacy

Quad holds children's data, so every design choice errs on the side of least access.

## Principles
- **Least privilege:** each role sees only its modules and scope. Parents see only their own children.
- **Defence in depth:** permission guards in the API, plus Postgres row-level security per tenant enforced on a role that cannot bypass it, plus tests that try to break both.
- **Sensitive data is separate:** safeguarding and medical data need explicit sensitive keys, every view is logged, and neither ever goes to Ask Quad or early warning.

## Threat model (main risks and controls)
| Risk | Control |
|---|---|
| One school reads another school's data | Tenant from the session or token only (never from the host, path, body or the `?school=` hint); RLS with `FORCE ROW LEVEL SECURITY` on every [T] table, child tables included; the app connects as `quad_app` without `BYPASSRLS`; cross-tenant tests in CI on every endpoint |
| A tenant-less entry point is abused to reach a school (forged invite or reset link, fake payment webhook, enquiry spam) | Only the entry points listed in [02](02-architecture.md#tenant-less-entry-points-d16) exist. Signed links use HMAC-SHA256 with purpose, tenant, subject, expiry and nonce, verified server side and single use where stated; webhooks verify the gateway signature before any lookup; `embed_key` lookups and demo requests are rate-limited and captcha-protected; each lookup is a named security-definer function returning the minimum columns; each has a cross-tenant test |
| Platform code or a job reads across tenants by mistake | `withPlatform()` (the `quad_platform` role with `BYPASSRLS`) is allowed only in `apps/api/src/platform/**` and `apps/api/src/worker/platform-jobs/**`, enforced by lint; its writes go to `platform_audit` |
| Sign-in lookup reveals accounts or schools | The email step looks nothing up, and `POST /auth/password` and the OTP request answer the same way whether or not the account exists; memberships are returned only after the password or OTP step; `auth_memberships` is the only cross-tenant read and returns no personal data |
| A person switches into a school they no longer belong to | `select-school` and every request re-check that the membership and the tenant are active; deactivating a membership revokes that tenant's sessions |
| A parent reads another family's child | `student_guardians` check on every `/family` route; tests that swap ids |
| A relative in a family circle sees more than moments, or a restricted person is added | `kind: relative` tokens reach only the moments routes; tests on every other `/family` route; adding is refused for students with a contact restriction; any guardian or the school can remove at once |
| Photos of a child reach people the family did not agree to | Photo consent scope (`class`, `family`, `none`) checked by the API when a moment is created and when the feed is read; changes are audited |
| A staff member sees safeguarding records without the right | Sensitive key guard, view logging, and support view always blocked |
| Account takeover | Argon2id, breached-password check, lockout, TOTP (required for admins by default), session revocation, new-device email |
| Parent OTP abuse (SMS pumping) | Per-number and per-IP limits, country allowlist per school, captcha after 3 attempts, WAF rate rules on `/api/v1/auth/*`, a daily SMS spend cap per school and globally with alerts at 80% (OTP sending pauses for non-allowlisted countries when the global cap is hit), spend alerts |
| Store-review or demo backdoor reused | The fixed-OTP review number (`STORE_REVIEW_PHONE`) works only for its own number and only reaches the App Review demo school with fictional data; `DEV_FIXED_OTP` and `CONSOLE_PASSWORD_LOGIN` are refused at boot in production |
| Demo form or enquiry form spam | Turnstile captcha, 5 requests per hour per IP, honeypot field, WAF rules ([19](19-public-site.md#demo-requests)) |
| Payment tampering | The server computes amounts; signed gateway webhooks; idempotency keys; the client cannot mark paid |
| Prompt injection through records | Tool results are treated as data; read-only tools; actions only after a human presses a button |
| Malicious uploads | Type sniffing, ClamAV scan, SVG sanitising, no direct public bucket access |
| Insider support abuse | Reason required, 60-minute sessions, banner shown to the school, dual audit, no access to sensitive data |
| XSS and CSRF | React escaping, a strict CSP (no inline scripts; nonces for Next.js), SameSite cookies, a CSRF token on cookie-auth writes |
| Data leaks in logs | Structured logs with personal data redacted; no message bodies or phone numbers in logs |

## Data protection
- Encryption in transit everywhere (TLS 1.2+, HSTS). At rest: RDS and S3 encryption, plus field-level encryption (AES-256-GCM with keys from AWS KMS) for TOTP secrets, safeguarding entries, medical notes and gateway secrets.
- Compliance: Sri Lanka's Personal Data Protection Act No. 9 of 2022, GDPR for schools in the EU/UK, and UAE and Maldives data rules.
- Data subject requests: export a student's or guardian's data (JSON + PDF) and delete on request. Records the school must keep by law are retained and marked.
- Retention defaults: student records for 7 years after leaving; attendance for 7 years; safeguarding for 25 years from date of birth (configurable); Ask Quad conversations for 90 days (or none); audit for 7 years. The purge job below enforces these.

## Data residency (D21)

School data is stored and processed in AWS `ap-south-1` (Mumbai): database, files, queues, backups (with a daily snapshot copy to `ap-southeast-1` for disaster recovery). A short list of sub-processors handle limited data outside the region. The public list at `/legal/subprocessors` ([19](19-public-site.md#sub-processors-d21)) must match this table, and changes are announced to schools 30 days ahead.

| Sub-processor | What leaves the region | Controls |
|---|---|---|
| Anthropic (Ask Quad) | The question and the tool results needed to answer it | Never safeguarding or medical data ([11](11-ask-quad.md)); no training on the data; zero-retention terms where available; schools can turn Ask Quad off |
| Google Firebase (FCM) | Device push tokens, notification title and text | Notification text is kept short and avoids sensitive detail ("New message from Ms. Jayasinghe", not the message) |
| Sentry | Error reports | PII scrubbing on server and client; no request bodies |
| Amazon SES, Notify.lk, Twilio | Email address or phone number and message text | Only for delivery; SES sends from `ap-south-1` |
| Cloudflare Turnstile | IP and browser signals on the demo form | Public site only |

## Retention and purge

The `retention-purge` platform job (in `apps/api/src/worker/platform-jobs/`, runs nightly at 02:00 Asia/Colombo, uses `withPlatform`) processes each category in batches of 1,000 and writes counts to `platform_audit`:

| Category | Rule | Action |
|---|---|---|
| Soft-deleted rows ([S] tables) | 30 days after `deleted_at` | Hard delete, with dependent rows and files |
| Students who left | 7 years after leaving (school setting can extend) | Delete personal data; keep anonymised counts |
| Attendance | 7 years | Delete |
| Safeguarding | 25 years from date of birth (configurable per school) | Delete, with a record that it was deleted |
| Medical | 7 years after leaving | Delete |
| Ask Quad conversations | 90 days, or not kept if the school turned keeping off | Delete messages and tool results |
| Messages and moments | 3 years after the academic year ends (school setting) | Delete; photos removed from S3 |
| Notifications, push receipts | 90 days | Delete |
| Sessions, OTP challenges, used link nonces | 30 days after expiry | Delete |
| Import files and error reports | 30 days after the batch is final ([21](21-onboarding-import.md)) | Delete |
| Exports | 7 days | Delete from S3 |
| Platform leads that never converted | 24 months after the last update | Delete |
| Audit logs | 7 years | Delete (the only allowed delete, by the job's role) |

Records the school must keep by law have a `legal_holds` row and are skipped. Deleted S3 objects lose their noncurrent versions after 30 days; backups age out within 35 days. Tenant deletion across Postgres, S3, Redis and search is in [20](20-infrastructure-operations.md#tenant-deletion).
- Consent: photo consent and trip consent come from forms and are stored in `consents`. Moments respect photo consent, which guardians set per child in the parent app (class, family only, or no photos).
- Children never sign in to v1.

## Operational security
- Secrets in AWS Secrets Manager; nothing in the repo. `.env.example` lists names only.
- Dependency scanning (Renovate + `pnpm audit`), container image scanning, and CodeQL in CI.
- Backups: RDS point-in-time recovery (35 days), plus a daily snapshot copied to a second region. Restore drills every quarter, and a single-school restore procedure ([20](20-infrastructure-operations.md#backups-and-restore-drills)).
- DAST: an OWASP ZAP baseline scan of staging runs nightly from M12, and a full authenticated active scan (staff, console and parent API) runs before launch and before each major release. High findings block the release.
- Database roles: migrations as `quad_owner`, the app as `quad_app` (no `BYPASSRLS`), platform work as `quad_platform` through `withPlatform()` only ([02](02-architecture.md#database-roles-and-rls-d17)). Each role has its own secret and is rotated every 90 days.
- App store: release signing keys only in GitHub production secrets; store accounts with two admins and hardware-key two-step; the privacy labels and data safety form reviewed whenever data collection changes ([20](20-infrastructure-operations.md#app-store-publishing)).
- An external penetration test before the first school goes live, then yearly.
- An incident response runbook in `docs/runbooks/` (M12), with breach notification to schools within 72 hours ([20](20-infrastructure-operations.md#runbooks-docsrunbooks-m12)).
