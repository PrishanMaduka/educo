CREATE TYPE "public"."sso_provider" AS ENUM('google', 'microsoft');--> statement-breakpoint
CREATE TYPE "public"."otp_channel" AS ENUM('sms', 'email');--> statement-breakpoint
CREATE TYPE "public"."session_kind" AS ENUM('web', 'mobile', 'console');--> statement-breakpoint
CREATE TYPE "public"."session_stage" AS ENUM('two_step', 'two_step_setup', 'choose_school', 'active');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" "citext",
	"phone_e164" text,
	"status" "account_status" DEFAULT 'active' NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_sign_in_at" timestamp with time zone,
	CONSTRAINT "accounts_email_unique" UNIQUE("email"),
	CONSTRAINT "accounts_phone_e164_unique" UNIQUE("phone_e164"),
	CONSTRAINT "accounts_email_or_phone" CHECK ("accounts"."email" IS NOT NULL OR "accounts"."phone_e164" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "credentials" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"password_hash" text,
	"totp_secret_enc" text,
	"totp_enabled" boolean DEFAULT false NOT NULL,
	"recovery_codes_hash" text[] DEFAULT '{}'::text[] NOT NULL,
	"password_changed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"provider" "sso_provider" NOT NULL,
	"subject" text NOT NULL,
	"email" "citext",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "identities_provider_subject_unique" UNIQUE("provider","subject")
);
--> statement-breakpoint
CREATE TABLE "otp_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_hash" "bytea" NOT NULL,
	"channel" "otp_channel" NOT NULL,
	"code_hash" "bytea" NOT NULL,
	"purpose" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid,
	"platform_user_id" uuid,
	"active_tenant_id" uuid,
	"active_user_id" uuid,
	"kind" "session_kind" NOT NULL,
	"stage" "session_stage" NOT NULL,
	"token_hash" "bytea",
	"refresh_hash" "bytea",
	"refresh_generation" integer DEFAULT 0 NOT NULL,
	"keep_signed_in" boolean DEFAULT false NOT NULL,
	"preview_role_id" uuid,
	"preview_sample_user_id" uuid,
	"support_session_id" uuid,
	"device_name" text,
	"ip" "inet",
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "sessions_one_owner" CHECK (num_nonnulls("sessions"."account_id", "sessions"."platform_user_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "trusted_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"token_hash" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "trusted_devices_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identities" ADD CONSTRAINT "identities_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_platform_user_id_platform_users_id_fk" FOREIGN KEY ("platform_user_id") REFERENCES "public"."platform_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_active_tenant_id_tenants_id_fk" FOREIGN KEY ("active_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_support_session_id_support_sessions_id_fk" FOREIGN KEY ("support_session_id") REFERENCES "public"."support_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trusted_devices" ADD CONSTRAINT "trusted_devices_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "identities_account_id_idx" ON "identities" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "otp_challenges_subject_hash_created_at_idx" ON "otp_challenges" USING btree ("subject_hash","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sessions_account_id_revoked_at_idx" ON "sessions" USING btree ("account_id","revoked_at");--> statement-breakpoint
CREATE INDEX "sessions_active_tenant_id_active_user_id_idx" ON "sessions" USING btree ("active_tenant_id","active_user_id");--> statement-breakpoint
CREATE INDEX "sessions_platform_user_id_idx" ON "sessions" USING btree ("platform_user_id");--> statement-breakpoint
CREATE INDEX "sessions_support_session_id_idx" ON "sessions" USING btree ("support_session_id");--> statement-breakpoint
CREATE INDEX "trusted_devices_account_id_idx" ON "trusted_devices" USING btree ("account_id");--> statement-breakpoint
-- Hand-added (D32, account tables): accountRlsSql(table, key, privileges) for each entry of
-- ACCOUNT_TABLES. RLS keys on app.account_id (set by withAccount): id on accounts, account_id on
-- the others. Console sessions (account_id null) are therefore invisible to quad_app; console code
-- reaches them through withPlatform. quad_app gets exactly the privileges ACCOUNT_TABLES declares.
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "accounts" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY account_isolation ON "accounts" FOR ALL USING (id = nullif(current_setting('app.account_id', true), '')::uuid) WITH CHECK (id = nullif(current_setting('app.account_id', true), '')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "accounts" TO quad_app;
--> statement-breakpoint
ALTER TABLE "credentials" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "credentials" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY account_isolation ON "credentials" FOR ALL USING (account_id = nullif(current_setting('app.account_id', true), '')::uuid) WITH CHECK (account_id = nullif(current_setting('app.account_id', true), '')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "credentials" TO quad_app;
--> statement-breakpoint
ALTER TABLE "identities" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "identities" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY account_isolation ON "identities" FOR ALL USING (account_id = nullif(current_setting('app.account_id', true), '')::uuid) WITH CHECK (account_id = nullif(current_setting('app.account_id', true), '')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT ON "identities" TO quad_app;
--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sessions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY account_isolation ON "sessions" FOR ALL USING (account_id = nullif(current_setting('app.account_id', true), '')::uuid) WITH CHECK (account_id = nullif(current_setting('app.account_id', true), '')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "sessions" TO quad_app;
--> statement-breakpoint
ALTER TABLE "trusted_devices" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "trusted_devices" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY account_isolation ON "trusted_devices" FOR ALL USING (account_id = nullif(current_setting('app.account_id', true), '')::uuid) WITH CHECK (account_id = nullif(current_setting('app.account_id', true), '')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "trusted_devices" TO quad_app;
--> statement-breakpoint
-- Hand-added (D32, open table): otp_challenges has no account until the code is verified, so it has
-- no RLS. Its subject_hash and code_hash are HMAC-SHA256 with a key derived from SESSION_SECRET, so
-- the rows identify nobody without the server key. It is listed in OPEN_TABLES.
GRANT SELECT, INSERT, UPDATE, DELETE ON "otp_challenges" TO quad_app;
