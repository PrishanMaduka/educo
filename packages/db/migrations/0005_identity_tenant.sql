CREATE TYPE "public"."permission_module" AS ENUM('admissions', 'crm', 'sis', 'attendance', 'lms', 'fees', 'finance', 'transport', 'settings');--> statement-breakpoint
CREATE TYPE "public"."sensitive_key" AS ENUM('safeguarding', 'medical', 'finance_reports', 'export_data');--> statement-breakpoint
CREATE TYPE "public"."role_scope" AS ENUM('school', 'campus', 'own_classes');--> statement-breakpoint
CREATE TYPE "public"."absence_alert_mode" AS ENUM('at_time', 'immediately');--> statement-breakpoint
CREATE TYPE "public"."early_warning_sharing" AS ENUM('off', 'after_plan', 'automatic');--> statement-breakpoint
CREATE TYPE "public"."photo_consent" AS ENUM('class', 'family', 'none');--> statement-breakpoint
CREATE TYPE "public"."sms_sender_status" AS ENUM('requested', 'approved');--> statement-breakpoint
CREATE TYPE "public"."membership_kind" AS ENUM('staff', 'guardian', 'relative');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('invited', 'active', 'deactivated');--> statement-breakpoint
CREATE TYPE "public"."theme_choice" AS ENUM('system', 'light', 'dark');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"actor_platform_user_id" uuid,
	"support_session_id" uuid,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" uuid,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip" "inet",
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"tenant_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"module" "permission_module" NOT NULL,
	"actions" bit(5) NOT NULL,
	CONSTRAINT "role_permissions_tenant_id_role_id_module_pk" PRIMARY KEY("tenant_id","role_id","module")
);
--> statement-breakpoint
CREATE TABLE "role_sensitive" (
	"tenant_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"key" "sensitive_key" NOT NULL,
	CONSTRAINT "role_sensitive_tenant_id_role_id_key_pk" PRIMARY KEY("tenant_id","role_id","key")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text,
	"system" boolean DEFAULT false NOT NULL,
	"scope" "role_scope" DEFAULT 'school' NOT NULL,
	"base_role_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "roles_tenant_id_key_unique" UNIQUE("tenant_id","key")
);
--> statement-breakpoint
CREATE TABLE "school_settings" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"office_email" "citext",
	"office_phone" text,
	"address" text,
	"ask_quad_enabled" boolean DEFAULT true NOT NULL,
	"ask_quad_keep_conversations" boolean DEFAULT true NOT NULL,
	"ew_share_with_parents" "early_warning_sharing" DEFAULT 'after_plan' NOT NULL,
	"absence_alert" "absence_alert_mode" DEFAULT 'at_time' NOT NULL,
	"absence_alert_time" time DEFAULT '09:00' NOT NULL,
	"reminder_days" integer[] DEFAULT '{-3,7,14}'::integer[] NOT NULL,
	"photo_consent_default" "photo_consent" DEFAULT 'class' NOT NULL,
	"family_circle_enabled" boolean DEFAULT true NOT NULL,
	"quiet_hours_enabled" boolean DEFAULT true NOT NULL,
	"quiet_from" time DEFAULT '18:00' NOT NULL,
	"quiet_until" time DEFAULT '07:00' NOT NULL,
	"quiet_weekends" boolean DEFAULT true NOT NULL,
	"sms_sender_id" text,
	"sms_sender_status" "sms_sender_status",
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"primary" boolean DEFAULT false NOT NULL,
	CONSTRAINT "user_roles_tenant_id_user_id_role_id_pk" PRIMARY KEY("tenant_id","user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"kind" "membership_kind" NOT NULL,
	"name" text NOT NULL,
	"email" "citext",
	"phone_e164" text,
	"avatar_file_id" uuid,
	"status" "membership_status" DEFAULT 'invited' NOT NULL,
	"locale" text,
	"theme" "theme_choice" DEFAULT 'system' NOT NULL,
	"last_sign_in_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "users_tenant_id_account_id_unique" UNIQUE("tenant_id","account_id")
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_platform_user_id_platform_users_id_fk" FOREIGN KEY ("actor_platform_user_id") REFERENCES "public"."platform_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_support_session_id_support_sessions_id_fk" FOREIGN KEY ("support_session_id") REFERENCES "public"."support_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_tenant_id_actor_user_id_users_fk" FOREIGN KEY ("tenant_id","actor_user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_tenant_id_role_id_roles_fk" FOREIGN KEY ("tenant_id","role_id") REFERENCES "public"."roles"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_sensitive" ADD CONSTRAINT "role_sensitive_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_sensitive" ADD CONSTRAINT "role_sensitive_tenant_id_role_id_roles_fk" FOREIGN KEY ("tenant_id","role_id") REFERENCES "public"."roles"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_settings" ADD CONSTRAINT "school_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_settings" ADD CONSTRAINT "school_settings_tenant_id_updated_by_users_fk" FOREIGN KEY ("tenant_id","updated_by") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_tenant_id_user_id_users_fk" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_tenant_id_role_id_roles_fk" FOREIGN KEY ("tenant_id","role_id") REFERENCES "public"."roles"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_tenant_id_at_idx" ON "audit_log" USING btree ("tenant_id","at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_log_tenant_id_actor_user_id_at_idx" ON "audit_log" USING btree ("tenant_id","actor_user_id","at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_log_tenant_id_action_at_idx" ON "audit_log" USING btree ("tenant_id","action","at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_log_actor_platform_user_id_idx" ON "audit_log" USING btree ("actor_platform_user_id") WHERE "audit_log"."actor_platform_user_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "audit_log_support_session_id_idx" ON "audit_log" USING btree ("support_session_id") WHERE "audit_log"."support_session_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "roles_tenant_id_system_idx" ON "roles" USING btree ("tenant_id","system");--> statement-breakpoint
CREATE UNIQUE INDEX "user_roles_one_primary_idx" ON "user_roles" USING btree ("tenant_id","user_id") WHERE "user_roles"."primary";--> statement-breakpoint
CREATE INDEX "user_roles_tenant_id_role_id_idx" ON "user_roles" USING btree ("tenant_id","role_id");--> statement-breakpoint
CREATE INDEX "users_tenant_id_kind_status_idx" ON "users" USING btree ("tenant_id","kind","status");--> statement-breakpoint
CREATE INDEX "users_tenant_id_email_idx" ON "users" USING btree ("tenant_id","email");--> statement-breakpoint
CREATE INDEX "users_account_id_idx" ON "users" USING btree ("account_id");--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_active_user_fk" FOREIGN KEY ("active_tenant_id","active_user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_preview_sample_user_fk" FOREIGN KEY ("active_tenant_id","preview_sample_user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_preview_role_fk" FOREIGN KEY ("active_tenant_id","preview_role_id") REFERENCES "public"."roles"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sessions_preview_role_idx" ON "sessions" USING btree ("active_tenant_id","preview_role_id") WHERE "sessions"."preview_role_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "sessions_preview_sample_user_idx" ON "sessions" USING btree ("active_tenant_id","preview_sample_user_id") WHERE "sessions"."preview_sample_user_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_school_ids_need_school" CHECK ("sessions"."active_tenant_id" IS NOT NULL OR num_nonnulls("sessions"."active_user_id", "sessions"."preview_role_id", "sessions"."preview_sample_user_id") = 0);--> statement-breakpoint
-- Hand-added (spec 02, D17; quad-tenant-table): tenantRlsSql(table) for each new tenant table:
-- ENABLE and FORCE row level security, the tenant_isolation policy for reads and writes, and DML
-- for quad_app. Each table also has an index led by tenant_id above (a primary key or unique
-- constraint where that is the access path).
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "users" FOR ALL USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "users" TO quad_app;
--> statement-breakpoint
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "roles" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "roles" FOR ALL USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "roles" TO quad_app;
--> statement-breakpoint
ALTER TABLE "role_permissions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "role_permissions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "role_permissions" FOR ALL USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "role_permissions" TO quad_app;
--> statement-breakpoint
ALTER TABLE "role_sensitive" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "role_sensitive" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "role_sensitive" FOR ALL USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "role_sensitive" TO quad_app;
--> statement-breakpoint
ALTER TABLE "user_roles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "user_roles" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "user_roles" FOR ALL USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "user_roles" TO quad_app;
--> statement-breakpoint
ALTER TABLE "school_settings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "school_settings" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "school_settings" FOR ALL USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "school_settings" TO quad_app;
--> statement-breakpoint
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "audit_log" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "audit_log" FOR ALL USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "audit_log" TO quad_app;
--> statement-breakpoint
-- Hand-added (quad-tenant-table, append-only tables): audit_log is insert-only. The shared
-- refuse_append_only_change() from 0003 refuses UPDATE, DELETE and TRUNCATE for every role,
-- even though tenantRlsSql grants quad_app UPDATE and DELETE.
CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON "audit_log" FOR EACH ROW EXECUTE FUNCTION refuse_append_only_change();--> statement-breakpoint
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON "audit_log" FOR EACH STATEMENT EXECUTE FUNCTION refuse_append_only_change();
