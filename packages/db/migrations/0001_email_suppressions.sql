CREATE TYPE "public"."email_suppression_reason" AS ENUM('bounce', 'complaint', 'manual');--> statement-breakpoint
CREATE TABLE "email_suppressions" (
	"address" "citext" PRIMARY KEY NOT NULL,
	"reason" "email_suppression_reason" NOT NULL,
	"source" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Hand-added (D16): email_suppressions is a platform table, so quad_app gets no grant on it. The
-- SES webhook has no tenant and may not use withPlatform (lint-restricted to the platform
-- folders), so it records suppressions through this one security-definer function instead. It
-- runs as quad_owner (who runs migrations), with search_path pinned and pg_temp last.
CREATE FUNCTION record_email_suppression(p_address citext, p_reason email_suppression_reason, p_source text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  INSERT INTO public.email_suppressions (address, reason, source, at)
  VALUES (p_address, p_reason, p_source, now())
  ON CONFLICT (address) DO UPDATE SET reason = excluded.reason, source = excluded.source, at = excluded.at;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION record_email_suppression(citext, email_suppression_reason, text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION record_email_suppression(citext, email_suppression_reason, text) TO quad_app;
