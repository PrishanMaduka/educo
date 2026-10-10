-- M1b Task 3 (D57): a repeat demo request within 24 hours no longer overwrites the abuse signal.
-- The lead keeps the first request's ip_hash and user_agent; the repeat still updates the visible
-- fields. Same signature and return type, so CREATE OR REPLACE keeps the owner (quad_owner, which
-- runs migrations); the pinned search_path, the advisory lock, REVOKE PUBLIC and GRANT quad_app are
-- restated as in 0022. p_ip_hash and p_user_agent are still taken: they are stored on insert.
CREATE OR REPLACE FUNCTION record_demo_request(
  p_kind lead_kind,
  p_name text,
  p_email citext,
  p_school text,
  p_students students_band,
  p_curriculum text,
  p_country text,
  p_city text,
  p_note text,
  p_ip_hash bytea,
  p_user_agent text
)
RETURNS TABLE (lead_id uuid, created boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(lower(p_email::text)));

  SELECT l.id INTO v_id
  FROM public.platform_leads l
  WHERE l.email = p_email
    AND l.kind = p_kind
    AND l.status = 'new'
    AND l.created_at > now() - interval '24 hours'
  ORDER BY l.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_id IS NOT NULL THEN
    UPDATE public.platform_leads l
    SET name = p_name,
        school_name = p_school,
        students_band = p_students,
        curriculum = p_curriculum,
        country = p_country,
        city = p_city,
        note = p_note,
        updated_at = now()
    WHERE l.id = v_id;
    RETURN QUERY SELECT v_id, false;
    RETURN;
  END IF;

  INSERT INTO public.platform_leads
    (kind, name, email, school_name, students_band, curriculum, country, city, note, ip_hash, user_agent)
  VALUES
    (p_kind, p_name, p_email, p_school, p_students, p_curriculum, p_country, p_city, p_note, p_ip_hash, p_user_agent)
  RETURNING id INTO v_id;
  RETURN QUERY SELECT v_id, true;
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION record_demo_request(lead_kind, text, citext, text, students_band, text, text, text, text, bytea, text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION record_demo_request(lead_kind, text, citext, text, students_band, text, text, text, text, bytea, text) TO quad_app;
