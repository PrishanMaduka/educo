-- D53 (whole-M1 review): an admin's "Sign out everywhere" also forgets the member's trusted
-- devices, so the next sign-in on any of them asks for the two-step code again. Trusted devices
-- are account rows ("Trust this device for 30 days" skips two-step for the account, in every
-- school), so every device of the member's account is revoked: the safe reading, since a device
-- trusted for school A also skips the code for A. Tenant-scoped like revoke_member_sessions: the
-- user id must be a member of app.tenant_id, or nothing happens. Owned by quad_owner (the
-- migration role), pinned search_path, REVOKE PUBLIC and GRANT quad_app as 0006.
CREATE FUNCTION revoke_member_trusted_devices(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid := nullif(current_setting('app.tenant_id', true), '')::uuid;
  v_account_id uuid;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'revoke_member_trusted_devices needs app.tenant_id' USING ERRCODE = '42501';
  END IF;
  SELECT u.account_id INTO v_account_id FROM public.users u
  WHERE u.id = p_user_id AND u.tenant_id = v_tenant_id;
  IF v_account_id IS NULL THEN
    RETURN;
  END IF;
  PERFORM with_account_scope(
    v_account_id,
    'WITH revoked AS (
       UPDATE public.trusted_devices SET revoked_at = now()
       WHERE account_id = $1 AND revoked_at IS NULL
       RETURNING 1)
     SELECT to_jsonb(count(*)) FROM revoked'
  );
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION revoke_member_trusted_devices(uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION revoke_member_trusted_devices(uuid) TO quad_app;
