-- Hand-added (D16, D32): the support banner in a support visit says "you're in {school} as {name}
-- from Quad" (spec 05, Support access), and GET /me names the Quad staff member, but
-- platform_users is closed to quad_app. Tenant-scoped like current_tenant_profile: app.tenant_id
-- is the only school it answers for, and only while the visit is active. Returns the name only.
CREATE FUNCTION current_support_visit(p_support_session_id uuid)
RETURNS TABLE (platform_user_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT pu.name
  FROM public.support_sessions ss
  JOIN public.platform_users pu ON pu.id = ss.platform_user_id
  WHERE ss.id = p_support_session_id
    AND ss.tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND ss.ended_at IS NULL
    AND ss.expires_at > now();
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION current_support_visit(uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION current_support_visit(uuid) TO quad_app;
