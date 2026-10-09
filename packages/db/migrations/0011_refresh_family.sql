-- Hand-written (D32, Task 9): a parent's refresh token, `{sessionId}.{generation}.{secret}`, names
-- its family (a mobile `sessions` row) before anyone is known, and `sessions` is an account table
-- that quad_app reads only under `app.account_id`. This lookup gives exactly what the API needs to
-- open that account's transaction in that school: the account and the school of a live family
-- (a mobile session that is in a school and not revoked). Nothing about the token: the API checks
-- the generation and the secret itself, under account RLS, with the row locked.
CREATE FUNCTION refresh_family(p_session_id uuid)
RETURNS TABLE (account_id uuid, tenant_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT s.account_id, s.active_tenant_id
  FROM public.sessions s
  WHERE s.id = p_session_id
    AND s.kind = 'mobile'
    AND s.stage = 'active'
    AND s.account_id IS NOT NULL
    AND s.active_tenant_id IS NOT NULL
    AND s.revoked_at IS NULL;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION refresh_family(uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION refresh_family(uuid) TO quad_app;
