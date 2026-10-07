# 05 Auth, tenancy and permissions

## Sign-in flows

### Staff portal (`quad-edu.com`)
References: the **sign-in dialog on `design/landing.html`** is the primary reference for the flow and copy (Quad-branded, since the school is not known yet). The sign-in screen in `design/admin.html` is the reference for the standalone `/sign-in` page, which runs the same steps (used for deep links, expired sessions and sign-out).

Every school's staff use the same address. Sign-in is **identifier first**:
1. **Work email.** `POST /auth/identify {email}` always answers the same shape, whether or not the account exists (no account enumeration): `{methods: ['password'] | ['sso:google'|'sso:microsoft', 'password']}`. SSO buttons appear when the email's domain matches the `sso_domain` of a school that has SSO on. Rate-limited per IP and per email.
2. **Single sign-on.** OIDC authorization code flow with PKCE. The ID token email must match the school's `sso_domain` and an active staff membership. The first SSO sign-in links an `identities` row to the account.
3. **Email and password.** Work email, then password (with Show/Hide), then "Keep me signed in on this device". Passwords are Argon2id with at least 10 characters (the school can set more) and are checked against a breached-password list (k-anonymity API).
4. **Two-step.** Required when the rule of any school the person belongs to covers their role there (the strictest rule wins, because one account opens all of them). TOTP (authenticator app) with 10 recovery codes. "Trust this device for 30 days" is optional.
5. **Choose a school.** The API reads the account's active staff memberships (`auth_memberships`). None: "This account isn't linked to a school yet. Ask your school's admin to invite you." One: open it. Several: a list of schools (logo, name, your role) and "Remember my choice on this device". The session stores `active_tenant_id`; the staff portal then loads that school's branding.
6. **Forgot password.** A signed email link (see [Tenant-less entry points](#tenant-less-entry-points)) valid for 30 minutes, single use; all sessions are revoked on reset.
7. **Lockout.** Five failures in 15 minutes lock the account for 15 minutes and email the user.

Switching school (profile menu → the other schools) re-checks the membership, rotates the session id and reloads `/app`. Signing out ends the session for every school.

The sign-in page may remember the last school on the device (a non-sensitive `quad_last_school` cookie holding its name and logo URL) to say "Welcome back to Colombo International School". It never pre-selects a tenant on the server.

Session: an opaque session id in a `__Host-` cookie (HttpOnly, Secure, SameSite=Lax) on `quad-edu.com`. Idle timeout comes from the school setting (default 12 hours; 30 days with "keep me signed in"). The session row is in Postgres and cached in Redis.

### Platform console (`console.quad-edu.com`)
Quad staff only. Separate cookie, session rows with `kind='console'`, an idle timeout of 8 hours, and every sign-in (and failure) written to `platform_audit`.

- **Production:** Google Workspace SSO for `@quad-edu.com` accounts that exist in `platform_users` with status active, then mandatory TOTP. There is no password sign-in.
- **Local, dev and staging:** SSO as above, plus email + password + TOTP for seeded platform users (for example `owner@quad.local`), enabled only by the environment flag `CONSOLE_PASSWORD_LOGIN=true`. The API refuses to boot in production if the flag is set.
- New platform users are invited from **Platform users** (see [07](07-platform-console.md#platform-users)); they set up TOTP on first sign-in.

### Parent app
Reference: the sign-in and lock screens in `design/parent.html` (the welcome screen is Quad-branded in production, see [09](09-parent-app.md#start-up)).

1. **Welcome:** "Sign in" and "I have an invite code".
2. **Phone or email.** A mobile number with a country-code picker (Sri Lanka `+94` by default; the list covers the countries Quad serves), validated per country (9 digits after +94, without the leading 0). "Use email instead" switches to an email address. Copy: "We'll send you a 6-digit code. Use the mobile number the school has on file for you."
3. **OTP.** The API sends a 6-digit code by SMS (or email), valid for 10 minutes. Rate limit: 3 per 15 minutes per number or address, 10 per day. Resend after 30 s. Email OTP is also offered when the guardian has an email and no SMS is delivered within 60 s. The response is the same whether or not the number is known.
4. **Found you.** On a valid OTP the API finds the account with that phone (or email) and returns its guardian and relative memberships (`auth_memberships`). The app shows "You're signed in. Welcome, {first name}. We found {n} children at {school}." with the children's avatars. With several schools it shows the school picker first. With none: "We couldn't find you. Ask your school to add this number."
5. **Tokens:** an access JWT (15 minutes; claims: sub, tid, kind, roles hash) and a rotating refresh token (60 days) kept in `flutter_secure_storage`. Reusing an old refresh token revokes the whole token family.
6. **Face ID / fingerprint** (`local_auth`): "Unlock with Face ID?" (Turn on / Not now), then "Allow notifications?". Biometric unlock then gates opening the app, re-opening it after 5 minutes in the background, and approving payments. "Use passcode" falls back to the device passcode.
7. Signing out on one device revokes that device's refresh family and push token, and wipes the local cache.

**Invite codes.** When a school adds a guardian (enrolment, import or the student's Guardians tab) it can send an invite by SMS, email or a printed letter. The invite is a signed token (purpose `guardian_invite`, 30 days, single use) delivered as a link `https://quad-edu.com/p/invite/{token}` and as a QR code. Opening the link opens the app (or the "Get the Quad app" page). "I have an invite code" opens a QR scanner with a paste field. The invite confirms the guardian's name and phone, then continues with the normal OTP step; it never signs anyone in by itself. Relative invites (family circle) work the same way with purpose `relative_invite`.

### Account edge cases
- **Invite to an existing account.** A staff invite or guardian invite to an email or phone that already has an account adds a membership to that account; it never creates a second account or asks for a new password. The person accepts with the signed link while signed in, or after signing in, and the school appears in their picker.
- **One parent, two schools.** Two schools that each add the same phone number reach the same account. The app shows the school picker at sign-in and **Switch school** in More. Each school sees only its own membership and children.
- **Phone or email already in use.** Changing a membership's phone or email (by the school, by import, or through a parent's approved contact change) to a value that belongs to another account is refused with "This number is already used by another Quad account. Ask Quad support to merge them." Support merges accounts in the console with a logged reason. A parent's own contact changes go to the school for review first (see [09](09-parent-app.md#more)).
- **Changing your own sign-in.** Changing the account's phone or email needs an OTP to the new value and the current two-step method, and emails the old address.
- **Leaving a school.** Deactivating a membership revokes that school's sessions and tokens; the account and other memberships stay.

### Tenant-less entry points
The tenant comes from the session or token (the membership chosen at sign-in). The only exceptions are the entry points below, which find the tenant from a **verified signed token** or one of the named security-definer lookups ([04](04-data-model.md#tenant-less-lookups-security-definer-functions)). Never from plain request input, the URL or the host.

| Entry point | How the tenant is found |
|---|---|
| Sign-in | `auth_memberships(account_id)` after the password, SSO or OTP step; the chosen membership goes on the session |
| Signed links: password reset, staff invite, guardian invite, relative invite, support session, calendar feed, links in emails | A token `base64url(payload).base64url(HMAC-SHA256(payload, LINK_SIGNING_SECRET))` with payload `{purpose, tid, sub, exp, nonce}`. The server checks the signature, purpose and expiry; single-use purposes record the nonce in `signed_token_uses`. Only then is `tid` used. A token never grants a session by itself; the person still signs in (except the support session, which is created by the console) |
| Payment webhooks (PayHere, Stripe) | Verify the gateway signature first, then `tenant_by_gateway_account(provider, account_id)` |
| Public admissions enquiry form | `tenant_by_embed_key(key)`; rate-limited and captcha-checked |
| Demo requests from the landing page | Platform level, no tenant (`platform_leads`) |
| SES bounce and complaint webhook | No tenant: the SNS topic, signing certificate URL, signature (version 2) and replay window are checked first, then `record_email_suppression` writes the platform table `email_suppressions` |

Rules: every tenant-less route lives in `apps/api/src/public/**` or `apps/api/src/webhooks/**`, has an integration test for a forged or expired token, and opens `withTenant()` only after the check.

## Roles

### Platform roles
`owner` (everything), `admin` (everything except platform users and billing settings), `support` (read schools, "Open as school admin" with a reason), `billing` (plans, subscriptions, platform invoices), `readonly`.

### School roles (system roles cannot be deleted; their permissions are fixed)
| Key | Name | Default access |
|---|---|---|
| `admin` | School admin | Everything in enabled modules; users and roles; school settings |
| `principal` | Principal | Everything except school settings; approves reports and offers |
| `finance` | Finance officer | Fees, finance, read students |
| `admissions` | Admissions officer | Admissions, CRM, read students |
| `teacher` | Teacher | Own classes: registers, gradebook, reports for own subjects, moments, behaviour; read timetable |
| `counsellor` | Counsellor | Pastoral and medical; safeguarding only if they hold the sensitive key |
| `frontdesk` | Front desk | Attendance (late arrivals), visitors, pickup-pass scanner, read contact details |

Assignments in Teachers & classes give extra scope automatically:
- **Class teacher** of a class: registration, class reports, parents' messages and moments for that class.
- **Section head / deputy** of a stage: read everything for students in the stage; approve reports in that stage; early-warning plans.

**Previewing a role:** school admins can preview the staff portal as any role (see [08](08-staff-portal.md#users--roles)). The session keeps the admin's identity and adds `preview_role_id`; guards evaluate the previewed role, writes are refused, and the audit log records the start and end. Support's "sign in as" (console only) is a different, reasoned, time-limited session.

Custom roles come from the role builder in the console or the staff portal (Users & roles). They have a name, description, colour, a scope (whole school, campuses, own classes), start from an existing role, a permission matrix, sensitive-access switches and members.

### Permission matrix
Modules (rows): `admissions`, `crm`, `sis` (student records), `attendance`, `lms`, `fees`, `finance`, `transport`, `settings`. Actions (columns): `view`, `create`, `edit`, `delete`, `approve`. The rules mirror the prototype: unchecking View clears the whole row, and checking any other action checks View. A module that is not in the school's plan is shown with a "Not in plan" pill and cannot be granted.

Sensitive keys (off by default, all access logged): `safeguarding`, `medical`, `finance_reports`, `export_data`.

**"Sign in as" is console-only.** Schools cannot impersonate their own staff. Quad support can, through support access below. School admins manage accounts with Remind (two-step), Reset password and Sign out everywhere (see [08](08-staff-portal.md#users--roles)).

Permission keys live in `packages/contracts/permissions.ts` (for example `sis.view`, `fees.approve`, `sensitive.safeguarding`, `settings.edit`, `circle.connection.read`). The API guards each route with `@Can('fees.create')`. Apps hide what the user cannot do, using `GET /me/permissions`.

Parents are not role-based: a guardian can read and act only for students linked to them in `student_guardians`, and each route checks that link.

**Relatives (family circle).** A relative invited by a guardian signs in with phone and OTP like a guardian, but gets a token with `kind: relative`. Relative tokens reach only `GET /family/moments`, `POST /family/moments/:id/heart`, `GET /family/me` and sign-out, and only for students linked through `family_circle_students` whose member status is `joined`. Every other `/family` route returns 403 for them. Removing a relative revokes their refresh tokens at once.

## Plan and module guard

- A route that belongs to a module carries `@Module('lms')`. If the school's plan does not include the module, the API returns `403 { code: 'module_not_in_plan' }`, and the apps hide that navigation item.
- Seat limit: creating or enrolling a student beyond `seat_limit` returns `409 { code: 'seat_limit' }`. At 90% of the limit, the console's Needs you today suggests an upgrade.
- A suspended school: every staff and parent request returns `403 { code: 'school_suspended', message: <suspend reason> }`, and the apps show the reason with the school's contact details. Payment webhooks and data export still work.

## Support access ("Open as school admin")
Reference: the impersonation flow in `design/platform.html` and the support banner in `design/admin.html`.

- Needs the platform `support`, `admin` or `owner` role. The user must always enter a reason (logged), and the session lasts at most 60 minutes. The console creates a single-use signed link (purpose `support_session`, 2 minutes) that opens the staff portal.
- The staff portal shows a fixed banner: "Support view: you're in {school} as {name} from Quad. Everything you do here is logged in the school's audit log", with "Exit to platform".
- Safeguarding and medical records stay hidden in support view, whatever the role.
- Every write is recorded in both `audit_log` (school) and `platform_audit`.

## Audit
Write audit events for: sign-in and failures, role and permission changes, user invites and deactivation, password resets and "sign out everywhere", exports, every view of a safeguarding case, every view of medical details, fee and invoice changes, refunds, gateway credential changes, report publishing and unpublishing, timetable publishing, settings changes, data imports and rollbacks, support sessions, account merges and tenant status changes. Each school's Audit view (Settings → Audit, see [08](08-staff-portal.md#school-settings)) is filterable; the platform has its own audit log.
