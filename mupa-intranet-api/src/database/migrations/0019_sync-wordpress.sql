ALTER TABLE "bulletins" ADD COLUMN "cover_url" text;--> statement-breakpoint
ALTER TABLE "bulletins" ADD COLUMN "source_id" text;--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN "source_id" text;--> statement-breakpoint
ALTER TABLE "bulletins" ADD CONSTRAINT "bulletins_source_id_unique" UNIQUE("source_id");--> statement-breakpoint
ALTER TABLE "news" ADD CONSTRAINT "news_source_id_unique" UNIQUE("source_id");