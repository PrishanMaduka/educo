# 04 Data model

Postgres 16, defined in Drizzle in `packages/db/schema/*.ts`. This document lists every table with its key columns. Claude Code should turn it into Drizzle schema files, one per area.

## Conventions

- Primary keys: `id uuid` (UUID v7, so they sort by time).
- Every school-owned table has `tenant_id uuid not null references tenants(id)` and an RLS policy. It is marked **[T]** below.
- Timestamps: `created_at`, `updated_at` (`timestamptz`, defaults to now), and `deleted_at` on tables that support soft delete (marked **[S]**).
- Audit columns: `created_by`, `updated_by` (user ids) on editable records.
- Money: `amount_minor bigint` + `currency char(3)`.
- Enums are Postgres enums, mirrored in `packages/contracts/enums.ts`.
- Every foreign key has an index, and every `(tenant_id, …)` lookup has a composite index starting with `tenant_id`.
- Human-friendly numbers (`CIS-24100`, `APP-3301`, `INV-26-01040`, `SG-2610`) come from per-tenant sequences in `tenant_counters(tenant_id, key, value)`.

## Platform (no tenant_id)

| Table | Key columns |
|---|---|
| `tenants` | id, name, short_name (≤4 chars), subdomain (unique), custom_domain, country, region enum(`ap-south`,`me-central`,`ap-southeast`), time_zone, currency, locale, status enum(`trial`,`onboarding`,`active`,`past_due`,`suspended`,`deleted`), plan_id, seat_limit, trial_ends_at, curriculum_template_id, since, health_override, deleted_at |
| `tenant_branding` | tenant_id (pk), brand_color, logo_file_id, app_store_name, accent_mode, updated_at, published_at |
| `tenant_modules` | tenant_id, module enum(`admissions`,`crm`,`sis`,`lms`,`fees`,`finance`,`parent`,`transport`), enabled |
| `tenant_security` | tenant_id, sso_google bool, sso_microsoft bool, sso_domain, two_step enum(`off`,`admins`,`staff`,`all`), password_min_length, session_hours, ip_allowlist text[] |
| `plans` | id, name, color, description, price_per_student_minor, currency, modules module[], student_limit, annual_discount_pct, trial_days, open_for_signup, featured |
| `subscriptions` | id, tenant_id, plan_id, seats, billing_cycle enum(`monthly`,`annual`), status, current_period_start/end, gateway, gateway_ref |
| `platform_invoices` | id, tenant_id, number, period, amount_minor, currency, status enum(`draft`,`open`,`paid`,`failed`,`void`), due_at, paid_at, attempts |
| `curriculum_templates` | id, name, short_name, description, grading_scale_id, built_in bool, version |
| `template_stages` | id, template_id, position, name, ages, color, default_sections, years text[] |
| `template_qualifications` | id, template_id, year_label, name |
| `grading_scales` | id, name, bands jsonb (`[{label:'A*', min:90}, …]`) |
| `platform_users` | id, name, email (unique), role enum(`owner`,`admin`,`support`,`billing`,`readonly`), totp_secret_enc, status, last_sign_in_at |
| `platform_audit` | id, actor_platform_user_id, action, target_type, target_id, tenant_id (nullable), ip, user_agent, meta jsonb, at |
| `support_sessions` | id, platform_user_id, tenant_id, reason, started_at, ended_at |
| `school_health_snapshots` | id, tenant_id, date, staff_weekly_active_pct, parent_app_pct, admin_last_sign_in_at, open_tickets, seats_used_pct, payment_status, score, level enum(`thriving`,`watch`,`at_risk`,`paused`) |
| `support_tickets` | id, tenant_id, subject, status, priority, opened_at, closed_at |

## Identity (tenant-scoped unless noted)

| Table | Key columns |
|---|---|
| `users` **[T][S]** | id, tenant_id, kind enum(`staff`,`guardian`), name, email, phone_e164, avatar_file_id, status enum(`invited`,`active`,`deactivated`), locale, theme, last_sign_in_at |
| `credentials` | user_id, password_hash (argon2id), totp_secret_enc, totp_enabled, recovery_codes_hash[] |
| `identities` | id, user_id, provider enum(`google`,`microsoft`), subject, email |
| `sessions` | id, user_id or platform_user_id, kind enum(`web`,`mobile`,`console`), refresh_hash, device_name, ip, user_agent, created_at, last_seen_at, expires_at, revoked_at |
| `devices` **[T]** | id, user_id, platform enum(`ios`,`android`), fcm_token, app_version, biometric_enabled, last_seen_at |
| `otp_challenges` | id, phone_e164 or email, code_hash, purpose, attempts, expires_at |
| `roles` **[T]** | id, tenant_id, key, name, description, color, system bool, scope enum(`school`,`campus`,`own_classes`), base_role_key |
| `role_permissions` **[T]** | role_id, module, actions bit(5) (view, create, edit, delete, approve) |
| `role_sensitive` **[T]** | role_id, key enum(`safeguarding`,`medical`,`finance_reports`,`export_data`,`impersonate`) |
| `user_roles` **[T]** | user_id, role_id, primary bool |
| `staff_profiles` **[T]** | user_id, employee_no, job_title, department, subjects text[], is_primary_teacher bool, max_periods_per_week, start_date |
| `guardians` **[T]** | user_id, relationship default, address, occupation, preferred_channel enum(`app`,`sms`,`email`) |
| `notification_prefs` **[T]** | user_id, channel, category enum(`absence`,`rewards`,`finance`,`news`,`moments`,`messages`,`events`), enabled |
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
| `timetable_versions` | id, tenant_id, academic_year_id, week_pattern enum(`A`,`AB`), status enum(`draft`,`published`), generated_at, published_at |
| `timetable_slots` | id, version_id, class_id, week ('A'/'B'), day (1–5), period_index, subject_id, teacher_user_id, room_id |
| `cover_absences` | id, tenant_id, teacher_user_id, date, part enum(`full`,`morning`,`afternoon`), reason |
| `cover_assignments` | id, absence_id, slot_id, date, cover_teacher_user_id, published_at |

## Students and families [T]

| Table | Key columns |
|---|---|
| `students` **[S]** | id, tenant_id, admission_no ('CIS-24100'), first_name, last_name, preferred_name, dob, gender, house_id, status enum(`active`,`on_leave`,`withdrawn`,`graduated`), admitted_on, previous_school, nationality, photo_file_id |
| `enrolments` | id, student_id, academic_year_id, class_id, starts_on, ends_on |
| `student_guardians` | student_id, guardian_user_id, relationship, primary bool, fee_payer bool, lives_with bool, can_collect bool |
| `houses` | id, tenant_id, name, color |
| `medical_conditions` | id, student_id, condition, severity enum(`low`,`med`,`high`), medication, storage, care_plan_review_on, emergency_contact, notes |
| `consents` | id, student_id, kind enum(`photo`,`trips`,`medical_treatment`), granted bool, photo_scope enum(`class`,`family`,`none`) (photo only), changed_by_user_id, source_form_response_id, updated_at |
| `pickup_people` | id, student_id, name, relationship, phone, photo_file_id, active |

## Attendance [T]

| Table | Key columns |
|---|---|
| `attendance_sessions` | id, class_id, date, kind enum(`am`,`pm`,`lesson`), slot_id, taken_by, taken_at |
| `attendance_marks` | session_id, student_id, code enum(`P`,`A`,`L`,`E`), minutes_late, reason, note |
| `absence_reports` | id, student_id, guardian_user_id, from_date, to_date, reason enum(`illness`,`appointment`,`family`,`other`), note, status enum(`new`,`acknowledged`) |

## Pastoral [T]

| Table | Key columns |
|---|---|
| `behaviour_entries` **[S]** | id, student_id, type enum(`merit`,`house`,`concern`,`detention`), category, points, note, by_user_id, date, notified_parents bool, detention_on |
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

## Exams and reports [T]

| Table | Key columns |
|---|---|
| `exam_series` | id, tenant_id, name, kind enum(`internal`,`qualification`), qualification_name, starts_on, ends_on, status enum(`draft`,`published`), published_at |
| `exam_papers` | id, series_id, year_group_id, subject_id, paper ('Paper 1'), date, session enum(`AM`,`PM`), duration_min, room_id, candidates, invigilator_user_ids uuid[] |
| `report_cycles` | id, tenant_id, academic_year_id, name ('Term 1 report'), due_on, status enum(`draft`,`in_review`,`published`) |
| `report_class_status` | cycle_id, class_id, status enum(`draft`,`ready`,`approved`,`published`), approved_by |
| `report_entries` | cycle_id, student_id, subject_id, mark, grade, effort, comment, teacher_user_id |
| `report_class_comments` | cycle_id, student_id, class_teacher_comment, head_comment |

## Admissions and CRM [T]

| Table | Key columns |
|---|---|
| `applicants` **[S]** | id, ref ('APP-3301'), first/last name, dob, year_group_applying_id, intake ('January 2027'), stage enum(`enquiry`,`application`,`assessment`,`interview`,`offer`,`enrolled`,`declined`), priority enum(`high`,`med`,`low`), source enum(`website`,`open_day`,`referral`,`facebook`,`walk_in`,`agent`), parent_name, parent_email, parent_phone, stage_entered_at, assigned_user_id |
| `applicant_documents` | id, applicant_id, kind enum(`birth_certificate`,`previous_report`,`photo`,`passport`,`medical`), file_id, verified bool |
| `applicant_notes` | id, applicant_id, by_user_id, text, at |
| `interviews` | id, applicant_id, at, with_user_id, location, outcome |
| `leads` | id, name, email, phone, source, interest_year_group_id, score (0–100), owner_user_id, status enum(`new`,`contacted`,`tour_booked`,`nurturing`,`cold`,`converted`), last_contact_at |
| `lead_activities` | id, lead_id, kind, text, at, by_user_id |
| `campaigns` | id, name, channels text[], status enum(`scheduled`,`running`,`completed`), reach, opened_pct, clicked_pct, starts_on |
| `enquiry_forms` | id, name, fields jsonb, embed_key, active |

## Communication [T]

| Table | Key columns |
|---|---|
| `threads` | id, subject, kind enum(`direct`,`office`), student_id (context), created_at |
| `thread_participants` | thread_id, user_id, role_label, last_read_at |
| `messages` | id, thread_id, sender_user_id, body, attachments, created_at, edited_at |
| `broadcasts` | id, title, body, audience jsonb (year groups, classes, roles), channels text[], scheduled_at, sent_at, stats jsonb |
| `moments` **[S]** | id, tenant_id, by_user_id, role_label, class_id, student_id (nullable = whole class), kind enum(`photo`,`praise`,`work`), text (≤240), photo_file_id, art_key, skill enum(`confidence`,`kindness`,`teamwork`,`creativity`,`curiosity`,`perseverance`,`reading`,`problem_solving`) nullable, deliver_at (quiet hours), created_at |
| `moment_reactions` | moment_id, guardian_user_id, heart bool, thanks_text, at |
| `moment_reads` | moment_id, guardian_user_id, read_at |
| `learning_posts` | id, class_id, subject_id, by_user_id, week_start date, topic, why, try_home, minutes smallint (5–20), created_at; unique (class_id, subject_id, week_start) |
| `learning_tries` | learning_post_id, student_id, guardian_user_id, note (≤140), at; unique (learning_post_id, student_id) |
| `family_circle_members` | id, guardian_user_id (inviter), relative_user_id (nullable until joined), name, relation, phone_e164, status enum(`invited`,`joined`,`removed`), invited_at, joined_at, removed_at, removed_by |
| `family_circle_students` | member_id, student_id |
| `weekly_recaps` | id, student_id, week_start, payload jsonb (computed), created_at |
| `notifications` | id, user_id, category, title, body, deep_link, read_at, created_at |
| `news_posts` | id, title, body, tag, cover_file_id, published_at |
| `stories` | id, name, icon, slides jsonb, expires_at |

## Events and forms [T]

| Table | Key columns |
|---|---|
| `events` | id, kind enum(`parents_evening`,`options_evening`,`open_day`,`trip`,`meeting`,`other`), title, date, start_time, end_time, slot_minutes, year_group_ids uuid[], open bool, location |
| `event_teachers` | event_id, teacher_user_id, subjects text, is_class_teacher bool |
| `event_bookings` | id, event_id, teacher_user_id, start_time, guardian_user_id, student_id, status enum(`booked`,`cancelled`) — unique (event_id, teacher_user_id, start_time) where booked |
| `forms` | id, title, kind enum(`trip_consent`,`annual_consent`,`activity_signup`,`survey`), question, year_group_ids uuid[] (empty = all), deadline, amount_minor, currency, creates_invoice bool |
| `form_responses` | id, form_id, student_id, guardian_user_id, answer bool, signature_name, signed_at, invoice_id |
| `trips` | id, title, date, cost_minor, form_id, year_group_ids uuid[] |

## Fees and finance [T]

| Table | Key columns |
|---|---|
| `fee_items` | id, name, kind enum(`tuition`,`levy`,`transport`,`activity`,`materials`,`other`), default_amount_minor |
| `fee_structures` | id, academic_year_id, stage_id, term_id, items jsonb (`[{fee_item_id, amount_minor}]`) |
| `discount_rules` | id, name (≤40), kind enum(`sibling_2`,`sibling_3`,`staff_child`,`scholarship`,`early_payment`,`chosen`), percent numeric(5,2) (0.5–100), applies_to enum(`tuition`,`all`), active bool, sort_order |
| `billing_run_discounts` | billing_run_id, rule_id (nullable for run-only rules), name, kind, percent, applies_to, active |
| `student_discounts` | student_id, rule_id, percent_override, reason |
| `billing_runs` | id, term_id, due_on, instalments bool, options jsonb, status enum(`draft`,`created`,`sent`), totals jsonb, created_by |
| `invoices` **[S]** | id, number ('INV-26-01040'), student_id, billing_run_id, title, issued_on, due_on, status enum(`draft`,`sent`,`partially_paid`,`paid`,`overdue`,`void`), subtotal_minor, discount_minor, total_minor, paid_minor, currency, instalment_plan jsonb |
| `invoice_lines` | id, invoice_id, description, amount_minor, fee_item_id |
| `payments` | id, invoice_id, guardian_user_id, amount_minor, method enum(`card`,`wallet`,`bank_transfer`,`cash`,`cheque`), gateway enum(`payhere`,`stripe`,`manual`), gateway_ref, status enum(`pending`,`succeeded`,`failed`,`refunded`), received_at, receipt_no |
| `payment_settings` | tenant_id (pk), payhere_enabled, stripe_enabled, bank_enabled, card_fee_payer enum(`school`,`parent`), instalments_allowed, part_payments_allowed, bank_details jsonb, gateway_secrets_ref |
| `wallets` | id, student_id, balance_minor, daily_limit_minor |
| `wallet_transactions` | id, wallet_id, kind enum(`topup`,`purchase`,`refund`), amount_minor, description, at |
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
| `pickup_passes` | id, student_ids uuid[], person_id, token_hash, rotates_at |

## Ask Quad [T] (and platform)

| Table | Key columns |
|---|---|
| `assistant_conversations` | id, tenant_id (nullable for console), user_id or platform_user_id, app enum(`staff`,`parent`,`console`), created_at |
| `assistant_messages` | id, conversation_id, role, content jsonb (Claude content blocks, stored as returned), tool_calls jsonb, sources text[], tokens_in, tokens_out, latency_ms, created_at |
| `assistant_feedback` | message_id, rating enum(`up`,`down`), note |

## Files

| Table | Key columns |
|---|---|
| `files` **[T]** | id, tenant_id, owner_user_id, bucket_key, mime, size, width, height, purpose enum(`logo`,`avatar`,`moment`,`document`,`attachment`,`report_pdf`), scanned enum(`pending`,`clean`,`infected`), created_at |
