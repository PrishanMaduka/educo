# 05 Auth, tenancy and permissions

## Sign-in flows

### Staff portal (`{school}.quad.school`)
Reference: the sign-in screens in `design/admin.html` (branded with the school's logo and colour).

1. **Single sign-on.** "Continue with Google Workspace" and "Continue with Microsoft 365" appear only when the school has turned them on. OIDC authorization code flow with PKCE. The ID token email must match the school's `sso_domain` and an active staff user. The first SSO sign-in links an `identities` row.
2. **Email and password.** Work email, then password (with Show/Hide), then "Keep me signed in on this device". Passwords are Argon2id with at least 10 characters (the school can set more) and are checked against a breached-password list (k-anonymity API).
3. **Two-step.** Required when the school's rule covers the user's role. TOTP (authenticator app) with 10 recovery codes. "Trust this device for 30 days" is optional.
4. **Forgot password.** An email link valid for 30 minutes, single use; all sessions are revoked on reset.
5. **Lockout.** Five failures in 15 minutes lock the account for 15 minutes and email the user.

Session: an opaque session id in a `__Host-` cookie (HttpOnly, Secure, SameSite=Lax). Idle timeout comes from the school setting (default 12 hours; 30 days with "keep me signed in"). The session row is in Postgres and cached in Redis.

### Platform console (`console.quad.school`)
Quad staff only: Google Workspace SSO for `@quad.school`, with mandatory TOTP. Separate cookie, session table rows with `kind='console'`, and an idle timeout of 8 hours. Every sign-in is written to `platform_audit`.

### Parent app
Reference: the lock and sign-in screens in `design/parent.html`.

1. Enter a mobile number (E.164, Sri Lanka default `+94`). The API sends a 6-digit OTP by SMS (rate limit: 3 per 15 minutes per number, 10 per day). Email OTP is the fallback when the guardian has an email and no SMS is delivered within 60 s.
2. On a valid OTP, the API finds guardian users with that phone across tenants and returns their memberships. If there are none, it shows "We couldn't find you. Ask your school to add this number."
3. Tokens: an access JWT (15 minutes; claims: sub, tid, kind, roles hash) and a rotating refresh token (60 days) kept in `flutter_secure_storage`. Reusing an old refresh token revokes the whole token family.
4. **Face ID / fingerprint unlock** (`local_auth`): after the first sign-in the app offers biometric unlock. It then gates opening the app and approving payments. "Use passcode" falls back to the device passcode.
5. Signing out on one device revokes that device's refresh family and push token.

## Roles

### Platform roles
`owner` (everything), `admin` (everything except platform users and billing settings), `support` (read schools, "Open as school admin" with a reason), `billing` (plans, subscriptions, platform invoices), `readonly`.

### School roles (system roles cannot be deleted; their permissions are fixed)
| Key | Name | Default access |
|---|---|---|
| `admin` | School admin | Everything in enabled modules; users and roles |
| `principal` | Principal | Everything except school settings; approves reports and offers |
| `finance` | Finance officer | Fees, finance, read students |
| `admissions` | Admissions officer | Admissions, CRM, read students |
| `teacher` | Teacher | Own classes: registers, gradebook, reports for own subjects, moments, behaviour; read timetable |
| `counsellor` | Counsellor | Pastoral and medical; safeguarding only if they hold the sensitive key |
| `frontdesk` | Front desk | Attendance (late arrivals), visitors, read contact details |

Assignments in Teachers & classes give extra scope automatically:
- **Class teacher** of a class: registration, class reports, parents' messages and moments for that class.
- **Section head / deputy** of a stage: read everything for students in the stage; approve reports in that stage; early-warning plans.

Custom roles come from the role builder in the console or the staff portal (Users & roles). They have a name, description, colour, a scope (whole school, campuses, own classes), start from an existing role, a permission matrix, sensitive-access switches and members.

### Permission matrix
Modules (rows): `admissions`, `crm`, `sis` (student records), `attendance`, `lms`, `fees`, `finance`, `transport`, `settings`. Actions (columns): `view`, `create`, `edit`, `delete`, `approve`. The rules mirror the prototype: unchecking View clears the whole row, and checking any other action checks View. A module that is not in the school's plan is shown with a "Not in plan" pill and cannot be granted.

Sensitive keys (off by default, all access logged): `safeguarding`, `medical`, `finance_reports`, `export_data`, `impersonate` (sign in as a staff user, for school admins).

Permission keys live in `packages/contracts/permissions.ts` (for example `sis.view`, `fees.approve`, `sensitive.safeguarding`). The API guards each route with `@Can('fees.create')`. Apps hide what the user cannot do, using `GET /me/permissions`.

Parents are not role-based: a guardian can read and act only for students linked to them in `student_guardians`, and each route checks that link.

## Plan and module guard

- A route that belongs to a module carries `@Module('lms')`. If the school's plan does not include the module, the API returns `403 { code: 'module_not_in_plan' }`, and the apps hide that navigation item.
- Seat limit: creating or enrolling a student beyond `seat_limit` returns `409 { code: 'seat_limit' }`. At 90% of the limit, the console's Needs you today suggests an upgrade.

## Support access ("Open as school admin")
Reference: the impersonation flow in `design/platform.html` and the support banner in `design/admin.html`.

- Needs the platform `support`, `admin` or `owner` role. The user must enter a reason (logged), and the session lasts at most 60 minutes.
- The staff portal shows a fixed banner: "Support view: you're in {school} as {name} from Quad. Everything you do here is logged in the school's audit log", with "Exit to platform".
- Safeguarding and medical records stay hidden in support view, whatever the role.
- Every write is recorded in both `audit_log` (school) and `platform_audit`.

## Audit
Write audit events for: sign-in and failures, role and permission changes, user invites and deactivation, exports, every view of a safeguarding case, every view of medical details, fee and invoice changes, refunds, report publishing, timetable publishing, settings changes, support sessions, and tenant status changes. Each school's Audit view is filterable; the platform has its own audit log.
