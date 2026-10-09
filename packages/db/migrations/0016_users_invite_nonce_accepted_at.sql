ALTER TABLE "users" ADD COLUMN "invite_nonce" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "accepted_at" timestamp with time zone;--> statement-breakpoint
-- Hand-added backfill (Task 13 fix round 1, I1): every membership past its invitation counts as
-- accepted. quad_owner runs migrations and FORCE RLS would hide the rows from it, so FORCE is
-- lifted for this one statement and restored at once (the migration test checks the result).
ALTER TABLE "users" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
UPDATE "users" SET "accepted_at" = "created_at" WHERE "status" <> 'invited' AND "accepted_at" IS NULL;--> statement-breakpoint
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
