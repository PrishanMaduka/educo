# 04 Data model

Postgres 16, defined in Drizzle in `packages/db/schema/*.ts`. This document lists every table with its key columns. Claude Code should turn it into Drizzle schema files, one per area.

## Conventions

- Primary keys: `id uuid` (UUID v7, so they sort by time).
- Every school-owned table has `tenant_id uuid not null references tenants(id)` and an RLS policy. It is marked **[T]** below. Every table under a **[T]** heading carries `tenant_id`, including child tables such as `terms`, `year_groups`, `attendance_marks`, `invoice_lines` and `journal_lines`. The key-column lists below leave `tenant_id` out of child tables for brevity; the Drizzle schema must still add it, with a composite index starting with `tenant_id`.
- Row-level security: every [T] table has `ENABLE ROW LEVEL SECURITY` **and** `FORCE ROW LEVEL SECURITY`, with the policy `tenant_id = current_setting('app.tenant_id')::uuid` for select, insert, update and delete. Migrations run as the owner role `quad_owner`. The API and the worker connect as `quad_app` (no `BYPASSRLS`). Platform code and cross-tenant jobs (health snapshots, billing, retention purge, provisioning) use `withPlatform()` on a separate pool connecting as `quad_platform` (`BYPASSRLS`); a lint rule allows it only in `apps/api/src/platform/**` and `apps/api/src/worker/platform-jobs/**`. See [02](02-architecture.md#tenancy).
- Every new [T] table needs a cross-tenant test (see [17](17-testing-quality.md)).
- Timestamps: `created_at`, `updated_at` (`timestamptz`, defaults to now), and `deleted_at` on tables that support soft delete (marked **[S]**).
- Audit columns: `created_by`, `updated_by` (user ids) on editable records.
- Money: `amount_minor bigint` + `currency char(3)`.
- Enums are Postgres enums, mirrored in `packages/contracts/enums.ts`.
- Every foreign key has an index, and every `(tenant_id, …)` lookup has a composite index starting with `tenant_id`.
- Human-friendly numbers (`CIS-24100`, `APP-3301`, `INV-26-01040`, `SG-2610`) come from per-tenant sequences in `tenant_counters(tenant_id, key, value)`.

## Platform (no tenant_id)

Platform tables have no RLS policy and are reached only from console routes and platform jobs through `withPlatform()`. Some carry a `tenant_id` foreign key to say which school a row is about (subscriptions, check-ins), but they are not school-owned.

| Table | Key columns |
|---|---|
| `tenants` | id, name, short_name (≤4 chars), slug (unique; internal reference for support, search and exports, never used for routing), country, region enum(`ap-south`,`me-central`,`ap-southeast`), time_zone, currency, locale, status enum(`trial`,`onboarding`,`active`,`past_due`,`suspended`,`deleted`), plan_id, seat_limit, trial_ends_at, curriculum_template_id, since, health_override, suspended_at, suspend_reason (shown to the school's admins), deletion_scheduled_for, deleted_at |
| `tenant_branding` | tenant_id (pk), brand_color, logo_file_id, accent_mode, updated_at, published_at. There is no app-store name: every school uses the one Quad parent app (see [09](09-parent-app.md#start-up)) |
| `tenant_modules` | tenant_id, module enum(`admissions`,`crm`,`sis`,`lms`,`fees`,`finance`,`parent`,`transport`), enabled |
| `tenant_security` | tenant_id, two_step enum(`off`,`admins`,`staff`,`all`), password_min_length, session_hours, ip_allowlist text[] |
| `plans` | id, name, color, description, price_per_student_minor, currency, modules module[], student_limit, annual_discount_pct, trial_days, open_for_signup, featured, assistant_monthly_tokens (Ask Quad budget per school), archived_at |
| `plan_price_changes` | id, plan_id, old_price_minor, new_price_minor, applies enum(`next_invoice`,`renewal`,`new_only`), effective_from, created_by |
| `subscriptions` | id, tenant_id, plan_id, seats, billing_cycle enum(`monthly`,`annual`), status enum(`trialing`,`active`,`past_due`,`suspended`,`cancelled`), current_period_start/end, payment_method enum(`card`,`bank_transfer`), gateway enum(`payhere`,`stripe`) (Quad's own accounts), gateway_customer_ref, card_brand, card_last4, card_exp, billing_name, billing_email, billing_address, tax_id, past_due_since |
| `platform_invoices` | id, tenant_id, number ('Q-2610-0042'), period, subtotal_minor, tax_rate_bp, tax_minor, total_minor, currency, status enum(`draft`,`open`,`paid`,`failed`,`void`), due_at, paid_at, attempts, next_attempt_at, pdf_file_id |
| `platform_invoice_lines` | id, invoice_id, kind enum(`seats`,`proration`,`sms_usage`,`credit`,`other`), description, quantity, unit_minor, amount_minor |
| `tax_rates` | country, name ('VAT', 'SSCL'), rate_bp, registration_no, valid_from |
| `curriculum_templates` | id, name, short_name, description, grading_scale_id, built_in bool, version |
| `template_stages` | id, template_id, position, name, ages, color, default_sections, years text[] |
| `template_qualifications` | id, template_id, year_label, name |
| `grading_scales` | id, name, bands jsonb (`[{label:'A*', min:90}, …]`) |
| `platform_users` | id, name, email (unique), role enum(`owner`,`admin`,`support`,`billing`,`readonly`), password_hash, totp_secret_enc, totp_enabled, totp_last_step, status, locked_until, last_sign_in_at |
| `platform_audit` | id, actor_platform_user_id, action, target_type, target_id, tenant_id (nullable), ip, user_agent, meta jsonb, at |
| `support_sessions` | id, platform_user_id, tenant_id, reason, started_at, ended_at |
| `school_health_snapshots` | id, tenant_id, date, staff_weekly_active_pct, parent_app_pct, admin_last_sign_in_at, open_tickets, seats_used_pct, payment_status, score, level enum(`thriving`,`watch`,`at_risk`,`paused`) |
| `support_tickets` | id, tenant_id, opened_by_user_id, channel enum(`in_app`,`email`), subject, body, status enum(`open`,`waiting`,`closed`), priority, assignee_platform_user_id, opened_at, closed_at |
| `school_checkins` | id, tenant_id, with_user_id, with_name, at, how enum(`phone`,`video`,`visit`), notes, owner_platform_user_id, invite_sent bool, status enum(`planned`,`done`,`cancelled`), outcome |
| `platform_leads` | id, name, email, school_name, students_band enum(`under_300`,`300_1000`,`1000_2500`,`over_2500`), curriculum, country, source enum(`landing`,`referral`,`event`,`manual`), status enum(`new`,`contacted`,`demo_booked`,`won`,`lost`), owner_platform_user_id, notes, converted_tenant_id, ip_hash, user_agent, created_at |
| `platform_lead_notes` | id, lead_id, by_platform_user_id, text, at |
| `platform_user_prefs` | platform_user_id (pk), pinned_tenant_ids uuid[] (≤6), recent_tenant_ids uuid[] (last 4 opened), theme |
| `feature_flags` | id, tenant_id (nullable = global default), key, enabled, updated_by, updated_at; unique (tenant_id, key). Cached in Redis (see [15](15-cross-cutting.md#feature-flags)) |
| `signed_token_uses` | nonce (pk), purpose, used_at, expires_at. Records single-use signed tokens (see [Tenant-less lookups](#tenant-less-lookups-security-definer-functions)) |

## Identity (tenant-scoped unless noted)

| Table | Key columns |
|---|---|
| `accounts` (global, no tenant_id) | id, email citext (unique, nullable), phone_e164 (unique, nullable; at least one of the two), status enum(`active`,`locked`,`disabled`), created_at, last_sign_in_at. One per person across every school |
| `users` **[T][S]** | id, tenant_id, account_id, kind enum(`staff`,`guardian`,`relative`), name, email, phone_e164, avatar_file_id, status enum(`invited`,`active`,`deactivated`), locale, theme, last_sign_in_at; unique (tenant_id, account_id). This is the person's **membership** in one school |
| `credentials` (global) | account_id, password_hash (argon2id), totp_secret_enc, totp_enabled, recovery_codes_hash[]. One password and one authenticator for all of a person's schools |
| `sessions` | id, account_id or platform_user_id, active_tenant_id (nullable until a school is chosen), active_user_id, kind enum(`web`,`mobile`,`console`), refresh_hash, device_name, ip, user_agent, created_at, last_seen_at, expires_at, revoked_at |
| `devices` **[T]** | id, user_id, platform enum(`ios`,`android`), fcm_token, app_version, biometric_enabled, last_seen_at |
| `otp_challenges` | id, phone_e164 or email, code_hash, purpose, attempts, expires_at |
| `roles` **[T]** | id, tenant_id, key, name, description, color, system bool, scope enum(`school`,`campus`,`own_classes`), base_role_key |
| `role_permissions` **[T]** | role_id, module, actions bit(5) (view, create, edit, delete, approve) |
| `role_sensitive` **[T]** | role_id, key enum(`safeguarding`,`medical`,`finance_reports`,`export_data`) |
| `user_roles` **[T]** | user_id, role_id, primary bool |
| `staff_profiles` **[T]** | user_id, employee_no, job_title, department, subjects text[], is_primary_teacher bool, max_periods_per_week, start_date |
| `guardians` **[T]** | user_id, relationship default, address, occupation, preferred_channel enum(`app`,`sms`,`email`), sms_backup bool (also send urgent alerts by SMS) |
| `guardian_invites` **[T]** | id, tenant_id, guardian_user_id, student_ids uuid[], token_nonce, sent_via enum(`sms`,`email`,`letter`), sent_at, expires_at, used_at, created_by |
| `contact_change_requests` **[T]** | id, tenant_id, guardian_user_id, field enum(`phone`,`email`,`address`), old_value, new_value, status enum(`pending`,`approved`,`rejected`), reviewed_by, reviewed_at, note, created_at |
| `notification_prefs` **[T]** | user_id, channel, category enum(`absence`,`rewards`,`finance`,`news`,`moments`,`messages`,`events`), enabled |
| `staff_office_hours` **[T]** | id, user_id, weekday (1–5), starts, ends (`HH:mm`). Slots for "Ask for a 10-minute chat"; default 15:00–16:00 on school days when none are set |
| `tasks` **[T]** | id, tenant_id, user_id, title, due_on, done_at, created_at. "My tasks" on the dashboard |
| `school_settings` **[T]** | tenant_id (pk), office_email (Reply-To for emails), office_phone, ask_quad_enabled, ask_quad_keep_conversations, ew_share_with_parents enum(`off`,`after_plan`,`automatic`), absence_alert enum(`at_time`,`immediately`), absence_alert_time (default 09:00), reminder_days int[] (default {-3,7,14}), photo_consent_default enum(`class`,`family`,`none`), family_circle_enabled, quiet_hours_enabled, quiet_from (18:00), quiet_until (07:00), quiet_weekends bool, sms_sender_id, updated_by, updated_at |
| `audit_log` **[T]** | id, tenant_id, actor_user_id, actor_platform_user_id (support), action, target_type, target_id, meta jsonb, ip, at |

## Academic structure [T]

| Table | Key columns |
|---|---|
| `academic_years` | id, tenant_id, label ('2026/27'), starts_on, ends_on, status enum(`planning`,`current`,`closed`) |
| `terms` | id, academic_year_id, name, starts_on, ends_on, position |
| `holidays` | id, tenant_id, date, name (e.g. 'Vap Poya'), kind enum(`public`,`poya`,`school`,`mid_term`) |
| `stages` | id, tenant_id, academic_year_id, position, name, ages, color, kind enum(`early`,`primary`,`middle`,`exam`,`sixth`), enabled |
| `year_groups` | id, stage_id, position, label ('Year 4', 'Grade 9'), global_index (1..N across the school) |
| `classes` | id, year_group_id, name ('Emerald'), display ('Year 4 – Emerald'), room_id, class_teacher_user_id |
| `section_heads` | stage_id, user_id, kind enum(`head`,`deputy`) |
| `subjects` | id, tenant_id, name, short, color, icon, default_room_id |
| `year_group_subjects` | year_group_id, subject_id, periods_per_week, position |
| `rooms` | id, tenant_id, name, kind enum(`classroom`,`lab`,`hall`,`sports`,`studio`,`ict`), capacity |
| `bell_schedules` | id, stage_id, name, day_starts, periods jsonb (`[{kind:'lesson'|'break', label:'P1'|'Interval', start:'08:00', end:'08:40'}]`) |
| `teaching_assignments` | id, class_id, subject_id, teacher_user_id |
| `teacher_unavailability` | id, teacher_user_id, weekday (1–5), week ('A'/'B'/null), period_index (null = whole day), reason. Input to the timetable generator |
| `teaching_notes` | id, teacher_user_id, class_id, subject_id, student_id (nullable = whole class), text (≤120), updated_at. The "Working on with {child}" line |
| `timetable_versions` | id, tenant_id, academic_year_id, week_pattern enum(`A`,`AB`), status enum(`draft`,`published`), generated_at, published_at |
| `timetable_slots` | id, version_id, class_id, week ('A'/'B'), day (1–5), period_index, subject_id, teacher_user_id, room_id |
| `cover_absences` | id, tenant_id, teacher_user_id, date, part enum(`full`,`morning`,`afternoon`), reason |
| `cover_assignments` | id, absence_id, slot_id, date, cover_teacher_user_id, status enum(`requested`,`accepted`,`declined`), responded_at, published_at |

## Students and families [T]

| Table | Key columns |
|---|---|
| `students` **[S]** | id, tenant_id, admission_no ('CIS-24100'), first_name, last_name, preferred_name, dob (also the source of birthdays on the dashboard), gender, house_id, status enum(`active`,`on_leave`,`withdrawn`,`graduated`), admitted_on, previous_school, nationality, photo_file_id |
| `enrolments` | id, student_id, academic_year_id, class_id, starts_on, ends_on |
| `student_guardians` | student_id, guardian_user_id, relationship, primary bool, fee_payer bool, lives_with bool, can_collect bool |
| `houses` | id, tenant_id, name, color |
| `medical_conditions` | id, student_id, condition, severity enum(`low`,`med`,`high`), medication, storage, care_plan_review_on, emergency_contact, notes |
| `consents` | id, student_id, kind enum(`photo`,`trips`,`medical_treatment`), granted bool, photo_scope enum(`class`,`family`,`none`) (photo only), changed_by_user_id, source_form_response_id, updated_at |
| `pickup_people` | id, student_id, name, relationship, phone, photo_file_id, added_by_user_id, status enum(`pending`,`approved`,`rejected`), reviewed_by, reviewed_at, active |
| `gate_events` | id, student_id, at, gate, direction enum(`in`,`out`), source enum(`card`,`register`,`pickup_pass`,`bus`,`manual`), recorded_by. Feeds the "arrived" dot on the day ring |

## Attendance [T]

| Table | Key columns |
|---|---|
| `attendance_sessions` | id, class_id, date, kind enum(`am`,`pm`,`lesson`), slot_id, taken_by, taken_at |
| `attendance_marks` | session_id, student_id, code enum(`P`,`A`,`L`,`E`), minutes_late, reason, note |
| `absence_reports` | id, student_id, guardian_user_id, from_date, to_date, reason enum(`illness`,`appointment`,`family`,`other`), note, status enum(`new`,`acknowledged`) |

## Pastoral [T]

| Table | Key columns |
|---|---|
| `behaviour_entries` **[S]** | id, student_id, type enum(`merit`,`house`,`concern`,`detention`), reason_id, category, points, note, by_user_id, date, notified_parents bool, detention_on, updated_by |
| `behaviour_reasons` | id, tenant_id, polarity enum(`positive`,`negative`), label, default_points, active, position. The school's own reason lists |
| `sick_bay_visits` | id, student_id, at, complaint, treatment, outcome, parents_notified bool |
| `safeguarding_cases` | id, tenant_id, ref ('SG-2610'), student_id, category, level enum(`low`,`medium`,`high`), status enum(`open`,`monitoring`,`referred`,`closed`), lead_user_id, reported_by, reported_on |
| `safeguarding_entries` | id, case_id, at, by_user_id, text (encrypted at rest), attachments |
| `safeguarding_views` | case_id, user_id, at (every open is logged) |

## Early warning [T]

| Table | Key columns |
|---|---|
| `signal_snapshots` | id, tenant_id, student_id, computed_on, score, level enum(`high`,`med`), factors jsonb (`[{key:'att', weight:3, text, why, trend:[…]}]`), suggested_step, suggested_owner_user_id |
| `support_plans` | id, student_id, step, owner_user_id, review_on, agreed_note, tell_parents bool, status enum(`active`,`improving`,`closed`), created_by, created_at |
| `signal_dismissals` | student_id, by_user_id, reason, until |

## Learning [T]

| Table | Key columns |
|---|---|
| `courses` | id, class_id, subject_id, teacher_user_id, cover_color |
| `assignments` | id, course_id, title, description, due_at, max_marks, weight, kind enum(`homework`,`classwork`,`test`,`project`) |
| `submissions` | id, assignment_id, student_id, status enum(`missing`,`submitted`,`late`,`excused`), marks, feedback, submitted_at |
| `gradebook_categories` | id, course_id, name, weight |
| `gradebook_publications` | id, course_id, assignment_ids uuid[], published_at, published_by. Marks become visible in the parent app's Results only when published |

## Exams and reports [T]

| Table | Key columns |
|---|---|
| `exam_series` | id, tenant_id, name, kind enum(`internal`,`qualification`), qualification_name, starts_on, ends_on, status enum(`draft`,`published`), published_at |
| `exam_papers` | id, series_id, year_group_id, subject_id, paper ('Paper 1'), date, session enum(`AM`,`PM`), duration_min, room_id, candidates, invigilator_user_ids uuid[] |
| `report_cycles` | id, tenant_id, academic_year_id, name ('Term 1 report'), due_on, status enum(`draft`,`in_review`,`published`) |
| `report_class_status` | cycle_id, class_id, status enum(`draft`,`ready`,`sent_back`,`approved`,`published`), approved_by, sent_back_note, sent_back_by, published_at, unpublished_at |
| `report_entries` | cycle_id, student_id, subject_id, mark, grade, effort, comment, teacher_user_id |
| `report_class_comments` | cycle_id, student_id, class_teacher_comment, head_comment |
| `comment_bank` | id, tenant_id, subject_id (nullable = class-teacher comments), owner_user_id (nullable = shared), band enum(`excellent`,`good`,`steady`,`support`), text, position |

## Admissions and CRM [T]

| Table | Key columns |
|---|---|
| `applicants` **[S]** | id, ref ('APP-3301'), first/last name, dob, gender, nationality, languages, previous_school, siblings_note, year_group_applying_id, intake ('January 2027'), stage enum(`enquiry`,`application`,`assessment`,`interview`,`offer`,`enrolled`,`declined`), waitlisted_at (an applicant on the waitlist keeps its stage and shows a Waitlist pill), recommendation enum(`offer`,`waitlist`,`decline`) nullable, declined_reason, priority enum(`high`,`med`,`low`), source enum(`website`,`open_day`,`referral`,`facebook`,`walk_in`,`agent`), parent_name, parent_email, parent_phone, stage_entered_at, assigned_user_id |
| `applicant_guardians` | id, applicant_id, name, relationship, phone, email, main_contact bool |
| `applicant_documents` | id, applicant_id, kind enum(`birth_certificate`,`previous_report`,`photo`,`passport`,`medical`), file_id, status enum(`missing`,`requested`,`pending`,`verified`), requested_at, verified_by, verified_at |
| `applicant_assessments` | id, applicant_id, at, location, scores jsonb (`[{paper:'English', score:72, max:100}]`), benchmark (default 65), notes (staff only), recorded_by |
| `applicant_fees` | id, applicant_id, kind enum(`application`,`assessment`,`admission`,`deposit`), amount_minor, currency, status enum(`not_due`,`due`,`paid`,`refunded`), paid_at, payment_ref |
| `letter_templates` | id, tenant_id, kind enum(`offer`,`decline`,`waitlist`,`general`), name, subject, body (placeholders such as `{child}`, `{year_group}`, `{deposit}`) |
| `offers` | id, applicant_id, letter_template_id, sent_at, expires_on, admission_fee_minor, deposit_minor, currency, status enum(`sent`,`accepted`,`declined`,`expired`), responded_at |
| `applicant_notes` | id, applicant_id, by_user_id, text, at |
| `interviews` | id, applicant_id, at, with_user_id, location, outcome |
| `leads` | id, name, email, phone, source, interest_year_group_id, score (0–100), owner_user_id, status enum(`new`,`contacted`,`tour_booked`,`nurturing`,`cold`,`converted`), last_contact_at |
| `lead_activities` | id, lead_id, kind enum(`call`,`email`,`note`,`sms`,`meeting`), text, at, by_user_id |
| `campaigns` | id, name, channels text[], status enum(`scheduled`,`running`,`completed`), reach, opened_pct, clicked_pct, starts_on |
| `enquiry_forms` | id, name, fields jsonb, embed_key, active |

## Communication [T]

| Table | Key columns |
|---|---|
| `threads` | id, subject, kind enum(`direct`,`office`), student_id (context), created_at |
| `thread_participants` | thread_id, user_id, role_label, last_read_at, archived_at, muted_until |
| `messages` | id, thread_id, sender_user_id, body, attachments, created_at, edited_at |
| `message_templates` | id, tenant_id, owner_user_id (nullable = shared with the school), title, body, category |
| `broadcasts` | id, title, body, audience jsonb (year groups, classes, roles), channels text[], urgent bool (overrides preferences and quiet hours; adds SMS), recipients_count, sms_count, sms_cost_minor (estimate at send time), scheduled_at, sent_at, stats jsonb |
| `moments` **[S]** | id, tenant_id, by_user_id, role_label, class_id, student_id (nullable = whole class), kind enum(`photo`,`praise`,`work`), text (≤240), photo_file_id, art_key, skill enum(`confidence`,`kindness`,`teamwork`,`creativity`,`curiosity`,`perseverance`,`reading`,`problem_solving`) nullable, deliver_at (quiet hours), created_at |
| `moment_reactions` | moment_id, guardian_user_id, heart bool, thanks_text, at |
| `moment_reads` | moment_id, guardian_user_id, read_at |
| `learning_posts` | id, class_id, subject_id, by_user_id, week_start date, topic, why, try_home, minutes smallint (5–20), created_at; unique (class_id, subject_id, week_start) |
| `learning_tries` | learning_post_id, student_id, guardian_user_id, note (≤140), at; unique (learning_post_id, student_id) |
| `family_circle_members` | id, guardian_user_id (inviter), relative_user_id (nullable until joined), name, relation, phone_e164, status enum(`invited`,`joined`,`removed`), invited_at, joined_at, removed_at, removed_by |
| `family_circle_students` | member_id, student_id |
| `weekly_recaps` | id, student_id, week_start, payload jsonb (computed), created_at |
| `notifications` | id, user_id, category, title, body, deep_link, read_at, created_at |
| `news_posts` | id, title, summary, body, tag, cover_file_id, published_at, by_user_id |
| `stories` | id, name, icon, slides jsonb, published_at, expires_at |
| `story_reactions` | story_id, user_id, heart bool, at; unique (story_id, user_id) |
| `chat_requests` | id, student_id, guardian_user_id, staff_user_id, starts_at, minutes (10), mode enum(`in_person`,`phone`), status enum(`booked`,`cancelled`), thread_id, created_at; unique (staff_user_id, starts_at) where booked |

## Events and forms [T]

| Table | Key columns |
|---|---|
| `events` | id, kind enum(`parents_evening`,`options_evening`,`open_day`,`trip`,`meeting`,`other`), title, date, start_time, end_time, slot_minutes, year_group_ids uuid[], open bool, location |
| `event_teachers` | event_id, teacher_user_id, subjects text, is_class_teacher bool |
| `event_bookings` | id, event_id, teacher_user_id, start_time, guardian_user_id, student_id, status enum(`booked`,`cancelled`) — unique (event_id, teacher_user_id, start_time) where booked |
| `forms` | id, title, kind enum(`trip_consent`,`annual_consent`,`activity_signup`,`survey`), question, year_group_ids uuid[] (empty = all), deadline, amount_minor, currency, creates_invoice bool, closed_at |
| `form_responses` | id, form_id, student_id, guardian_user_id, answer bool, signature_name, signed_at, invoice_id |
| `trips` | id, title, description, date, depart_time, return_time, location, cost_minor, currency, places, form_id (consent), fee_item_id, year_group_ids uuid[], status enum(`draft`,`open`,`closed`,`cancelled`) |

## Fees and finance [T]

| Table | Key columns |
|---|---|
| `fee_items` | id, name, kind enum(`tuition`,`levy`,`transport`,`activity`,`materials`,`other`), default_amount_minor |
| `fee_structures` | id, academic_year_id, stage_id, term_id, items jsonb (`[{fee_item_id, amount_minor}]`) |
| `discount_rules` | id, name (≤40), kind enum(`sibling_2`,`sibling_3`,`staff_child`,`scholarship`,`early_payment`,`chosen`), percent numeric(5,2) (1–100, steps of 0.5), applies_to enum(`tuition`,`all`), active bool, sort_order |
| `billing_run_discounts` | billing_run_id, rule_id (nullable for run-only rules), name, kind, percent, applies_to, active |
| `student_discounts` | student_id, rule_id, percent_override, reason |
| `billing_runs` | id, term_id, due_on, instalments bool, options jsonb, status enum(`draft`,`created`,`sent`), totals jsonb, created_by |
| `invoices` **[S]** | id, number ('INV-26-01040'), student_id, billing_run_id, title, issued_on, due_on, status enum(`draft`,`sent`,`partially_paid`,`paid`,`overdue`,`void`), subtotal_minor, discount_minor, total_minor, paid_minor, currency, instalment_plan jsonb |
| `invoice_lines` | id, invoice_id, description, amount_minor, fee_item_id |
| `payments` | id, invoice_id (nullable for wallet top-ups), wallet_id (nullable), guardian_user_id, amount_minor, fee_minor (gateway fee), method enum(`card`,`wallet`,`bank_transfer`,`cash`,`cheque`), gateway enum(`payhere`,`stripe`,`manual`), gateway_account_id, gateway_ref, status enum(`pending`,`succeeded`,`failed`,`refunded`,`partially_refunded`), refunded_minor, settlement_id, received_at, receipt_no |
| `refunds` | id, payment_id, amount_minor, reason, status enum(`pending`,`succeeded`,`failed`), gateway_ref, requested_by, approved_by, created_at, completed_at |
| `payment_settings` | tenant_id (pk), payhere_enabled, stripe_enabled, bank_enabled, card_fee_payer enum(`school`,`parent`), instalments_allowed, part_payments_allowed, bank_details jsonb |
| `payment_gateway_accounts` | id, tenant_id, provider enum(`payhere`,`stripe`), mode enum(`test`,`live`), account_id (PayHere merchant id or Stripe account id; unique (provider, account_id)), credentials_enc (merchant secret or API keys, envelope-encrypted with KMS), webhook_secret_enc, apple_pay_enabled, google_pay_enabled, status enum(`draft`,`verified`,`failed`), verified_at, updated_by. The school's own merchant account (see [13](13-fees-payments-finance.md#who-owns-the-money)) |
| `settlements` | id, gateway_account_id, payout_ref, arrived_on, gross_minor, fee_minor, net_minor, status enum(`expected`,`matched`,`mismatch`), matched_at |
| `wallets` | id, student_id, balance_minor, daily_limit_minor |
| `wallet_transactions` | id, wallet_id, kind enum(`topup`,`purchase`,`refund`,`adjustment`), amount_minor, description, source enum(`app`,`staff`,`pos`), payment_id, by_user_id, at |
| `canteen_menu` | id, date, meal enum(`breakfast`,`snack`,`lunch`), description, allergens text[], price_minor |
| `reminders` | id, invoice_id, channel, sent_at |
| `ledger_accounts` | id, code, name, type enum(`asset`,`liability`,`equity`,`income`,`expense`), parent_id |
| `journal_entries` | id, date, memo, status enum(`draft`,`posted`), source enum(`manual`,`invoice`,`payment`) |
| `journal_lines` | id, entry_id, account_id, debit_minor, credit_minor |
| `budgets` | id, academic_year_id, account_id, amount_minor |

## Transport [T] (module `transport`)

| Table | Key columns |
|---|---|
| `routes` | id, name ('Route 4'), vehicle, driver_name, driver_phone |
| `route_stops` | id, route_id, position, name, lat, lng, scheduled_time |
| `route_students` | route_id, student_id, stop_id, direction enum(`am`,`pm`) |
| `trip_runs` | id, route_id, date, direction, status, positions jsonb (provider feed), started_at, ended_at |
| `pickup_passes` | id, student_ids uuid[], person_id (`pickup_people` or the guardian), created_by_user_id, valid_on date (a pass works for that day only), shared bool, token_hash, rotates_at, revoked_at |
| `pickup_scans` | id, pass_id, person_id, student_ids uuid[], scanned_by, gate, at, result enum(`ok`,`expired`,`not_approved`,`revoked`,`wrong_day`) |

## Ask Quad [T] (and platform)

| Table | Key columns |
|---|---|
| `assistant_conversations` | id, tenant_id (nullable for console), user_id or platform_user_id, app enum(`staff`,`parent`,`console`), created_at |
| `assistant_messages` | id, conversation_id, role, content jsonb (Claude content blocks, stored as returned), tool_calls jsonb, sources text[], tokens_in, tokens_out, latency_ms, created_at |
| `assistant_feedback` | message_id, rating enum(`up`,`down`), note |
| `assistant_usage` | tenant_id (nullable for console), month, tokens_in, tokens_out, cost_minor (USD cents), budget_tokens (from the plan), alerted_80_at, capped_at; unique (tenant_id, month) |

## Files

| Table | Key columns |
|---|---|
| `files` **[T]** | id, tenant_id, owner_user_id, bucket_key, mime, size, width, height, purpose enum(`logo`,`avatar`,`moment`,`document`,`attachment`,`report_pdf`), scanned enum(`pending`,`clean`,`infected`), created_at |

## Imports, retention and delivery

| Table | Key columns |
|---|---|
| `import_batches` **[T]** | id, tenant_id, entity, status enum(`uploaded`,`mapped`,`validated`,`committing`,`committed`,`failed`,`rolled_back`), file_id, mapping jsonb, counts jsonb, error_report_file_id, created_by, committed_at, rolled_back_at, rolled_back_by (rollback allowed for 7 days). See [21](21-onboarding-import.md) |
| `import_batch_rows` **[T]** | tenant_id, batch_id, row_no, action enum(`created`,`updated`,`linked`,`skipped`), target_type, target_id, before jsonb |
| `legal_holds` **[T]** | id, tenant_id, target_type, target_id, reason, set_by, set_at, released_at. Rows on hold are skipped by the retention purge (see [16](16-security-privacy.md)) |
| `email_suppressions` (platform) | address citext (pk), reason enum(`bounce`,`complaint`,`manual`), source, at. Filled from SES bounce and complaint notifications (see [20](20-infrastructure-operations.md)) |

## Tenant-less lookups (security-definer functions)

These are the **only** ways code finds a tenant without a session (see [05](05-auth-tenancy-rbac.md#tenant-less-entry-points)). Each is a `SECURITY DEFINER` function owned by `quad_owner`, granted `EXECUTE` to `quad_app`, with `search_path` pinned, returning the smallest possible row.

| Function | Returns | Used by |
|---|---|---|
| `auth_memberships(account_id)` | tenant id, tenant name, logo, colour, membership kind, role names for active memberships of active tenants | Sign-in and the school picker |
| `tenant_by_gateway_account(provider, account_id)` | tenant id, gateway account id, mode | Payment webhooks, after the gateway signature is verified |
| `tenant_by_embed_key(key)` | tenant id, enquiry form id, active | The public admissions enquiry form |

Signed tokens (password reset, staff invite, guardian invite, relative invite, support session, calendar feed and email deep links) carry the tenant id inside an HMAC-signed payload, so they need no lookup function. Single-use tokens record their nonce in `signed_token_uses`.
