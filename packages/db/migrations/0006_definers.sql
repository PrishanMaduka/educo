ALTER TABLE "support_sessions" ADD COLUMN "token_hash" "bytea";--> statement-breakpoint
ALTER TABLE "support_sessions" ADD CONSTRAINT "support_sessions_token_hash_unique" UNIQUE("token_hash");--> statement-breakpoint
-- Hand-added (D16, D32): the security-definer lookups for sign-in, sessions, the tenant profile,
-- signed tokens and support visits. Every function is owned by quad_owner (who runs migrations),
-- pins search_path with pg_temp last, is not executable by PUBLIC, and is executable by
-- quad_app only. They return the fewest columns their callers need.
--
-- definer_read (D32, amends D24's "no other permissive policy"): quad_owner is NOBYPASSRLS and
-- FORCE RLS filters it, so without these the definers would read every one of these tables as
-- empty. Each policy is SELECT only and TO quad_owner only, so quad_app sees exactly what it saw
-- before. findTenancyViolations allows exactly this policy on exactly these five tables.
CREATE POLICY definer_read ON "accounts" FOR SELECT TO quad_owner USING (true);--> statement-breakpoint
CREATE POLICY definer_read ON "sessions" FOR SELECT TO quad_owner USING (true);--> statement-breakpoint
CREATE POLICY definer_read ON "users" FOR SELECT TO quad_owner USING (true);--> statement-breakpoint
CREATE POLICY definer_read ON "user_roles" FOR SELECT TO quad_owner USING (true);--> statement-breakpoint
CREATE POLICY definer_read ON "roles" FOR SELECT TO quad_owner USING (true);--> statement-breakpoint
-- R-definer-account: the one place a definer switches app.account_id. Writes to account rows and
-- reads of credentials pass the normal account policy, so the switch is to the target account,
-- for the statement only. The target must be a member of app.tenant_id, or not exist yet (a new
-- account an invite is creating). The caller's value is restored explicitly on success and in
-- the exception block before the error is re-raised: a transaction-local set_config made inside
-- a function outlives the call, even one with a SET clause. Not a definer and not executable by
-- quad_app: only
-- the definers below (running as quad_owner) call it, always with a constant statement. The
-- statement gets $1 = the account id and $2 = p_args, and returns one jsonb column.
CREATE FUNCTION with_account_scope(p_account_id uuid, p_statement text, p_args jsonb DEFAULT '{}'::jsonb)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid := nullif(current_setting('app.tenant_id', true), '')::uuid;
  v_previous text := coalesce(current_setting('app.account_id', true), '');
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'with_account_scope needs app.tenant_id' USING ERRCODE = '42501';
  END IF;
  IF p_account_id IS NULL THEN
    RAISE EXCEPTION 'with_account_scope needs an account id' USING ERRCODE = '22004';
  END IF;
  IF EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = p_account_id)
     AND NOT EXISTS (
       SELECT 1 FROM public.users u WHERE u.account_id = p_account_id AND u.tenant_id = v_tenant_id
     ) THEN
    RAISE EXCEPTION 'the account is not a member of this school' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('app.account_id', p_account_id::text, true);
  BEGIN
    RETURN QUERY EXECUTE p_statement USING p_account_id, p_args;
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.account_id', v_previous, true);
    RAISE;
  END;
  PERFORM set_config('app.account_id', v_previous, true);
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION with_account_scope(uuid, text, jsonb) FROM PUBLIC;--> statement-breakpoint
-- Sign-in (spec 02, D16): the account's active memberships of live schools. Suspended schools are
-- returned with the reason so sign-in can say why (spec 07); deleted ones never. No email or
-- phone. Wider than spec 02 and 04 on purpose (short_name, user_id, suspended, suspend_reason;
-- D32).
CREATE FUNCTION auth_memberships(p_account_id uuid)
RETURNS TABLE (
  tenant_id uuid,
  tenant_name text,
  short_name text,
  logo_file_id uuid,
  brand_color text,
  kind membership_kind,
  user_id uuid,
  role_names text[],
  suspended boolean,
  suspend_reason text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT t.id,
         t.name,
         t.short_name::text,
         b.logo_file_id,
         b.brand_color,
         u.kind,
         u.id,
         array(
           SELECT r.name FROM public.user_roles ur
           JOIN public.roles r ON r.tenant_id = ur.tenant_id AND r.id = ur.role_id
           WHERE ur.tenant_id = u.tenant_id AND ur.user_id = u.id
           ORDER BY ur."primary" DESC, r.name
         ),
         t.status = 'suspended',
         CASE WHEN t.status = 'suspended' THEN t.suspend_reason END
  FROM public.users u
  JOIN public.tenants t ON t.id = u.tenant_id
  LEFT JOIN public.tenant_branding b ON b.tenant_id = t.id
  WHERE u.account_id = p_account_id
    AND u.status = 'active'
    AND u.deleted_at IS NULL
    AND t.status IN ('trial', 'onboarding', 'active', 'past_due', 'suspended')
  ORDER BY t.name, t.id;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION auth_memberships(uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION auth_memberships(uuid) TO quad_app;--> statement-breakpoint
-- Sign-in: find an account by exactly one identifier, before anyone is known.
CREATE FUNCTION account_by_identifier(p_email citext, p_phone text)
RETURNS TABLE (id uuid, status account_status, locked_until timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF num_nonnulls(p_email, p_phone) <> 1 THEN
    RAISE EXCEPTION 'pass exactly one of email and phone' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    SELECT a.id, a.status, a.locked_until FROM public.accounts a
    WHERE (p_email IS NOT NULL AND a.email = p_email)
       OR (p_phone IS NOT NULL AND a.phone_e164 = p_phone);
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION account_by_identifier(citext, text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION account_by_identifier(citext, text) TO quad_app;--> statement-breakpoint
-- Every request: resolve a cookie hash. First an account's session that is not revoked (console
-- sessions, with no account, belong to withPlatform and are never returned); a row tied to a
-- support visit only while that visit is active and for the session's school. Then a redeemed,
-- active support visit (R-support-token), returned as kind 'support' with its school. Expiry is
-- left to the caller (sessionExpiry), which needs these fields.
CREATE FUNCTION session_by_token(p_token_hash bytea)
RETURNS TABLE (
  session_id uuid,
  account_id uuid,
  platform_user_id uuid,
  active_tenant_id uuid,
  active_user_id uuid,
  stage session_stage,
  kind text,
  expires_at timestamptz,
  last_seen_at timestamptz,
  keep_signed_in boolean,
  preview_role_id uuid,
  preview_sample_user_id uuid,
  support_session_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT s.id, s.account_id, NULL::uuid, s.active_tenant_id, s.active_user_id, s.stage,
         s.kind::text, s.expires_at, s.last_seen_at, s.keep_signed_in, s.preview_role_id,
         s.preview_sample_user_id, s.support_session_id
  FROM public.sessions s
  WHERE s.token_hash = p_token_hash
    AND s.account_id IS NOT NULL
    AND s.revoked_at IS NULL
    AND (
      s.support_session_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.support_sessions ss
        WHERE ss.id = s.support_session_id
          AND ss.tenant_id = s.active_tenant_id
          AND ss.ended_at IS NULL
          AND ss.expires_at > now()
      )
    )
  UNION ALL
  SELECT NULL::uuid, NULL::uuid, ss.platform_user_id, ss.tenant_id, NULL::uuid,
         'active'::session_stage, 'support', ss.expires_at, NULL::timestamptz, false, NULL::uuid,
         NULL::uuid, ss.id
  FROM public.support_sessions ss
  WHERE ss.token_hash = p_token_hash
    AND ss.ended_at IS NULL
    AND ss.expires_at > now()
    AND NOT EXISTS (SELECT 1 FROM public.sessions s WHERE s.token_hash = p_token_hash)
  LIMIT 1;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION session_by_token(bytea) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION session_by_token(bytea) TO quad_app;--> statement-breakpoint
-- Sign-in: which SSO buttons to offer for an email domain. Booleans only, no tenant id.
CREATE FUNCTION sso_methods_for_domain(p_domain citext)
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
    AND t.status IN ('trial', 'onboarding', 'active', 'past_due');
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION sso_methods_for_domain(citext) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sso_methods_for_domain(citext) TO quad_app;--> statement-breakpoint
-- Sign-in: each staff membership's two-step rule, role keys and password length, one row per
-- school. No aggregation here: strictestTwoStep in packages/domain decides. A school with no
-- tenant_security row gets the table defaults.
CREATE FUNCTION auth_sign_in_rules(p_account_id uuid)
RETURNS TABLE (tenant_id uuid, two_step two_step_rule, role_keys text[], password_min_length integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT t.id,
         coalesce(ts.two_step, 'off'),
         array(
           SELECT r.key FROM public.user_roles ur
           JOIN public.roles r ON r.tenant_id = ur.tenant_id AND r.id = ur.role_id
           WHERE ur.tenant_id = u.tenant_id AND ur.user_id = u.id
           ORDER BY r.key
         ),
         coalesce(ts.password_min_length, 10)
  FROM public.users u
  JOIN public.tenants t ON t.id = u.tenant_id
  LEFT JOIN public.tenant_security ts ON ts.tenant_id = t.id
  WHERE u.account_id = p_account_id
    AND u.kind = 'staff'
    AND u.status = 'active'
    AND u.deleted_at IS NULL
    AND t.status IN ('trial', 'onboarding', 'active', 'past_due', 'suspended')
  ORDER BY t.id;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION auth_sign_in_rules(uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION auth_sign_in_rules(uuid) TO quad_app;--> statement-breakpoint
-- School code reads platform-owned settings of its own school only (D24): app.tenant_id is the
-- only input, and without it there is no row. Missing branding or security rows give the table
-- defaults.
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
  sso_google boolean,
  sso_microsoft boolean,
  sso_domain citext,
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
         coalesce(ts.sso_google, false),
         coalesce(ts.sso_microsoft, false),
         ts.sso_domain,
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
-- Settings → General: rename the current school only, and record it in platform_audit (the
-- school's own audit_log entry is written by the API in the same transaction).
CREATE FUNCTION update_current_tenant_name(p_name text)
RETURNS void
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
  IF NOT FOUND THEN
    RETURN;
  END IF;
  UPDATE public.tenants SET name = p_name, updated_at = now() WHERE id = v_tenant_id;
  INSERT INTO public.platform_audit (action, target_type, target_id, tenant_id, meta)
  VALUES ('tenant.renamed', 'tenant', v_tenant_id, v_tenant_id,
          jsonb_build_object('from', v_previous, 'to', p_name));
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION update_current_tenant_name(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION update_current_tenant_name(text) TO quad_app;--> statement-breakpoint
-- Signed links (D16): store a single-use nonce. True only the first time.
CREATE FUNCTION consume_signed_token(p_nonce text, p_purpose text, p_expires_at timestamptz)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH used AS (
    INSERT INTO public.signed_token_uses (nonce, purpose, expires_at)
    VALUES (p_nonce, p_purpose, p_expires_at)
    ON CONFLICT (nonce) DO NOTHING
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM used);
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION consume_signed_token(text, text, timestamptz) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION consume_signed_token(text, text, timestamptz) TO quad_app;--> statement-breakpoint
-- Support visits (spec 05, dual audit): the platform half of an audited action. Refused unless
-- the visit is active and for the current school; the actor is the visit's platform user.
CREATE FUNCTION record_support_audit(
  p_support_session_id uuid,
  p_action text,
  p_target_type text,
  p_target_id uuid,
  p_meta jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.platform_audit (actor_platform_user_id, action, target_type, target_id, tenant_id, meta)
  SELECT ss.platform_user_id, p_action, p_target_type, p_target_id, ss.tenant_id,
         coalesce(p_meta, '{}'::jsonb) || jsonb_build_object('support_session_id', ss.id)
  FROM public.support_sessions ss
  WHERE ss.id = p_support_session_id
    AND ss.tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND ss.ended_at IS NULL
    AND ss.expires_at > now();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'the support session is not active for this school' USING ERRCODE = '42501';
  END IF;
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION record_support_audit(uuid, text, text, uuid, jsonb) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION record_support_audit(uuid, text, text, uuid, jsonb) TO quad_app;--> statement-breakpoint
-- Invites (tenant-scoped): the account for an email, created if there is none. Never a second
-- account for one email: the unique email and ON CONFLICT DO NOTHING settle a race.
CREATE FUNCTION ensure_account_for_email(p_email citext)
RETURNS TABLE (id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF nullif(current_setting('app.tenant_id', true), '') IS NULL THEN
    RAISE EXCEPTION 'ensure_account_for_email needs app.tenant_id' USING ERRCODE = '42501';
  END IF;
  IF p_email IS NULL THEN
    RAISE EXCEPTION 'ensure_account_for_email needs an email' USING ERRCODE = '22004';
  END IF;
  SELECT a.id INTO v_id FROM public.accounts a WHERE a.email = p_email;
  IF v_id IS NULL THEN
    PERFORM with_account_scope(
      gen_random_uuid(),
      'WITH created AS (
         INSERT INTO public.accounts (id, email, status)
         VALUES ($1, ($2->>''email'')::public.citext, ''active'')
         ON CONFLICT (email) DO NOTHING
         RETURNING id)
       SELECT to_jsonb(created.id) FROM created',
      jsonb_build_object('email', p_email)
    );
    SELECT a.id INTO v_id FROM public.accounts a WHERE a.email = p_email;
  END IF;
  RETURN QUERY SELECT v_id;
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION ensure_account_for_email(citext) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION ensure_account_for_email(citext) TO quad_app;--> statement-breakpoint
-- Users & roles (tenant-scoped): whether each member of the current school has an authenticator.
-- Ids of other schools' members are dropped. credentials is read per account through
-- with_account_scope.
CREATE FUNCTION member_two_step_status(p_user_ids uuid[])
RETURNS TABLE (user_id uuid, totp_enabled boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid := nullif(current_setting('app.tenant_id', true), '')::uuid;
  v_member record;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'member_two_step_status needs app.tenant_id' USING ERRCODE = '42501';
  END IF;
  FOR v_member IN
    SELECT u.id, u.account_id FROM public.users u
    WHERE u.tenant_id = v_tenant_id AND u.id = ANY (p_user_ids)
    ORDER BY u.id
  LOOP
    user_id := v_member.id;
    SELECT (scoped.value #>> '{}')::boolean INTO totp_enabled
    FROM with_account_scope(
      v_member.account_id,
      'SELECT to_jsonb(coalesce(
         (SELECT c.totp_enabled FROM public.credentials c WHERE c.account_id = $1), false))'
    ) AS scoped(value);
    RETURN NEXT;
  END LOOP;
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION member_two_step_status(uuid[]) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION member_two_step_status(uuid[]) TO quad_app;--> statement-breakpoint
-- Deactivate and sign out everywhere (tenant-scoped): revoke the member's sessions in the current
-- school only, web sessions and mobile refresh families alike. Another school's user id, or the
-- member's sessions elsewhere, are left alone.
CREATE FUNCTION revoke_member_sessions(p_user_id uuid)
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
    RAISE EXCEPTION 'revoke_member_sessions needs app.tenant_id' USING ERRCODE = '42501';
  END IF;
  SELECT u.account_id INTO v_account_id FROM public.users u
  WHERE u.id = p_user_id AND u.tenant_id = v_tenant_id;
  IF v_account_id IS NULL THEN
    RETURN;
  END IF;
  PERFORM with_account_scope(
    v_account_id,
    'WITH revoked AS (
       UPDATE public.sessions SET revoked_at = now()
       WHERE account_id = $1 AND active_tenant_id = ($2->>''tenant_id'')::uuid AND revoked_at IS NULL
       RETURNING 1)
     SELECT to_jsonb(count(*)) FROM revoked',
    jsonb_build_object('tenant_id', v_tenant_id)
  );
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION revoke_member_sessions(uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION revoke_member_sessions(uuid) TO quad_app;--> statement-breakpoint
-- Support visits (D16, R-support-token): store the support cookie's hash once. No row when the
-- visit has ended, has expired or was already redeemed.
CREATE FUNCTION redeem_support_session(p_support_session_id uuid, p_token_hash bytea)
RETURNS TABLE (support_session_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.support_sessions
  SET token_hash = p_token_hash
  WHERE id = p_support_session_id
    AND p_token_hash IS NOT NULL
    AND token_hash IS NULL
    AND ended_at IS NULL
    AND expires_at > now()
  RETURNING id;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION redeem_support_session(uuid, bytea) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION redeem_support_session(uuid, bytea) TO quad_app;--> statement-breakpoint
-- Support visits (D16, R-support-token): "Exit to platform" ends the visit its cookie names, once,
-- with one platform_audit row. A sessions row tied to it stops resolving in session_by_token.
CREATE FUNCTION end_support_session(p_token_hash bytea)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ended record;
BEGIN
  UPDATE public.support_sessions SET ended_at = now()
  WHERE token_hash = p_token_hash AND ended_at IS NULL
  RETURNING id, platform_user_id, tenant_id INTO v_ended;
  IF FOUND THEN
    INSERT INTO public.platform_audit (actor_platform_user_id, action, target_type, target_id, tenant_id)
    VALUES (v_ended.platform_user_id, 'support_session.ended', 'support_session', v_ended.id,
            v_ended.tenant_id);
  END IF;
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION end_support_session(bytea) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION end_support_session(bytea) TO quad_app;--> statement-breakpoint
-- D16 stubs: the signatures are fixed now; M4 (enquiry_forms) and M7 (gateway accounts) give
-- them bodies. Until then they find nothing.
CREATE FUNCTION tenant_by_embed_key(p_key text)
RETURNS TABLE (tenant_id uuid, form_id uuid, active boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT NULL::uuid, NULL::uuid, NULL::boolean WHERE false;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION tenant_by_embed_key(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION tenant_by_embed_key(text) TO quad_app;--> statement-breakpoint
CREATE FUNCTION tenant_by_gateway_account(p_provider text, p_account_id text)
RETURNS TABLE (tenant_id uuid, gateway_account_id uuid, mode text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT NULL::uuid, NULL::uuid, NULL::text WHERE false;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION tenant_by_gateway_account(text, text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION tenant_by_gateway_account(text, text) TO quad_app;
