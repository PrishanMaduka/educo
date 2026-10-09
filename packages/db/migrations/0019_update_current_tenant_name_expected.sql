-- Task 14 review carry-over (D32): School settings read the name through current_tenant_profile,
-- then renamed the school later in the same transaction, so a console rename committed in between
-- was silently overwritten. update_current_tenant_name now takes the name the caller read
-- (p_expected) and renames only while the row still has it, under the row lock: true when it
-- renamed, false when the name has changed meanwhile (the API answers 409, stale version) or
-- there is no such school. The signature changes, so the old function is dropped and the new one
-- gets the same owner, pinned search_path, REVOKE PUBLIC and GRANT quad_app as 0006.
DROP FUNCTION update_current_tenant_name(text);--> statement-breakpoint
CREATE FUNCTION update_current_tenant_name(p_expected text, p_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid := nullif(current_setting('app.tenant_id', true), '')::uuid;
  v_previous text;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'update_current_tenant_name needs app.tenant_id' USING ERRCODE = '42501';
  END IF;
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'the school name is blank' USING ERRCODE = '22023';
  END IF;
  SELECT t.name INTO v_previous FROM public.tenants t WHERE t.id = v_tenant_id FOR UPDATE;
  IF NOT FOUND OR v_previous IS DISTINCT FROM p_expected THEN
    RETURN false;
  END IF;
  UPDATE public.tenants SET name = p_name, updated_at = now() WHERE id = v_tenant_id;
  INSERT INTO public.platform_audit (action, target_type, target_id, tenant_id, meta)
  VALUES ('tenant.renamed', 'tenant', v_tenant_id, v_tenant_id,
          jsonb_build_object('from', v_previous, 'to', p_name));
  RETURN true;
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION update_current_tenant_name(text, text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION update_current_tenant_name(text, text) TO quad_app;
