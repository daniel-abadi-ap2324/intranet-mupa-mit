CREATE TABLE "event_audit" (
	"id" uuid PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"actor_id" integer,
	"subject_type" text,
	"subject_id" integer,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"delivered_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_audit" ADD CONSTRAINT "event_audit_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_audit_type_created_idx" ON "event_audit" USING btree ("type","created_at");--> statement-breakpoint
CREATE INDEX "event_audit_subject_idx" ON "event_audit" USING btree ("subject_type","subject_id");