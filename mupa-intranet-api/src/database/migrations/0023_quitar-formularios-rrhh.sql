-- RRHH (5-oct-2026): ya maneja bien sus trámites y no quiere cambiarlos. Se quitan los formularios de
-- carta de trabajo y certificación laboral y sus tarjetas del catálogo; la pestaña de RRHH solo informa cómo se pide cada cosa.
-- Si un formulario ya recibió solicitudes no se borra (se perdería su historial): solo se despublica.
DELETE FROM "forms"
WHERE "slug" IN ('carta-de-trabajo', 'certificacion')
  AND NOT EXISTS (SELECT 1 FROM "requests" WHERE "requests"."form_id" = "forms"."id");--> statement-breakpoint
UPDATE "forms" SET "published" = false, "accepting" = false WHERE "slug" IN ('carta-de-trabajo', 'certificacion');--> statement-breakpoint
DELETE FROM "applications" WHERE "slug" IN ('carta', 'cert');
