ALTER TABLE "platform_users" ADD COLUMN "totp_last_step" bigint;--> statement-breakpoint
ALTER TABLE "platform_users" ADD COLUMN "locked_until" timestamp with time zone;