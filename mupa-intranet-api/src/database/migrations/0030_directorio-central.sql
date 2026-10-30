CREATE TABLE "directorio_extensiones" (
	"ext" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "directorio_sincronizacion" (
	"id" integer PRIMARY KEY NOT NULL,
	"last_ok_at" timestamp with time zone,
	"last_attempt_at" timestamp with time zone,
	"last_error" text,
	"count" integer DEFAULT 0 NOT NULL
);
