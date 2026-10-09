-- Hand-written (Task 13 fix round 1, D32).
--
-- M3: refuse_role_for_non_staff (0015) now takes FOR SHARE on the users row it reads, so a role
-- grant and a kind change on the same membership cannot both commit: the kind change waits for
-- the grant, then its own trigger (users_kind_keeps_roles_staff) sees the role and refuses, and in
-- the other order the grant waits and sees the new kind. Replaced here; 0015 is never edited.
CREATE OR REPLACE FUNCTION refuse_role_for_non_staff()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_kind membership_kind;
BEGIN
  SELECT u.kind INTO v_kind FROM public.users u
  WHERE u.tenant_id = NEW.tenant_id AND u.id = NEW.user_id
  FOR SHARE;
  IF v_kind IS NOT NULL AND v_kind <> 'staff' THEN
    RAISE EXCEPTION 'only a staff membership can hold a role' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
-- M2: member_account_email (tenant-scoped definer). The sign-in address of the account behind a
-- member of the current school, so an admin's Reset password goes to the account's address, not
-- the school's copy of it. Another school's member, or none, gives NULL; refused without
-- app.tenant_id. accounts is read through definer_read (0006).
CREATE FUNCTION member_account_email(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid := nullif(current_setting('app.tenant_id', true), '')::uuid;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'member_account_email needs app.tenant_id' USING ERRCODE = '42501';
  END IF;
  RETURN (
    SELECT a.email::text FROM public.users u JOIN public.accounts a ON a.id = u.account_id
    WHERE u.id = p_user_id AND u.tenant_id = v_tenant_id
  );
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION member_account_email(uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION member_account_email(uuid) TO quad_app;--> statement-breakpoint
-- I3: member_has_other_memberships (tenant-scoped definer). Whether the account behind a member of
-- the current school has any other membership, in any school, of any kind or status: false means
-- this school's invitation created the account, the only case where the invite page may set its
-- first password (OQ9). Only a boolean; another school's member, or none, gives false; refused
-- without app.tenant_id.
CREATE FUNCTION member_has_other_memberships(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid := nullif(current_setting('app.tenant_id', true), '')::uuid;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'member_has_other_memberships needs app.tenant_id' USING ERRCODE = '42501';
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.users other ON other.account_id = u.account_id AND other.id <> u.id
    WHERE u.id = p_user_id AND u.tenant_id = v_tenant_id
  );
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION member_has_other_memberships(uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION member_has_other_memberships(uuid) TO quad_app;
