-- Task 8 (D32): one SSO login per provider per account (the unique pair also serves lookups by
-- account, so the plain index goes), and the first factor of a staff session, which the
-- auth.sign_in audit names once the session opens a school.
CREATE TYPE "public"."sign_in_method" AS ENUM('sso:google', 'sso:microsoft', 'password');--> statement-breakpoint
DROP INDEX "identities_account_id_idx";--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "sign_in_method" "sign_in_method";--> statement-breakpoint
ALTER TABLE "identities" ADD CONSTRAINT "identities_account_id_provider_unique" UNIQUE("account_id","provider");