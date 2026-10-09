-- Task 16 (D32): "Exit to platform" also records support_session.ended in the school's audit log,
-- exactly once. end_support_session now returns the visit it ended (its id, school and Quad staff
-- member: the minimum the school's audit row needs), or no row when there was nothing to end, so
-- a second click or a race never writes a second school entry. Still keyed only by the cookie's
-- SHA-256, still one platform_audit row. The return type changes, so the old function is dropped
-- and the new one gets the same owner, pinned search_path, REVOKE PUBLIC and GRANT quad_app as 0006.
DROP FUNCTION end_support_session(bytea);--> statement-breakpoint
CREATE FUNCTION end_support_session(p_token_hash bytea)
RETURNS TABLE (support_session_id uuid, tenant_id uuid, platform_user_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ended record;
BEGIN
  UPDATE public.support_sessions ss SET ended_at = now()
  WHERE ss.token_hash = p_token_hash AND ss.ended_at IS NULL
  RETURNING ss.id, ss.platform_user_id, ss.tenant_id INTO v_ended;
  IF FOUND THEN
    INSERT INTO public.platform_audit (actor_platform_user_id, action, target_type, target_id, tenant_id)
    VALUES (v_ended.platform_user_id, 'support_session.ended', 'support_session', v_ended.id,
            v_ended.tenant_id);
    support_session_id := v_ended.id;
    tenant_id := v_ended.tenant_id;
    platform_user_id := v_ended.platform_user_id;
    RETURN NEXT;
  END IF;
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION end_support_session(bytea) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION end_support_session(bytea) TO quad_app;
