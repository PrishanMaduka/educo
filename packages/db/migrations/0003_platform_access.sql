CREATE TYPE "public"."account_status" AS ENUM('active', 'locked', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."platform_role" AS ENUM('owner', 'admin', 'support', 'billing', 'readonly');--> statement-breakpoint
CREATE TYPE "public"."plan_module" AS ENUM('admissions', 'crm', 'sis', 'lms', 'fees', 'finance', 'parent', 'transport');--> statement-breakpoint
CREATE TYPE "public"."two_step_rule" AS ENUM('off', 'admins', 'staff', 'all');--> statement-breakpoint
CREATE TABLE "platform_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_platform_user_id" uuid,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" uuid,
	"tenant_id" uuid,
	"ip" "inet",
	"user_agent" text,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" "citext" NOT NULL,
	"role" "platform_role" NOT NULL,
	"totp_secret_enc" text,
	"totp_enabled" boolean DEFAULT false NOT NULL,
	"password_hash" text,
	"status" "account_status" DEFAULT 'active' NOT NULL,
	"last_sign_in_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "signed_token_uses" (
	"nonce" text PRIMARY KEY NOT NULL,
	"purpose" text NOT NULL,
	"used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform_user_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_branding" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"brand_color" text,
	"logo_file_id" uuid,
	"accent_mode" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tenant_modules" (
	"tenant_id" uuid NOT NULL,
	"module" "plan_module" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	CONSTRAINT "tenant_modules_tenant_id_module_pk" PRIMARY KEY("tenant_id","module")
);
--> statement-breakpoint
CREATE TABLE "tenant_security" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"sso_google" boolean DEFAULT false NOT NULL,
	"sso_microsoft" boolean DEFAULT false NOT NULL,
	"sso_domain" "citext",
	"two_step" "two_step_rule" DEFAULT 'off' NOT NULL,
	"password_min_length" integer DEFAULT 10 NOT NULL,
	"session_hours" integer DEFAULT 12 NOT NULL,
	"ip_allowlist" text[] DEFAULT '{}'::text[] NOT NULL,
	CONSTRAINT "tenant_security_password_min_length" CHECK ("tenant_security"."password_min_length" >= 10),
	CONSTRAINT "tenant_security_session_hours" CHECK ("tenant_security"."session_hours" > 0)
);
--> statement-breakpoint
ALTER TABLE "platform_audit" ADD CONSTRAINT "platform_audit_actor_platform_user_id_platform_users_id_fk" FOREIGN KEY ("actor_platform_user_id") REFERENCES "public"."platform_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_audit" ADD CONSTRAINT "platform_audit_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_sessions" ADD CONSTRAINT "support_sessions_platform_user_id_platform_users_id_fk" FOREIGN KEY ("platform_user_id") REFERENCES "public"."platform_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_sessions" ADD CONSTRAINT "support_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_branding" ADD CONSTRAINT "tenant_branding_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_modules" ADD CONSTRAINT "tenant_modules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_security" ADD CONSTRAINT "tenant_security_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "platform_audit_actor_platform_user_id_idx" ON "platform_audit" USING btree ("actor_platform_user_id");--> statement-breakpoint
CREATE INDEX "platform_audit_tenant_id_at_idx" ON "platform_audit" USING btree ("tenant_id","at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "platform_audit_at_idx" ON "platform_audit" USING btree ("at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "support_sessions_platform_user_id_idx" ON "support_sessions" USING btree ("platform_user_id");--> statement-breakpoint
CREATE INDEX "support_sessions_tenant_id_idx" ON "support_sessions" USING btree ("tenant_id");--> statement-breakpoint
-- Hand-added (spec 02, D17): these are platform tables. quad_platform gets DML through the 0000
-- default privileges; quad_app gets nothing, and findTenancyViolations fails on any table, column
-- or sequence privilege it holds here. School code reads branding, modules and security only
-- through the named security-definer functions (D16, D24).
-- Hand-added (quad-tenant-table, append-only tables): platform_audit is insert-only. One shared
-- trigger function refuses UPDATE, DELETE and TRUNCATE, for every role including quad_platform;
-- the tenant audit_log (M1 Task 2) reuses it.
CREATE FUNCTION refuse_append_only_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % is not allowed', TG_TABLE_NAME, TG_OP;
END;
$$;--> statement-breakpoint
CREATE TRIGGER platform_audit_append_only BEFORE UPDATE OR DELETE ON "platform_audit" FOR EACH ROW EXECUTE FUNCTION refuse_append_only_change();--> statement-breakpoint
CREATE TRIGGER platform_audit_no_truncate BEFORE TRUNCATE ON "platform_audit" FOR EACH STATEMENT EXECUTE FUNCTION refuse_append_only_change();
