-- D37 (product owner): no Google or Microsoft sign-in. Staff sign in with their work email and
-- a password (then two-step and Choose a school); the console with email, password and TOTP.
-- This drops what Task 8 built for SSO. Migrations 0009 and 0010 stay (append-only, R12).
--
-- Hand-added (D16, D32): the SSO lookup goes, and current_tenant_profile is recreated without
-- the three SSO settings (its return type changes, so it is dropped and created again, with the
-- same owner, pinned search_path, REVOKE PUBLIC and GRANT quad_app as 0006).
DROP FUNCTION sso_methods_for_domain(citext);--> statement-breakpoint
DROP FUNCTION current_tenant_profile();--> statement-breakpoint
CREATE FUNCTION current_tenant_profile()
RETURNS TABLE (
  name text,
  short_name text,
  status tenant_status,
  suspend_reason text,
  time_zone text,
  locale text,
  currency text,
  brand_color text,
  logo_file_id uuid,
  modules text[],
  two_step two_step_rule,
  password_min_length integer,
  session_hours integer,
  ip_allowlist text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT t.name,
         t.short_name::text,
         t.status,
         t.suspend_reason,
         t.time_zone,
         t.locale,
         t.currency::text,
         b.brand_color,
         b.logo_file_id,
         array(
           SELECT m.module::text FROM public.tenant_modules m
           WHERE m.tenant_id = t.id AND m.enabled ORDER BY m.module::text
         ),
         coalesce(ts.two_step, 'off'),
         coalesce(ts.password_min_length, 10),
         coalesce(ts.session_hours, 12),
         coalesce(ts.ip_allowlist, '{}'::text[])
  FROM public.tenants t
  LEFT JOIN public.tenant_branding b ON b.tenant_id = t.id
  LEFT JOIN public.tenant_security ts ON ts.tenant_id = t.id
  WHERE t.id = nullif(current_setting('app.tenant_id', true), '')::uuid;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION current_tenant_profile() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION current_tenant_profile() TO quad_app;--> statement-breakpoint
DROP TABLE "identities" CASCADE;--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "sign_in_method" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."sign_in_method";--> statement-breakpoint
CREATE TYPE "public"."sign_in_method" AS ENUM('password');--> statement-breakpoint
-- Hand-edited (data): a session that signed in with SSO keeps no method (NULL, as before 0010)
-- instead of failing the cast. Done in USING, because FORCE RLS lets quad_owner only read
-- sessions (definer_read), so an UPDATE here would change no rows.
ALTER TABLE "sessions" ALTER COLUMN "sign_in_method" SET DATA TYPE "public"."sign_in_method" USING (CASE WHEN "sign_in_method" = 'password' THEN 'password' END)::"public"."sign_in_method";--> statement-breakpoint
ALTER TABLE "tenant_security" DROP COLUMN "sso_google";--> statement-breakpoint
ALTER TABLE "tenant_security" DROP COLUMN "sso_microsoft";--> statement-breakpoint
ALTER TABLE "tenant_security" DROP COLUMN "sso_domain";--> statement-breakpoint
DROP TYPE "public"."sso_provider";