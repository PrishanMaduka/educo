# 16 Security and privacy

Quad holds children's data, so every design choice errs on the side of least access.

## Principles
- **Least privilege:** each role sees only its modules and scope. Parents see only their own children.
- **Defence in depth:** permission guards in the API, plus Postgres row-level security per tenant, plus tests that try to break both.
- **Sensitive data is separate:** safeguarding and medical data need explicit sensitive keys, every view is logged, and neither ever goes to Ask Quad or early warning.

## Threat model (main risks and controls)
| Risk | Control |
|---|---|
| One school reads another school's data | Tenant from the session only (never from the host, path, body or the `?school=` hint); RLS on every table; cross-tenant tests in CI on every endpoint |
| Sign-in lookup reveals accounts or schools | `POST /auth/identify` answers the same way whether or not the account exists; memberships are returned only after the password, SSO or OTP step; `auth_memberships` is the only cross-tenant read and returns no personal data |
| A person switches into a school they no longer belong to | `select-school` and every request re-check that the membership and the tenant are active; deactivating a membership revokes that tenant's sessions |
| A parent reads another family's child | `student_guardians` check on every `/family` route; tests that swap ids |
| A relative in a family circle sees more than moments, or a restricted person is added | `kind: relative` tokens reach only the moments routes; tests on every other `/family` route; adding is refused for students with a contact restriction; any guardian or the school can remove at once |
| Photos of a child reach people the family did not agree to | Photo consent scope (`class`, `family`, `none`) checked by the API when a moment is created and when the feed is read; changes are audited |
| A staff member sees safeguarding records without the right | Sensitive key guard, view logging, and support view always blocked |
| Account takeover | Argon2id, breached-password check, lockout, TOTP (required for admins by default), SSO, session revocation, new-device email |
| Parent OTP abuse (SMS pumping) | Per-number and per-IP limits, country allowlist per school, captcha after 3 attempts, spend alerts |
| Payment tampering | The server computes amounts; signed gateway webhooks; idempotency keys; the client cannot mark paid |
| Prompt injection through records | Tool results are treated as data; read-only tools; actions only after a human presses a button |
| Malicious uploads | Type sniffing, ClamAV scan, SVG sanitising, no direct public bucket access |
| Insider support abuse | Reason required, 60-minute sessions, banner shown to the school, dual audit, no access to sensitive data |
| XSS and CSRF | React escaping, a strict CSP (no inline scripts; nonces for Next.js), SameSite cookies, a CSRF token on cookie-auth writes |
| Data leaks in logs | Structured logs with personal data redacted; no message bodies or phone numbers in logs |

## Data protection
- Encryption in transit everywhere (TLS 1.2+, HSTS). At rest: RDS and S3 encryption, plus field-level encryption (AES-256-GCM with keys from AWS KMS) for TOTP secrets, safeguarding entries, medical notes and gateway secrets.
- Compliance: Sri Lanka's Personal Data Protection Act No. 9 of 2022, GDPR for schools in the EU/UK, and UAE and Maldives data rules. Data stays in the school's region (v1: `ap-south-1`).
- Data subject requests: export a student's or guardian's data (JSON + PDF) and delete on request. Records the school must keep by law are retained and marked.
- Retention defaults: student records for 7 years after leaving; attendance for 7 years; safeguarding for 25 years from date of birth (configurable); Ask Quad conversations for 90 days (or none); audit for 7 years. The `purge-deleted` job enforces these.
- Consent: photo consent and trip consent come from forms and are stored in `consents`. Moments respect photo consent, which guardians set per child in the parent app (class, family only, or no photos).
- Children never sign in to v1.

## Operational security
- Secrets in AWS Secrets Manager; nothing in the repo. `.env.example` lists names only.
- Dependency scanning (Renovate + `pnpm audit`), container image scanning, and CodeQL in CI.
- Backups: RDS point-in-time recovery (35 days), plus a daily snapshot copied to a second region. Restore drills every quarter.
- An external penetration test before the first school goes live, then yearly.
- An incident response runbook in `docs/runbooks/` (M12).
