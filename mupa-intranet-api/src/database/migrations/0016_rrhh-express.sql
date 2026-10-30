CREATE TABLE "rrhh_conexiones" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rrhh_conexiones_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"session_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rrhh_conexiones_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
ALTER TABLE "rrhh_conexiones" ADD CONSTRAINT "rrhh_conexiones_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rrhh_conexiones" ADD CONSTRAINT "rrhh_conexiones_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rrhh_conexiones_user_id_idx" ON "rrhh_conexiones" USING btree ("user_id");