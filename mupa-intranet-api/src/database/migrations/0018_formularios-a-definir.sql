ALTER TABLE "forms" ADD COLUMN "pending_definition" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- RRHH (1-oct-2026): carta de trabajo y certificación laboral irán en el nuevo sistema de planilla.
-- Quedan «a definir con RRHH» y sin recibir solicitudes hasta que se decida el alcance.
UPDATE "forms"
SET "pending_definition" = true, "accepting" = false
WHERE "slug" IN ('carta-de-trabajo', 'certificacion');
