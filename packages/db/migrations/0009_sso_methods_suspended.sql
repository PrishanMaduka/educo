-- Hand-written (D32, Task 3 review ruling): sso_methods_for_domain also counts suspended schools,
-- as auth_memberships does, so staff who sign in only with SSO still reach the suspension notice
-- on Choose a school. Deleted schools still count for nothing. Same signature, owner, grants and
-- pinned search_path; still booleans only, no tenant id.
CREATE OR REPLACE FUNCTION sso_methods_for_domain(p_domain citext)
RETURNS TABLE (google boolean, microsoft boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(bool_or(ts.sso_google), false), coalesce(bool_or(ts.sso_microsoft), false)
  FROM public.tenant_security ts
  JOIN public.tenants t ON t.id = ts.tenant_id
  WHERE ts.sso_domain = p_domain
    AND t.status IN ('trial', 'onboarding', 'active', 'past_due', 'suspended');
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION sso_methods_for_domain(citext) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sso_methods_for_domain(citext) TO quad_app;
