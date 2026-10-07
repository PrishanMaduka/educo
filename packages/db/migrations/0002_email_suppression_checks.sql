ALTER TABLE "email_suppressions" ADD CONSTRAINT "email_suppressions_address_length" CHECK (char_length("email_suppressions"."address") <= 320);--> statement-breakpoint
ALTER TABLE "email_suppressions" ADD CONSTRAINT "email_suppressions_address_shape" CHECK ("email_suppressions"."address"::text ~ '^[^@\s]+@[^@\s]+$');--> statement-breakpoint
ALTER TABLE "email_suppressions" ADD CONSTRAINT "email_suppressions_source_length" CHECK (char_length("email_suppressions"."source") BETWEEN 1 AND 64);--> statement-breakpoint
-- Hand-added (D16): a suppression someone entered by hand ('manual') is never replaced by an
-- automatic one; a manual entry may still replace a bounce or complaint. CREATE OR REPLACE keeps
-- the owner (quad_owner) and the grants; they are restated so this file alone shows them.
CREATE OR REPLACE FUNCTION record_email_suppression(p_address citext, p_reason email_suppression_reason, p_source text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  INSERT INTO public.email_suppressions (address, reason, source, at)
  VALUES (p_address, p_reason, p_source, now())
  ON CONFLICT (address) DO UPDATE SET reason = excluded.reason, source = excluded.source, at = excluded.at
  WHERE public.email_suppressions.reason <> 'manual';
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION record_email_suppression(citext, email_suppression_reason, text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION record_email_suppression(citext, email_suppression_reason, text) TO quad_app;
