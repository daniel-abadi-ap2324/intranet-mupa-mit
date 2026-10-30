ALTER TABLE "users" DROP CONSTRAINT "users_email_unique";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "refresh_token" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "access_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "identity_sub" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified" boolean;--> statement-breakpoint
CREATE UNIQUE INDEX "users_local_email_unique" ON "users" USING btree ("email") WHERE "users"."identity_sub" is null;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_identity_sub_unique" UNIQUE("identity_sub");