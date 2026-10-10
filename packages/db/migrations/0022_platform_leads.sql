CREATE TYPE "public"."lead_kind" AS ENUM('school_demo', 'parent_intro');--> statement-breakpoint
CREATE TYPE "public"."lead_source" AS ENUM('landing', 'referral', 'event', 'manual');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('new', 'contacted', 'demo_booked', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."students_band" AS ENUM('under_300', '300_1000', '1000_2500', 'over_2500');--> statement-breakpoint
CREATE TABLE "platform_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "lead_kind" NOT NULL,
	"name" text NOT NULL,
	"email" "citext" NOT NULL,
	"school_name" text NOT NULL,
	"students_band" "students_band",
	"curriculum" text,
	"country" text,
	"city" text,
	"note" text,
	"source" "lead_source" DEFAULT 'landing' NOT NULL,
	"status" "lead_status" DEFAULT 'new' NOT NULL,
	"owner_platform_user_id" uuid,
	"notes" text,
	"converted_tenant_id" uuid,
	"ip_hash" "bytea" NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_leads_name_length" CHECK (char_length("platform_leads"."name") BETWEEN 1 AND 120),
	CONSTRAINT "platform_leads_email_length" CHECK (char_length("platform_leads"."email") <= 254),
	CONSTRAINT "platform_leads_school_name_length" CHECK (char_length("platform_leads"."school_name") BETWEEN 1 AND 120),
	CONSTRAINT "platform_leads_curriculum_length" CHECK (char_length("platform_leads"."curriculum") <= 40),
	CONSTRAINT "platform_leads_country_length" CHECK (char_length("platform_leads"."country") <= 80),
	CONSTRAINT "platform_leads_city_length" CHECK (char_length("platform_leads"."city") <= 80),
	CONSTRAINT "platform_leads_note_length" CHECK (char_length("platform_leads"."note") <= 1000),
	CONSTRAINT "platform_leads_ip_hash_length" CHECK (octet_length("platform_leads"."ip_hash") = 32),
	CONSTRAINT "platform_leads_user_agent_length" CHECK (char_length("platform_leads"."user_agent") <= 400)
);
--> statement-breakpoint
ALTER TABLE "platform_leads" ADD CONSTRAINT "platform_leads_owner_platform_user_id_platform_users_id_fk" FOREIGN KEY ("owner_platform_user_id") REFERENCES "public"."platform_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_leads" ADD CONSTRAINT "platform_leads_converted_tenant_id_tenants_id_fk" FOREIGN KEY ("converted_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "platform_leads_email_kind_created_at_idx" ON "platform_leads" USING btree ("email","kind","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "platform_leads_status_updated_at_idx" ON "platform_leads" USING btree ("status","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "platform_leads_updated_at_idx" ON "platform_leads" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "platform_leads_owner_platform_user_id_idx" ON "platform_leads" USING btree ("owner_platform_user_id");--> statement-breakpoint
CREATE INDEX "platform_leads_converted_tenant_id_idx" ON "platform_leads" USING btree ("converted_tenant_id");--> statement-breakpoint
-- Hand-added (D16, D57): platform_leads is a platform table, so quad_app gets no grant on it. The
-- demo request endpoint is anonymous and public and may not use withPlatform (lint-restricted to
-- the platform folders), so it records leads through this one security-definer function. It runs
-- as quad_owner (who runs migrations), with search_path pinned and pg_temp last, and names the
-- table with its schema.
--
-- A repeat from the same email (citext, so any case) and kind within 24 hours of a lead that is
-- still new updates that lead instead of adding one (spec 19). The transaction-level advisory lock
-- on the email comes first, so two requests at once from one email give one lead: the second
-- waits, then its own statement sees the first's committed row. The id comes from the column
-- default (D24's fallback for hand-written SQL). Returns the lead and whether it is new.
CREATE FUNCTION record_demo_request(
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
        ip_hash = p_ip_hash,
        user_agent = p_user_agent,
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
