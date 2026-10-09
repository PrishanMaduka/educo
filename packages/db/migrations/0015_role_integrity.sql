-- Hand-written (Task 13, D32): role integrity for the permission cache and for who may hold a
-- role, made structural so no caller can forget it.
--
-- 1. roles.updated_at is the permission cache key (spec 05, Task 12): every UPDATE of a role sets
--    it to clock_timestamp(), whatever the statement says, and every INSERT, UPDATE or DELETE on
--    role_permissions or role_sensitive moves the roles it touched. One statement-level trigger
--    per event, because a trigger with transition tables takes exactly one event. They run as the
--    writer (quad_app under app.tenant_id), so RLS keeps the bump to the writer's school, and
--    clock_timestamp() moves again for a second write in the same transaction.
CREATE FUNCTION set_role_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION set_role_updated_at() FROM PUBLIC;--> statement-breakpoint
CREATE TRIGGER roles_set_updated_at BEFORE UPDATE ON "roles" FOR EACH ROW EXECUTE FUNCTION set_role_updated_at();--> statement-breakpoint
CREATE FUNCTION bump_roles_from_new_rows()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.roles r SET updated_at = clock_timestamp()
  WHERE (r.tenant_id, r.id) IN (SELECT DISTINCT c.tenant_id, c.role_id FROM changed_rows c);
  RETURN NULL;
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION bump_roles_from_new_rows() FROM PUBLIC;--> statement-breakpoint
CREATE TRIGGER role_permissions_bump_on_insert AFTER INSERT ON "role_permissions" REFERENCING NEW TABLE AS changed_rows FOR EACH STATEMENT EXECUTE FUNCTION bump_roles_from_new_rows();--> statement-breakpoint
CREATE TRIGGER role_permissions_bump_on_update AFTER UPDATE ON "role_permissions" REFERENCING NEW TABLE AS changed_rows FOR EACH STATEMENT EXECUTE FUNCTION bump_roles_from_new_rows();--> statement-breakpoint
CREATE TRIGGER role_permissions_bump_on_delete AFTER DELETE ON "role_permissions" REFERENCING OLD TABLE AS changed_rows FOR EACH STATEMENT EXECUTE FUNCTION bump_roles_from_new_rows();--> statement-breakpoint
CREATE TRIGGER role_sensitive_bump_on_insert AFTER INSERT ON "role_sensitive" REFERENCING NEW TABLE AS changed_rows FOR EACH STATEMENT EXECUTE FUNCTION bump_roles_from_new_rows();--> statement-breakpoint
CREATE TRIGGER role_sensitive_bump_on_update AFTER UPDATE ON "role_sensitive" REFERENCING NEW TABLE AS changed_rows FOR EACH STATEMENT EXECUTE FUNCTION bump_roles_from_new_rows();--> statement-breakpoint
CREATE TRIGGER role_sensitive_bump_on_delete AFTER DELETE ON "role_sensitive" REFERENCING OLD TABLE AS changed_rows FOR EACH STATEMENT EXECUTE FUNCTION bump_roles_from_new_rows();--> statement-breakpoint
-- 2. Only a staff membership holds roles (Task 12 review, I1): a user_roles row may only name a
--    users row with kind = 'staff', and a membership holding a role cannot stop being staff. A
--    check constraint cannot read another table, so two row triggers raise check_violation. The
--    composite foreign key keeps the users row in the same school, which the writer can read; a
--    row the writer cannot see (another school's) is left to RLS and that foreign key.
CREATE FUNCTION refuse_role_for_non_staff()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.tenant_id = NEW.tenant_id AND u.id = NEW.user_id AND u.kind <> 'staff'
  ) THEN
    RAISE EXCEPTION 'only a staff membership can hold a role' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION refuse_role_for_non_staff() FROM PUBLIC;--> statement-breakpoint
CREATE TRIGGER user_roles_staff_only BEFORE INSERT OR UPDATE OF tenant_id, user_id ON "user_roles" FOR EACH ROW EXECUTE FUNCTION refuse_role_for_non_staff();--> statement-breakpoint
CREATE FUNCTION refuse_kind_change_with_roles()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.kind <> 'staff' AND EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.tenant_id = NEW.tenant_id AND ur.user_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'a membership that holds a role must stay staff' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION refuse_kind_change_with_roles() FROM PUBLIC;--> statement-breakpoint
CREATE TRIGGER users_kind_keeps_roles_staff BEFORE UPDATE OF kind ON "users" FOR EACH ROW WHEN (OLD.kind IS DISTINCT FROM NEW.kind) EXECUTE FUNCTION refuse_kind_change_with_roles();--> statement-breakpoint
-- 3. clear_member_preview (D16 tenant-scoped definer, Task 13): a role change or a deactivation
--    ends the member's role preview in the current school (preview_role_id and
--    preview_sample_user_id on their live sessions there). sessions is an account table, so the
--    write goes through with_account_scope like revoke_member_sessions. Another school's user
--    id, or the member's sessions elsewhere, are left alone; it refuses without app.tenant_id.
CREATE FUNCTION clear_member_preview(p_user_id uuid)
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
    RAISE EXCEPTION 'clear_member_preview needs app.tenant_id' USING ERRCODE = '42501';
  END IF;
  SELECT u.account_id INTO v_account_id FROM public.users u
  WHERE u.id = p_user_id AND u.tenant_id = v_tenant_id;
  IF v_account_id IS NULL THEN
    RETURN;
  END IF;
  PERFORM with_account_scope(
    v_account_id,
    'WITH cleared AS (
       UPDATE public.sessions SET preview_role_id = NULL, preview_sample_user_id = NULL
       WHERE account_id = $1 AND active_tenant_id = ($2->>''tenant_id'')::uuid
         AND revoked_at IS NULL
         AND (preview_role_id IS NOT NULL OR preview_sample_user_id IS NOT NULL)
       RETURNING 1)
     SELECT to_jsonb(count(*)) FROM cleared',
    jsonb_build_object('tenant_id', v_tenant_id)
  );
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION clear_member_preview(uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION clear_member_preview(uuid) TO quad_app;
