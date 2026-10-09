-- Task 14 (D35, D32): School settings checks the office phone against the school's own country,
-- never a Sri Lankan default, so current_tenant_profile also returns tenants.country (ISO 3166-1
-- alpha-2). Its return type changes, so it is dropped and created again, with the same owner,
-- pinned search_path, REVOKE PUBLIC and GRANT quad_app as 0006 and 0012; the new column is last.
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
  ip_allowlist text[],
  country text
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
         coalesce(ts.ip_allowlist, '{}'::text[]),
         t.country::text
  FROM public.tenants t
  LEFT JOIN public.tenant_branding b ON b.tenant_id = t.id
  LEFT JOIN public.tenant_security ts ON ts.tenant_id = t.id
  WHERE t.id = nullif(current_setting('app.tenant_id', true), '')::uuid;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION current_tenant_profile() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION current_tenant_profile() TO quad_app;
